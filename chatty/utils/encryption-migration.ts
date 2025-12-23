// utils/encryption-migration.ts
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import encryptionService from '@/services/encryption.service';

export class EncryptionMigration {
  /**
   * Delete all messages for current user (nuclear option for dev/testing)
   */
  static async deleteAllMyMessages(userId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting all messages for user:', userId);

      // Delete messages where user is sender
      const sentMessages = await firestore()
        .collection('messages')
        .where('senderId', '==', userId)
        .get();

      // Delete messages where user is receiver
      const receivedMessages = await firestore()
        .collection('messages')
        .where('receiverId', '==', userId)
        .get();

      const batch = firestore().batch();
      
      sentMessages.docs.forEach(doc => batch.delete(doc.ref));
      receivedMessages.docs.forEach(doc => batch.delete(doc.ref));

      await batch.commit();
      
      console.log(`✅ Deleted ${sentMessages.size + receivedMessages.size} messages`);
    } catch (error) {
      console.error('Error deleting messages:', error);
      throw error;
    }
  }

  /**
   * Complete encryption reset - generates new keys and backs up to cloud
   * WARNING: This will make all old messages unreadable
   */
  static async resetEncryption(userId: string, password: string): Promise<void> {
    try {
      console.log('🔄 Resetting encryption for user:', userId);

      // 1. Clear local keys
      await AsyncStorage.removeItem(`encryption_keys_${userId}`);
      console.log('✅ Local keys cleared');

      // 2. Initialize new keys with cloud backup
      await encryptionService.initialize(userId, password);
      const publicKeys = await encryptionService.generateKeys();
      console.log('✅ New keys generated');

      // 3. Update public key in Firestore
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          publicKey: publicKeys.publicKey,
          keyResetAt: firestore.FieldValue.serverTimestamp(),
        });
      console.log('✅ Public key updated in Firestore');

      console.log('🎉 Encryption reset complete');
    } catch (error) {
      console.error('Error resetting encryption:', error);
      throw error;
    }
  }
}

export default EncryptionMigration;