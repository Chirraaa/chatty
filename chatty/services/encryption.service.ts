// services/encryption.service.ts
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Type for extended crypto
interface CryptoExtended extends Crypto {
  randomBytes?: (length: number) => Uint8Array;
}

// Patch nacl.randomBytes if it doesn't exist
if (!(nacl as any).randomBytes) {
  console.log('🔧 Patching nacl.randomBytes...');
  (nacl as any).randomBytes = function(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    const cryptoExt = global.crypto as CryptoExtended;
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(bytes);
      return bytes;
    } else if (cryptoExt?.randomBytes) {
      return cryptoExt.randomBytes(length);
    } else {
      throw new Error('No random number generator available');
    }
  };
}

class EncryptionService {
  private keyPair: nacl.BoxKeyPair | null = null;
  private userId: string | null = null;
  private initialized = false;

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
        // Debug: Check crypto availability
        console.log('🔍 Checking crypto availability...');
        console.log('  - global.crypto exists:', !!global.crypto);
        console.log('  - global.crypto.getRandomValues exists:', typeof global.crypto?.getRandomValues);
        const cryptoExt = global.crypto as CryptoExtended;
        console.log('  - global.crypto.randomBytes exists:', typeof cryptoExt?.randomBytes);
        console.log('  - nacl.randomBytes exists:', typeof (nacl as any).randomBytes);
        
        // Skip the test - just try to generate keys
        console.log('⏭️ Skipping random generation test, will try direct key generation...');
        
        // Generate new keys
        console.log('🔑 Generating new encryption keys...');
        this.keyPair = this.generateKeyPairWithFallback();
        
        await this.saveKeys(userId, this.keyPair);
        console.log('✅ Generated and saved new encryption keys');
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('❌ Encryption initialization failed:', error);
      
      // Provide helpful error message
      if (error instanceof Error) {
        if (error.message.includes('no PRNG') || error.message.includes('not available')) {
          console.error('💡 PRNG error: Make sure react-native-get-random-values is imported first');
          console.error('💡 Check that polyfills.js is imported at the top of _layout.tsx');
          console.error('💡 Try: import "../polyfills" before any other imports');
        }
      }
      
      throw error;
    }
  }

  /**
   * Generate key pair with fallback mechanism
   */
  private generateKeyPairWithFallback(): nacl.BoxKeyPair {
    try {
      // Try the standard way first
      return nacl.box.keyPair();
    } catch (error) {
      console.warn('⚠️ Standard key generation failed, trying manual approach...');
      
      // Manual key generation using crypto.getRandomValues directly
      const secretKey = new Uint8Array(32);
      global.crypto.getRandomValues(secretKey);
      
      return nacl.box.keyPair.fromSecretKey(secretKey);
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
   * Encrypt a message for a recipient
   */
  async encryptMessage(recipientPublicKey: string, plaintext: string): Promise<string> {
    this.ensureInitialized();
    
    try {
      // Decode recipient's public key
      const theirPublicKey = decodeBase64(recipientPublicKey);
      
      // Generate a random nonce manually if needed
      let nonce: Uint8Array;
      try {
        nonce = (nacl as any).randomBytes(nacl.box.nonceLength);
      } catch (error) {
        console.warn('⚠️ nacl.randomBytes failed, using crypto.getRandomValues directly');
        nonce = new Uint8Array(nacl.box.nonceLength);
        global.crypto.getRandomValues(nonce);
      }
      
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
   * Decrypt a message from a sender
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