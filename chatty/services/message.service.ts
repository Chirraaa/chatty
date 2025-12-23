// services/message.service.ts - Instagram-style (Server-side security)
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import imageService from './image.service';

export interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    type: 'text' | 'image';
    content?: string;
    imageData?: string;
    timestamp: Date;
}

class MessageService {
    /**
     * Send text message
     */
    async sendTextMessage(receiverId: string, text: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const docRef = await firestore()
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    receiverId,
                    type: 'text',
                    content: text,
                    timestamp: firestore.FieldValue.serverTimestamp(),
                });

            return docRef.id;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Send image message
     */
    async sendImageMessage(receiverId: string, imageUri: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const base64Data = await imageService.getBase64(imageUri);

            const docRef = await firestore()
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    receiverId,
                    type: 'image',
                    imageData: base64Data,
                    timestamp: firestore.FieldValue.serverTimestamp(),
                });

            return docRef.id;
        } catch (error) {
            console.error('Error sending image:', error);
            throw error;
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

            const processMessages = (snapshot: any) => {
                // Process only new/changed documents
                const newMessages = snapshot.docs
                    .filter((doc: any) => !processedMessageIds.has(doc.id))
                    .map((doc: any) => {
                        processedMessageIds.add(doc.id);
                        const data = doc.data();
                        
                        const message: Message = {
                            id: doc.id,
                            senderId: data.senderId,
                            receiverId: data.receiverId,
                            type: data.type,
                            timestamp: data.timestamp?.toDate() || new Date(),
                        };

                        // Add content based on type
                        if (data.type === 'text') {
                            message.content = data.content;
                        } else if (data.type === 'image') {
                            message.imageData = `data:image/jpeg;base64,${data.imageData}`;
                        }

                        return message;
                    });

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