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
    content?: string;
    imageData?: string;
    timestamp: Date;
    decryptedContent?: string;
    decryptedImageUri?: string;
    isPending?: boolean; // Track if the message is still sending
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

    async sendTextMessage(receiverId: string, text: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const recipientPublicKey = await this.getRecipientPublicKey(receiverId);
            const encryptedText = await encryptionService.encryptMessage(recipientPublicKey, text);

            const docRef = await firestore().collection('messages').add({
                senderId: currentUser.uid,
                receiverId,
                type: 'text',
                content: encryptedText,
                timestamp: firestore.FieldValue.serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async sendImageMessage(receiverId: string, imageUri: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const base64Data = await imageService.getBase64(imageUri);
            const recipientPublicKey = await this.getRecipientPublicKey(receiverId);
            const encryptedImage = await encryptionService.encryptMessage(recipientPublicKey, base64Data);

            const docRef = await firestore().collection('messages').add({
                senderId: currentUser.uid,
                receiverId,
                type: 'image',
                imageData: encryptedImage,
                timestamp: firestore.FieldValue.serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            console.error('Error sending image:', error);
            throw error;
        }
    }

    subscribeToMessages(otherUserId: string, onUpdate: (messages: Message[]) => void): () => void {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            let allMessages: Message[] = [];

            const processMessages = async (snapshot: any) => {
                // Use Promise.all to decrypt everything in parallel
                const decryptionPromises = snapshot.docs.map(async (doc: any) => {
                    const data = doc.data();
                    const message: Message = {
                        id: doc.id,
                        senderId: data.senderId,
                        receiverId: data.receiverId,
                        type: data.type,
                        timestamp: data.timestamp?.toDate() || new Date(),
                        isPending: snapshot.metadata.hasPendingWrites, // Metadata check
                    };

                    try {
                        const senderPublicKey = await this.getSenderPublicKey(data.senderId);
                        if (data.type === 'text' && data.content) {
                            message.decryptedContent = await encryptionService.decryptMessage(senderPublicKey, data.content);
                        } else if (data.type === 'image' && data.imageData) {
                            const decryptedBase64 = await encryptionService.decryptMessage(senderPublicKey, data.imageData);
                            message.decryptedImageUri = `data:image/jpeg;base64,${decryptedBase64}`;
                        }
                        return message;
                    } catch (err) {
                        message.decryptedContent = '[Decryption failed]';
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

            const options = { includeMetadataChanges: true }; // Essential for instant local updates

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

            return () => { unsubscribe1(); unsubscribe2(); };
        } catch (error) {
            return () => { };
        }
    }
}

export default new MessageService();