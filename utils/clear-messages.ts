// utils/clear-messages.ts - Clear messages AND regenerate keys
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import encryptionService from '@/services/encryption.service';

/**
 * Delete all messages and regenerate encryption keys
 * This ensures a clean start with new E2EE keys
 */
export async function clearAllMyMessagesAndResetKeys(): Promise<number> {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    console.log('🗑️ Clearing all messages and resetting keys...');

    // Get all messages where user is sender
    const sentMessages = await firestore()
      .collection('messages')
      .where('senderId', '==', currentUser.uid)
      .get();

    // Get all messages where user is receiver
    const receivedMessages = await firestore()
      .collection('messages')
      .where('receiverId', '==', currentUser.uid)
      .get();

    // Batch delete
    const batch = firestore().batch();
    
    sentMessages.docs.forEach(doc => batch.delete(doc.ref));
    receivedMessages.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
    
    const totalDeleted = sentMessages.size + receivedMessages.size;
    console.log(`✅ Deleted ${totalDeleted} messages`);

    // Reset encryption keys
    console.log('🔑 Regenerating encryption keys...');
    await encryptionService.resetKeys(currentUser.uid);
    console.log('✅ New keys generated and uploaded');
    
    return totalDeleted;
  } catch (error) {
    console.error('❌ Error clearing messages and resetting keys:', error);
    throw error;
  }
}