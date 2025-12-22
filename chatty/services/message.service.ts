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
    content?: string; // Encrypted content
    imageData?: string; // Encrypted image data
    timestamp: Date;
    decryptedContent?: string;
    decryptedImageUri?: string;
}

class MessageService {

    /**
     * Get recipient's public key from Firestore
     */
    private async getRecipientPublicKey(userId: string): Promise<string> {
        const userDoc = await firestore()
            .collection('users')
            .doc(userId)
            .get();

        const userData = userDoc.data();
        if (!userData?.publicKey) {
            throw new Error('Recipient public key not found');
        }

        return userData.publicKey;
    }

    /**
     * Get sender's public key from Firestore (for decryption)
     */
    private async getSenderPublicKey(senderId: string): Promise<string> {
        const userDoc = await firestore()
            .collection('users')
            .doc(senderId)
            .get();

        const userData = userDoc.data();
        if (!userData?.publicKey) {
            throw new Error('Sender public key not found');
        }

        return userData.publicKey;
    }

    /**
     * Send text message (ENCRYPTED)
     */
    async sendTextMessage(receiverId: string, text: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            // Get recipient's public key
            const recipientPublicKey = await this.getRecipientPublicKey(receiverId);

            // ENCRYPT the message
            const encryptedText = await encryptionService.encryptMessage(recipientPublicKey, text);

            const docRef = await firestore()
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    receiverId,
                    type: 'text',
                    content: encryptedText,
                    timestamp: firestore.FieldValue.serverTimestamp(),
                });

            console.log('Encrypted message sent:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Send image message (ENCRYPTED)
     */
    async sendImageMessage(receiverId: string, imageUri: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            console.log('Converting image to base64...');

            // Convert to base64
            const base64Data = await imageService.getBase64(imageUri);
            console.log(`Base64 size: ${(base64Data.length / 1024).toFixed(2)}KB`);

            // Get recipient's public key
            const recipientPublicKey = await this.getRecipientPublicKey(receiverId);

            // ENCRYPT the base64 data
            console.log('Encrypting image...');
            const encryptedImage = await encryptionService.encryptMessage(recipientPublicKey, base64Data);

            console.log('Saving to Firestore...');
            const docRef = await firestore()
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    receiverId,
                    type: 'image',
                    imageData: encryptedImage,
                    timestamp: firestore.FieldValue.serverTimestamp(),
                });

            console.log('Encrypted image message sent:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error sending image:', error);
            throw error;
        }
    }

    /**
     * Subscribe to messages (AUTO-DECRYPTS)
     */
    subscribeToMessages(
        otherUserId: string,
        onUpdate: (messages: Message[]) => void
    ): () => void {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            let allMessages: Message[] = [];
            let unsubscribe1: (() => void) | null = null;
            let unsubscribe2: (() => void) | null = null;

            const processMessages = async (snapshot: any) => {
                const newMessages: Message[] = [];

                for (const doc of snapshot.docs) {
                    const data = doc.data();

                    const message: Message = {
                        id: doc.id,
                        senderId: data.senderId,
                        receiverId: data.receiverId,
                        type: data.type,
                        timestamp: data.timestamp?.toDate() || new Date(),
                    };

                    try {
                        // Get sender's public key for decryption
                        const senderPublicKey = await this.getSenderPublicKey(data.senderId);

                        if (data.type === 'text' && data.content) {
                            // DECRYPT text
                            message.decryptedContent = await encryptionService.decryptMessage(
                                senderPublicKey,
                                data.content
                            );
                        } else if (data.type === 'image' && data.imageData) {
                            // DECRYPT image data
                            const decryptedBase64 = await encryptionService.decryptMessage(
                                senderPublicKey,
                                data.imageData
                            );
                            message.decryptedImageUri = `data:image/jpeg;base64,${decryptedBase64}`;
                        }

                        newMessages.push(message);
                    } catch (decryptError) {
                        console.error('Failed to decrypt message:', decryptError);
                        // Add the message anyway but mark it as failed to decrypt
                        message.decryptedContent = '[Failed to decrypt]';
                        newMessages.push(message);
                    }
                }

                // Merge with existing messages from other query
                const messageMap = new Map<string, Message>();

                // Add existing messages
                allMessages.forEach(msg => messageMap.set(msg.id, msg));

                // Add new messages
                newMessages.forEach(msg => messageMap.set(msg.id, msg));

                // Convert back to array and sort
                allMessages = Array.from(messageMap.values()).sort(
                    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
                );

                onUpdate(allMessages);
            };

            // Query 1: Messages sent by current user to other user
            unsubscribe1 = firestore()
                .collection('messages')
                .where('senderId', '==', currentUser.uid)
                .where('receiverId', '==', otherUserId)
                .orderBy('timestamp', 'asc')
                .onSnapshot(
                    snapshot => processMessages(snapshot),
                    error => console.error('Query 1 error:', error)
                );

            // Query 2: Messages sent by other user to current user
            unsubscribe2 = firestore()
                .collection('messages')
                .where('senderId', '==', otherUserId)
                .where('receiverId', '==', currentUser.uid)
                .orderBy('timestamp', 'asc')
                .onSnapshot(
                    snapshot => processMessages(snapshot),
                    error => console.error('Query 2 error:', error)
                );

            // Return combined unsubscribe function
            return () => {
                unsubscribe1?.();
                unsubscribe2?.();
            };
        } catch (error) {
            console.error('Error subscribing to messages:', error);
            return () => { };
        }
    }
}

export default new MessageService();