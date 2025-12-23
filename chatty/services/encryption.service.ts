// services/encryption.service.ts - Simple WhatsApp-style E2EE
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

class EncryptionService {
  private keyPair: nacl.BoxKeyPair | null = null;
  private userId: string | null = null;

  /**
   * Generate random bytes
   */
  private getRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    global.crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Initialize encryption for a user
   * Loads existing keys or generates new ones
   */
  async initialize(userId: string): Promise<void> {
    if (this.keyPair && this.userId === userId) {
      console.log('✅ Already initialized');
      return;
    }

    this.userId = userId;

    // Try to load existing keys from local storage
    let storedKeys = await this.loadKeysFromLocal(userId);

    if (!storedKeys) {
      // Generate new keys
      console.log('🔑 Generating new encryption keys...');
      const secretKey = this.getRandomBytes(32);
      this.keyPair = nacl.box.keyPair.fromSecretKey(secretKey);

      // Save locally
      await this.saveKeysToLocal(userId, this.keyPair);

      // Upload public key to Firebase
      await this.uploadPublicKey(userId, this.keyPair.publicKey);
      console.log('✅ New keys generated and uploaded');
    } else {
      this.keyPair = storedKeys;
      console.log('✅ Loaded existing keys');
    }
  }

  /**
   * Encrypt a message for a recipient
   */
  async encryptMessage(recipientPublicKey: string, plaintext: string): Promise<string> {
    if (!this.keyPair) throw new Error('Encryption not initialized');

    try {
      const theirPublicKey = decodeBase64(recipientPublicKey);
      const nonce = this.getRandomBytes(nacl.box.nonceLength);
      const messageBytes = decodeUTF8(plaintext);

      const encrypted = nacl.box(
        messageBytes,
        nonce,
        theirPublicKey,
        this.keyPair.secretKey
      );

      // Combine nonce + encrypted data
      const fullMessage = new Uint8Array(nonce.length + encrypted.length);
      fullMessage.set(nonce);
      fullMessage.set(encrypted, nonce.length);

      return encodeBase64(fullMessage);
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Decrypt a message from a sender
   */
  async decryptMessage(senderPublicKey: string, ciphertext: string): Promise<string> {
    if (!this.keyPair) throw new Error('Encryption not initialized');

    try {
      const theirPublicKey = decodeBase64(senderPublicKey);
      const fullMessage = decodeBase64(ciphertext);
      const nonce = fullMessage.slice(0, nacl.box.nonceLength);
      const encrypted = fullMessage.slice(nacl.box.nonceLength);

      const decrypted = nacl.box.open(
        encrypted,
        nonce,
        theirPublicKey,
        this.keyPair.secretKey
      );

      if (!decrypted) {
        throw new Error('Failed to decrypt - invalid key');
      }

      return encodeUTF8(decrypted);
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  /**
   * Get your own public key
   */
  getPublicKey(): string {
    if (!this.keyPair) throw new Error('Encryption not initialized');
    return encodeBase64(this.keyPair.publicKey);
  }

  /**
   * Get recipient's public key from Firebase
   */
  async getRecipientPublicKey(userId: string): Promise<string> {
    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      const publicKey = userDoc.data()?.publicKey;

      if (!publicKey) {
        throw new Error('Recipient has no encryption key');
      }

      return publicKey;
    } catch (error) {
      console.error('❌ Failed to get recipient public key:', error);
      throw error;
    }
  }

  /**
   * Save keys to local storage (device-only)
   */
  private async saveKeysToLocal(userId: string, keyPair: nacl.BoxKeyPair): Promise<void> {
    try {
      const keys = {
        publicKey: encodeBase64(keyPair.publicKey),
        secretKey: encodeBase64(keyPair.secretKey),
      };

      await AsyncStorage.setItem(
        `encryption_keys_${userId}`,
        JSON.stringify(keys)
      );

      console.log('💾 Keys saved to device');
    } catch (error) {
      console.error('❌ Failed to save keys:', error);
      throw error;
    }
  }

  /**
   * Load keys from local storage
   */
  private async loadKeysFromLocal(userId: string): Promise<nacl.BoxKeyPair | null> {
    try {
      const stored = await AsyncStorage.getItem(`encryption_keys_${userId}`);

      if (!stored) {
        console.log('📭 No local keys found');
        return null;
      }

      const keys = JSON.parse(stored);
      console.log('📬 Found local keys');

      return {
        publicKey: decodeBase64(keys.publicKey),
        secretKey: decodeBase64(keys.secretKey),
      };
    } catch (error) {
      console.error('❌ Error loading keys:', error);
      return null;
    }
  }

  /**
   * Upload public key to Firebase (so others can encrypt messages to you)
   */
  private async uploadPublicKey(userId: string, publicKey: Uint8Array): Promise<void> {
    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          publicKey: encodeBase64(publicKey),
          publicKeyUpdatedAt: firestore.FieldValue.serverTimestamp(),
        });

      console.log('📤 Public key uploaded to Firebase');
    } catch (error) {
      console.error('❌ Failed to upload public key:', error);
      throw error;
    }
  }

  /**
   * Reset encryption (generate new keys)
   */
  async resetKeys(userId: string): Promise<void> {
    try {
      // Delete old keys
      await AsyncStorage.removeItem(`encryption_keys_${userId}`);

      // Generate new keys
      console.log('🔑 Generating new keys...');
      const secretKey = this.getRandomBytes(32);
      this.keyPair = nacl.box.keyPair.fromSecretKey(secretKey);

      // Save new keys
      await this.saveKeysToLocal(userId, this.keyPair);
      await this.uploadPublicKey(userId, this.keyPair.publicKey);

      console.log('✅ Keys reset successfully');
    } catch (error) {
      console.error('❌ Failed to reset keys:', error);
      throw error;
    }
  }

  /**
   * Check if encryption is ready
   */
  isReady(): boolean {
    return this.keyPair !== null;
  }
}

export default new EncryptionService();