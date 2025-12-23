// services/message.service.ts
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import imageService from './image.service';
import encryptionService from './encryption.service';

export interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    type: 'text' | 'image';
    contentForSender?: string;     // Encrypted for sender to read
    contentForReceiver?: string;   // Encrypted for receiver to read
    imageDataForSender?: string;   // Encrypted for sender to read
    imageDataForReceiver?: string; // Encrypted for receiver to read
    timestamp: Date;
    decryptedContent?: string;
    decryptedImageUri?: string;
    isPending?: boolean;
}

class MessageService {
    private async getRecipientPublicKey(userId: string): Promise<string> {
        const userDoc = await firestore().collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (!userData?.publicKey) throw new Error('Recipient public key not found');
        return userData.publicKey;
    }

    private async getSenderPublicKey(senderId: string): Promise<string> {
        const userDoc = await firestore().collection('users').doc(senderId).get();
        const userData = userDoc.data();
        if (!userData?.publicKey) throw new Error('Sender public key not found');
        return userData.publicKey;
    }

    /**
     * Send text message - encrypts twice (once for sender, once for receiver)
     */
    async sendTextMessage(receiverId: string, text: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            // Get receiver's public key
            const receiverPublicKey = await this.getRecipientPublicKey(receiverId);

            // Encrypt message twice:
            // 1. For receiver (asymmetric - they decrypt with our public key)
            // 2. For sender/myself (symmetric - we decrypt with our secret key)
            const encryptedForReceiver = await encryptionService.encryptMessage(receiverPublicKey, text);
            const encryptedForSender = await encryptionService.encryptForSelf(text);

            const docRef = await firestore()
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    receiverId,
                    type: 'text',
                    contentForReceiver: encryptedForReceiver,
                    contentForSender: encryptedForSender,
                    timestamp: firestore.FieldValue.serverTimestamp(),
                });

            return docRef.id;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Send image message - encrypts twice (once for sender, once for receiver)
     */
    async sendImageMessage(receiverId: string, imageUri: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const base64Data = await imageService.getBase64(imageUri);

            // Get receiver's public key
            const receiverPublicKey = await this.getRecipientPublicKey(receiverId);

            // Encrypt image twice
            const encryptedForReceiver = await encryptionService.encryptMessage(receiverPublicKey, base64Data);
            const encryptedForSender = await encryptionService.encryptForSelf(base64Data);

            const docRef = await firestore()
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    receiverId,
                    type: 'image',
                    imageDataForReceiver: encryptedForReceiver,
                    imageDataForSender: encryptedForSender,
                    timestamp: firestore.FieldValue.serverTimestamp(),
                });

            return docRef.id;
        } catch (error) {
            console.error('Error sending image:', error);
            throw error;
        }
    }

    /**
     * Subscribe to messages with proper decryption
     */
    subscribeToMessages(
        otherUserId: string,
        onUpdate: (messages: Message[]) => void
    ): () => void {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            let allMessages: Message[] = [];

            const processMessages = async (snapshot: any) => {
                // PARALLEL DECRYPTION
                const decryptionPromises = snapshot.docs.map(async (doc: any) => {
                    const data = doc.data();
                    const message: Message = {
                        id: doc.id,
                        senderId: data.senderId,
                        receiverId: data.receiverId,
                        type: data.type,
                        timestamp: data.timestamp?.toDate() || new Date(),
                        isPending: snapshot.metadata.hasPendingWrites,
                    };

                    try {
                        const isSentByMe = data.senderId === currentUser.uid;

                        if (data.type === 'text') {
                            if (isSentByMe) {
                                // I sent this message - decrypt my symmetric copy
                                if (data.contentForSender) {
                                    message.decryptedContent = await encryptionService.decryptForSelf(
                                        data.contentForSender
                                    );
                                } else if (data.content) {
                                    // Fallback for old single-encrypted messages
                                    const senderPublicKey = await this.getSenderPublicKey(data.senderId);
                                    message.decryptedContent = await encryptionService.decryptMessage(
                                        senderPublicKey,
                                        data.content
                                    );
                                }
                            } else {
                                // I received this message - decrypt asymmetrically
                                if (data.contentForReceiver) {
                                    const senderPublicKey = await this.getSenderPublicKey(data.senderId);
                                    message.decryptedContent = await encryptionService.decryptMessage(
                                        senderPublicKey,
                                        data.contentForReceiver
                                    );
                                } else if (data.content) {
                                    // Fallback for old messages
                                    const senderPublicKey = await this.getSenderPublicKey(data.senderId);
                                    message.decryptedContent = await encryptionService.decryptMessage(
                                        senderPublicKey,
                                        data.content
                                    );
                                }
                            }
                        } else if (data.type === 'image') {
                            if (isSentByMe) {
                                // I sent this image - decrypt my symmetric copy
                                if (data.imageDataForSender) {
                                    const decryptedBase64 = await encryptionService.decryptForSelf(
                                        data.imageDataForSender
                                    );
                                    message.decryptedImageUri = `data:image/jpeg;base64,${decryptedBase64}`;
                                } else if (data.imageData) {
                                    // Fallback
                                    const senderPublicKey = await this.getSenderPublicKey(data.senderId);
                                    const decryptedBase64 = await encryptionService.decryptMessage(
                                        senderPublicKey,
                                        data.imageData
                                    );
                                    message.decryptedImageUri = `data:image/jpeg;base64,${decryptedBase64}`;
                                }
                            } else {
                                // I received this image - decrypt asymmetrically
                                if (data.imageDataForReceiver) {
                                    const senderPublicKey = await this.getSenderPublicKey(data.senderId);
                                    const decryptedBase64 = await encryptionService.decryptMessage(
                                        senderPublicKey,
                                        data.imageDataForReceiver
                                    );
                                    message.decryptedImageUri = `data:image/jpeg;base64,${decryptedBase64}`;
                                } else if (data.imageData) {
                                    // Fallback
                                    const senderPublicKey = await this.getSenderPublicKey(data.senderId);
                                    const decryptedBase64 = await encryptionService.decryptMessage(
                                        senderPublicKey,
                                        data.imageData
                                    );
                                    message.decryptedImageUri = `data:image/jpeg;base64,${decryptedBase64}`;
                                }
                            }
                        }
                        return message;
                    } catch (decryptError) {
                        console.error('❌ Decryption failed for message:', doc.id, decryptError);
                        message.decryptedContent = '[Unable to decrypt - key mismatch]';
                        return message;
                    }
                });

                const newMessages = await Promise.all(decryptionPromises);

                const messageMap = new Map<string, Message>();
                allMessages.forEach(msg => messageMap.set(msg.id, msg));
                newMessages.forEach(msg => messageMap.set(msg.id, msg));

                allMessages = Array.from(messageMap.values()).sort(
                    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
                );

                onUpdate(allMessages);
            };

            const options = { includeMetadataChanges: true };

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