// services/encryption.service.ts
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';

class EncryptionService {
  private keyPair: nacl.BoxKeyPair | null = null;
  private userId: string | null = null;
  private initialized = false;

  /**
   * Generate random bytes directly using crypto.getRandomValues
   */
  private getRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    global.crypto.getRandomValues(bytes);
    return bytes;
  }

  async initialize(userId: string) {
    if (this.initialized && this.userId === userId) return;
    
    this.userId = userId;
    
    try {
      // Try to load existing keys
      const storedKeys = await this.loadKeys(userId);
      
      if (storedKeys) {
        this.keyPair = storedKeys;
        console.log('✅ Loaded existing encryption keys');
      } else {
        // Generate new keys directly using crypto
        console.log('🔑 Generating new encryption keys...');
        const secretKey = this.getRandomBytes(32);
        this.keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
        
        await this.saveKeys(userId, this.keyPair);
        console.log('✅ Generated and saved new encryption keys');
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('❌ Encryption initialization failed:', error);
      throw error;
    }
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
   * Encrypt a message for a recipient using asymmetric encryption
   */
  async encryptMessage(recipientPublicKey: string, plaintext: string): Promise<string> {
    this.ensureInitialized();
    
    try {
      // Decode recipient's public key
      const theirPublicKey = decodeBase64(recipientPublicKey);
      
      // Generate nonce directly using crypto
      const nonce = this.getRandomBytes(nacl.box.nonceLength);
      
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
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw new Error(`Failed to encrypt message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt a message from a sender using asymmetric encryption
   */
  async decryptMessage(senderPublicKey: string, ciphertext: string): Promise<string> {
    this.ensureInitialized();
    
    try {
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
        throw new Error('Failed to decrypt message - invalid key or corrupted data');
      }
      
      // Decode bytes to string
      return encodeUTF8(decrypted);
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error(`Failed to decrypt message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt a message for yourself using symmetric encryption
   * This allows you to read your own sent messages
   */
  async encryptForSelf(plaintext: string): Promise<string> {
    this.ensureInitialized();
    
    try {
      // Use secret key directly for symmetric encryption
      const nonce = this.getRandomBytes(nacl.secretbox.nonceLength);
      const messageBytes = decodeUTF8(plaintext);
      
      // Use secretbox (symmetric encryption) with our secret key
      const encrypted = nacl.secretbox(
        messageBytes,
        nonce,
        this.keyPair!.secretKey
      );
      
      // Combine nonce + encrypted data
      const fullMessage = new Uint8Array(nonce.length + encrypted.length);
      fullMessage.set(nonce);
      fullMessage.set(encrypted, nonce.length);
      
      return encodeBase64(fullMessage);
    } catch (error) {
      console.error('❌ Self-encryption failed:', error);
      throw new Error(`Failed to encrypt for self: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt a message encrypted for yourself
   */
  async decryptForSelf(ciphertext: string): Promise<string> {
    this.ensureInitialized();
    
    try {
      const fullMessage = decodeBase64(ciphertext);
      
      // Extract nonce and encrypted data
      const nonce = fullMessage.slice(0, nacl.secretbox.nonceLength);
      const encrypted = fullMessage.slice(nacl.secretbox.nonceLength);
      
      // Decrypt using secretbox
      const decrypted = nacl.secretbox.open(
        encrypted,
        nonce,
        this.keyPair!.secretKey
      );
      
      if (!decrypted) {
        throw new Error('Failed to decrypt self message');
      }
      
      return encodeUTF8(decrypted);
    } catch (error) {
      console.error('❌ Self-decryption failed:', error);
      throw new Error(`Failed to decrypt for self: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    try {
      const keys = {
        publicKey: encodeBase64(keyPair.publicKey),
        secretKey: encodeBase64(keyPair.secretKey),
      };
      
      await AsyncStorage.setItem(
        `encryption_keys_${userId}`,
        JSON.stringify(keys)
      );
      
      console.log('💾 Encryption keys saved to storage');
    } catch (error) {
      console.error('❌ Failed to save encryption keys:', error);
      throw new Error('Failed to save encryption keys to storage');
    }
  }

  /**
   * Load keys from secure storage
   */
  private async loadKeys(userId: string): Promise<nacl.BoxKeyPair | null> {
    try {
      const stored = await AsyncStorage.getItem(`encryption_keys_${userId}`);
      
      if (!stored) {
        console.log('📭 No existing encryption keys found');
        return null;
      }
      
      const keys = JSON.parse(stored);
      
      console.log('📬 Found existing encryption keys');
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
   * Check if encryption is ready
   */
  isReady(): boolean {
    return this.initialized && this.keyPair !== null;
  }

  /**
   * Reset encryption (useful for debugging)
   */
  async reset(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`encryption_keys_${userId}`);
      this.keyPair = null;
      this.userId = null;
      this.initialized = false;
      console.log('🗑️ Encryption keys reset');
    } catch (error) {
      console.error('❌ Failed to reset encryption:', error);
    }
  }
}

export default new EncryptionService();