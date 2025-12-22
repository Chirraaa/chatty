// services/encryption.service.ts
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';

class EncryptionService {
  private keyPair: nacl.BoxKeyPair | null = null;
  private userId: string | null = null;
  private initialized = false;

  async initialize(userId: string) {
    if (this.initialized && this.userId === userId) return;
    
    this.userId = userId;
    
    // Try to load existing keys
    const storedKeys = await this.loadKeys(userId);
    
    if (storedKeys) {
      this.keyPair = storedKeys;
      console.log('✅ Loaded existing encryption keys');
    } else {
      // Generate new keys if they don't exist
      this.keyPair = nacl.box.keyPair();
      await this.saveKeys(userId, this.keyPair);
      console.log('✅ Generated new encryption keys');
    }
    
    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.initialized || !this.keyPair) {
      throw new Error('Encryption service not initialized. Call initialize() first.');
    }
  }

  /**
   * Generate public keys to share with other users
   */
  async generateKeys() {
    this.ensureInitialized();
    
    return {
      publicKey: encodeBase64(this.keyPair!.publicKey),
    };
  }

  /**
   * Encrypt a message for a recipient
   */
  async encryptMessage(recipientPublicKey: string, plaintext: string): Promise<string> {
    this.ensureInitialized();
    
    // Decode recipient's public key
    const theirPublicKey = decodeBase64(recipientPublicKey);
    
    // Generate a random nonce
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    
    // Encode message to bytes
    const messageBytes = decodeUTF8(plaintext);
    
    // Encrypt the message
    const encrypted = nacl.box(
      messageBytes,
      nonce,
      theirPublicKey,
      this.keyPair!.secretKey
    );
    
    // Combine nonce + encrypted data
    const fullMessage = new Uint8Array(nonce.length + encrypted.length);
    fullMessage.set(nonce);
    fullMessage.set(encrypted, nonce.length);
    
    // Return as base64
    return encodeBase64(fullMessage);
  }

  /**
   * Decrypt a message from a sender
   */
  async decryptMessage(senderPublicKey: string, ciphertext: string): Promise<string> {
    this.ensureInitialized();
    
    // Decode sender's public key
    const theirPublicKey = decodeBase64(senderPublicKey);
    
    // Decode the ciphertext
    const fullMessage = decodeBase64(ciphertext);
    
    // Extract nonce and encrypted data
    const nonce = fullMessage.slice(0, nacl.box.nonceLength);
    const encrypted = fullMessage.slice(nacl.box.nonceLength);
    
    // Decrypt the message
    const decrypted = nacl.box.open(
      encrypted,
      nonce,
      theirPublicKey,
      this.keyPair!.secretKey
    );
    
    if (!decrypted) {
      throw new Error('Failed to decrypt message');
    }
    
    // Decode bytes to string
    return encodeUTF8(decrypted);
  }

  /**
   * Get own public key
   */
  getPublicKey(): string {
    this.ensureInitialized();
    return encodeBase64(this.keyPair!.publicKey);
  }

  /**
   * Save keys to secure storage
   */
  private async saveKeys(userId: string, keyPair: nacl.BoxKeyPair): Promise<void> {
    const keys = {
      publicKey: encodeBase64(keyPair.publicKey),
      secretKey: encodeBase64(keyPair.secretKey),
    };
    
    await AsyncStorage.setItem(
      `encryption_keys_${userId}`,
      JSON.stringify(keys)
    );
  }

  /**
   * Load keys from secure storage
   */
  private async loadKeys(userId: string): Promise<nacl.BoxKeyPair | null> {
    try {
      const stored = await AsyncStorage.getItem(`encryption_keys_${userId}`);
      
      if (!stored) return null;
      
      const keys = JSON.parse(stored);
      
      return {
        publicKey: decodeBase64(keys.publicKey),
        secretKey: decodeBase64(keys.secretKey),
      };
    } catch (error) {
      console.error('Error loading keys:', error);
      return null;
    }
  }

  /**
   * Check if encryption is ready
   */
  isReady(): boolean {
    return this.initialized && this.keyPair !== null;
  }
}

export default new EncryptionService();