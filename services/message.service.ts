// services/message.service.ts - Enhanced with real-time updates and notifications
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import imageService from './image.service';
import encryptionService from './encryption.service';
import notificationService from './notification.service';
import authService from './auth.service';

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
    edited?: boolean;
    editedAt?: Date;
    deletedForEveryone?: boolean;
    deletedForMe?: boolean;
    read?: boolean;
}

class MessageService {
    /**
     * Send text message (encrypted twice: once for receiver, once for sender)
     */
    async sendTextMessage(receiverId: string, text: string): Promise<string> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const recipientPublicKey = await encryptionService.getRecipientPublicKey(receiverId);
            const myPublicKey = encryptionService.getPublicKey();

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
                    read: false,
                });

            // Send notification
            const senderProfile = await authService.getUserProfile(currentUser.uid);
            await notificationService.sendNotification(
                receiverId,
                senderProfile?.username || 'New message',
                text.length > 50 ? text.substring(0, 47) + '...' : text,
                {
                    type: 'message',
                    senderId: currentUser.uid,
                    messageId: docRef.id,
                }
            );

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
            const recipientPublicKey = await encryptionService.getRecipientPublicKey(receiverId);
            const myPublicKey = encryptionService.getPublicKey();

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
                    read: false,
                });

            // Send notification
            const senderProfile = await authService.getUserProfile(currentUser.uid);
            await notificationService.sendNotification(
                receiverId,
                senderProfile?.username || 'New message',
                '📷 Photo',
                {
                    type: 'message',
                    senderId: currentUser.uid,
                    messageId: docRef.id,
                }
            );

            return docRef.id;
        } catch (error) {
            console.error('Error sending image:', error);
            throw error;
        }
    }

    /**
     * Mark messages as read
     */
    async markMessagesAsRead(senderId: string): Promise<void> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) return;

            const unreadMessages = await firestore()
                .collection('messages')
                .where('senderId', '==', senderId)
                .where('receiverId', '==', currentUser.uid)
                .where('read', '==', false)
                .get();

            const batch = firestore().batch();
            unreadMessages.docs.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });

            await batch.commit();
            console.log(`✅ Marked ${unreadMessages.size} messages as read`);
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }

    /**
     * Get unread message count for a user
     */
    async getUnreadCount(senderId: string): Promise<number> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) return 0;

            const unreadMessages = await firestore()
                .collection('messages')
                .where('senderId', '==', senderId)
                .where('receiverId', '==', currentUser.uid)
                .where('read', '==', false)
                .get();

            return unreadMessages.size;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    /**
     * Edit a text message
     */
    async editMessage(messageId: string, newText: string): Promise<void> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const messageDoc = await firestore().collection('messages').doc(messageId).get();
            const messageData = messageDoc.data();

            if (!messageData || messageData.senderId !== currentUser.uid) {
                throw new Error('Cannot edit this message');
            }

            if (messageData.type !== 'text') {
                throw new Error('Can only edit text messages');
            }

            const recipientPublicKey = await encryptionService.getRecipientPublicKey(messageData.receiverId);
            const myPublicKey = encryptionService.getPublicKey();

            const encryptedForReceiver = await encryptionService.encryptMessage(recipientPublicKey, newText);
            const encryptedForSender = await encryptionService.encryptMessage(myPublicKey, newText);

            await firestore().collection('messages').doc(messageId).update({
                encryptedForReceiver,
                encryptedForSender,
                edited: true,
                editedAt: firestore.FieldValue.serverTimestamp(),
            });
        } catch (error) {
            console.error('Error editing message:', error);
            throw error;
        }
    }

    /**
     * Delete message for me only
     */
    async deleteMessageForMe(messageId: string): Promise<void> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            await firestore().collection('messages').doc(messageId).update({
                [`deletedFor_${currentUser.uid}`]: true,
            });
        } catch (error) {
            console.error('Error deleting message for me:', error);
            throw error;
        }
    }

    /**
     * Delete message for everyone (only sender can do this)
     */
    async deleteMessageForEveryone(messageId: string): Promise<void> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const messageDoc = await firestore().collection('messages').doc(messageId).get();
            const messageData = messageDoc.data();

            if (!messageData || messageData.senderId !== currentUser.uid) {
                throw new Error('Cannot delete this message for everyone');
            }

            await firestore().collection('messages').doc(messageId).update({
                deletedForEveryone: true,
                deletedAt: firestore.FieldValue.serverTimestamp(),
            });
        } catch (error) {
            console.error('Error deleting message for everyone:', error);
            throw error;
        }
    }

    /**
     * Get all media messages in a conversation
     */
    async getMediaMessages(otherUserId: string): Promise<Message[]> {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const sentImages = await firestore()
                .collection('messages')
                .where('senderId', '==', currentUser.uid)
                .where('receiverId', '==', otherUserId)
                .where('type', '==', 'image')
                .get();

            const receivedImages = await firestore()
                .collection('messages')
                .where('senderId', '==', otherUserId)
                .where('receiverId', '==', currentUser.uid)
                .where('type', '==', 'image')
                .get();

            const allDocs = [...sentImages.docs, ...receivedImages.docs];
            const messages = await Promise.all(
                allDocs.map(doc => this.decryptMessage(doc.data(), doc.id, currentUser.uid))
            );

            return messages
                .filter(msg => !msg.decryptionError && !msg.deletedForEveryone)
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        } catch (error) {
            console.error('Error getting media messages:', error);
            return [];
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
            edited: data.edited || false,
            editedAt: data.editedAt?.toDate(),
            deletedForEveryone: data.deletedForEveryone || false,
            deletedForMe: data[`deletedFor_${currentUserId}`] || false,
            read: data.read || false,
        };

        if (!data.encrypted) {
            if (data.type === 'text') {
                message.content = data.content;
            } else if (data.type === 'image') {
                message.imageData = `data:image/jpeg;base64,${data.imageData}`;
            }
            return message;
        }

        try {
            const isSentByMe = data.senderId === currentUserId;

            if (data.type === 'text') {
                if (isSentByMe) {
                    if (data.encryptedForSender) {
                        const myPublicKey = encryptionService.getPublicKey();
                        message.content = await encryptionService.decryptMessage(myPublicKey, data.encryptedForSender);
                    } else if (data.encryptedContent) {
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        message.content = await encryptionService.decryptMessage(senderPublicKey, data.encryptedContent);
                    }
                } else {
                    if (data.encryptedForReceiver) {
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        message.content = await encryptionService.decryptMessage(senderPublicKey, data.encryptedForReceiver);
                    } else if (data.encryptedContent) {
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        message.content = await encryptionService.decryptMessage(senderPublicKey, data.encryptedContent);
                    }
                }
            } else if (data.type === 'image') {
                if (isSentByMe) {
                    if (data.encryptedImageForSender) {
                        const myPublicKey = encryptionService.getPublicKey();
                        const decryptedBase64 = await encryptionService.decryptMessage(myPublicKey, data.encryptedImageForSender);
                        message.imageData = `data:image/jpeg;base64,${decryptedBase64}`;
                    } else if (data.encryptedImageData) {
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        const decryptedBase64 = await encryptionService.decryptMessage(senderPublicKey, data.encryptedImageData);
                        message.imageData = `data:image/jpeg;base64,${decryptedBase64}`;
                    }
                } else {
                    if (data.encryptedImageForReceiver) {
                        const senderPublicKey = await encryptionService.getRecipientPublicKey(data.senderId);
                        const decryptedBase64 = await encryptionService.decryptMessage(senderPublicKey, data.encryptedImageForReceiver);
                        message.imageData = `data:image/jpeg;base64,${decryptedBase64}`;
                    } else if (data.encryptedImageData) {
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
     * Subscribe to messages with REAL-TIME updates
     */
    subscribeToMessages(
        otherUserId: string,
        onUpdate: (messages: Message[]) => void
    ): () => void {
        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            console.log('📡 Setting up real-time message listeners...');

            // Use a map to store messages by ID for efficient updates
            const messagesMap = new Map<string, Message>();

            const processSnapshot = async (snapshot: any, isInitial: boolean = false) => {
                for (const change of snapshot.docChanges()) {
                    const messageId = change.doc.id;
                    
                    if (change.type === 'removed') {
                        messagesMap.delete(messageId);
                    } else {
                        const decrypted = await this.decryptMessage(
                            change.doc.data(),
                            messageId,
                            currentUser.uid
                        );
                        
                        // Only include if not deleted
                        if (!decrypted.deletedForMe && !decrypted.deletedForEveryone) {
                            messagesMap.set(messageId, decrypted);
                        } else {
                            messagesMap.delete(messageId);
                        }
                    }
                }

                // Convert to array and sort
                const sortedMessages = Array.from(messagesMap.values())
                    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

                onUpdate(sortedMessages);
            };

            // Listen to sent messages
            const unsubscribe1 = firestore()
                .collection('messages')
                .where('senderId', '==', currentUser.uid)
                .where('receiverId', '==', otherUserId)
                .onSnapshot(
                    { includeMetadataChanges: false },
                    (snapshot) => processSnapshot(snapshot),
                    (error) => console.error('❌ Sent messages listener error:', error)
                );

            // Listen to received messages
            const unsubscribe2 = firestore()
                .collection('messages')
                .where('senderId', '==', otherUserId)
                .where('receiverId', '==', currentUser.uid)
                .onSnapshot(
                    { includeMetadataChanges: false },
                    (snapshot) => processSnapshot(snapshot),
                    (error) => console.error('❌ Received messages listener error:', error)
                );

            console.log('✅ Real-time listeners active');

            return () => {
                console.log('🔌 Unsubscribing from message listeners');
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