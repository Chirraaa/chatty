// services/message.service.ts - With dual encryption (sender + receiver)
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import imageService from './image.service';
import encryptionService from './encryption.service';

export interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    type: 'text' | 'image';
    content?: string;
    imageData?: string;
    timestamp: Date;
    encrypted?: boolean;
    decryptionError?: boolean;
}

class MessageService {
    /**
     * Send text message (encrypted twice: once for receiver, once for sender)
     */
    async sendTextMessage(receiverId: string, text: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            // Get recipient's public key
            const recipientPublicKey = await encryptionService.getRecipientPublicKey(receiverId);

            // Get my own public key (to encrypt for myself)
            const myPublicKey = encryptionService.getPublicKey();

            // Encrypt the message TWICE
            const encryptedForReceiver = await encryptionService.encryptMessage(recipientPublicKey, text);
            const encryptedForSender = await encryptionService.encryptMessage(myPublicKey, text);

            const docRef = await firestore()
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    receiverId,
                    type: 'text',
                    encryptedForReceiver,
                    encryptedForSender,
                    encrypted: true,
                    timestamp: firestore.FieldValue.serverTimestamp(),
                });

            return docRef.id;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Send image message (encrypted twice: once for receiver, once for sender)
     */
    async sendImageMessage(receiverId: string, imageUri: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const base64Data = await imageService.getBase64(imageUri);

            // Get recipient's public key
            const recipientPublicKey = await encryptionService.getRecipientPublicKey(receiverId);

            // Get my own public key (to encrypt for myself)
            const myPublicKey = encryptionService.getPublicKey();

            // Encrypt the image data TWICE
            const encryptedForReceiver = await encryptionService.encryptMessage(recipientPublicKey, base64Data);
            const encryptedForSender = await encryptionService.encryptMessage(myPublicKey, base64Data);

            const docRef = await firestore()
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    receiverId,
                    type: 'image',
                    encryptedImageForReceiver: encryptedForReceiver,
                    encryptedImageForSender: encryptedForSender,
                    encrypted: true,
                    timestamp: firestore.FieldValue.serverTimestamp(),
                });

            return docRef.id;
        } catch (error) {
            console.error('Error sending image:', error);
            throw error;
        }
    }

    /**
     * Decrypt a single message
     */
    private async decryptMessage(data: any, messageId: string, currentUserId: string): Promise<Message> {
        const message: Message = {
            id: messageId,
            senderId: data.senderId,
            receiverId: data.receiverId,
            type: data.type,
            timestamp: data.timestamp?.toDate() || new Date(),
            encrypted: data.encrypted || false,
            decryptionError: false,
        };

        // If message is not encrypted (old messages), return as-is
        if (!data.encrypted) {
            if (data.type === 'text') {
                message.content = data.content;
            } else if (data.type === 'image') {
                message.imageData = `data:image/jpeg;base64,${data.imageData}`;
            }
            return message;
        }

        // Try to decrypt
        try {
            const isSentByMe = data.senderId === currentUserId;

            if (data.type === 'text') {
                if (isSentByMe) {
                    // I sent this - decrypt the copy encrypted for me
                    if (data.encryptedForSender) {
                        const myPublicKey = encryptionService.getPublicKey();
                        message.content = await encryptionService.decryptMessage(myPublicKey, data.encryptedForSender);
                    } else if (data.encryptedContent) {
                        // Fallback for old format
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        message.content = await encryptionService.decryptMessage(senderPublicKey, data.encryptedContent);
                    }
                } else {
                    // I received this - decrypt the copy encrypted for me
                    if (data.encryptedForReceiver) {
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        message.content = await encryptionService.decryptMessage(senderPublicKey, data.encryptedForReceiver);
                    } else if (data.encryptedContent) {
                        // Fallback for old format
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        message.content = await encryptionService.decryptMessage(senderPublicKey, data.encryptedContent);
                    }
                }
            } else if (data.type === 'image') {
                if (isSentByMe) {
                    // I sent this - decrypt the copy encrypted for me
                    if (data.encryptedImageForSender) {
                        const myPublicKey = encryptionService.getPublicKey();
                        const decryptedBase64 = await encryptionService.decryptMessage(myPublicKey, data.encryptedImageForSender);
                        message.imageData = `data:image/jpeg;base64,${decryptedBase64}`;
                    } else if (data.encryptedImageData) {
                        // Fallback
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        const decryptedBase64 = await encryptionService.decryptMessage(senderPublicKey, data.encryptedImageData);
                        message.imageData = `data:image/jpeg;base64,${decryptedBase64}`;
                    }
                } else {
                    // I received this - decrypt the copy encrypted for me
                    if (data.encryptedImageForReceiver) {
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        const decryptedBase64 = await encryptionService.decryptMessage(senderPublicKey, data.encryptedImageForReceiver);
                        message.imageData = `data:image/jpeg;base64,${decryptedBase64}`;
                    } else if (data.encryptedImageData) {
                        // Fallback
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        const decryptedBase64 = await encryptionService.decryptMessage(senderPublicKey, data.encryptedImageData);
                        message.imageData = `data:image/jpeg;base64,${decryptedBase64}`;
                    }
                }
            }

            return message;
        } catch (error) {
            console.warn(`⚠️ Cannot decrypt message ${messageId}:`, error);
            message.decryptionError = true;
            message.content = '🔒 Cannot decrypt this message';
            return message;
        }
    }

    /**
     * Subscribe to messages
     */
    subscribeToMessages(
        otherUserId: string,
        onUpdate: (messages: Message[]) => void
    ): () => void {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            let allMessages: Message[] = [];
            const processedMessageIds = new Set<string>();

            const processMessages = async (snapshot: any) => {
                // Process only new/changed documents
                const newMessages = await Promise.all(
                    snapshot.docs
                        .filter((doc: any) => !processedMessageIds.has(doc.id))
                        .map(async (doc: any) => {
                            processedMessageIds.add(doc.id);
                            return this.decryptMessage(doc.data(), doc.id, currentUser.uid);
                        })
                );

                // Merge with existing messages
                const messageMap = new Map<string, Message>();
                allMessages.forEach((msg: Message) => messageMap.set(msg.id, msg));
                newMessages.forEach((msg: Message) => messageMap.set(msg.id, msg));

                // Update messages list and sort by timestamp
                allMessages = Array.from(messageMap.values()).sort(
                    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
                );

                onUpdate(allMessages);
            };

            const options = { includeMetadataChanges: false };

            const unsubscribe1 = firestore()
                .collection('messages')
                .where('senderId', '==', currentUser.uid)
                .where('receiverId', '==', otherUserId)
                .onSnapshot(options, snapshot => processMessages(snapshot));

            const unsubscribe2 = firestore()
                .collection('messages')
                .where('senderId', '==', otherUserId)
                .where('receiverId', '==', currentUser.uid)
                .onSnapshot(options, snapshot => processMessages(snapshot));

            return () => {
                unsubscribe1?.();
                unsubscribe2?.();
            };
        } catch (error) {
            console.error('Error subscribing:', error);
            return () => { };
        }
    }
}

export default new MessageService();