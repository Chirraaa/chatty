// services/encryption.service.ts
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

class EncryptionService {
  private keyPair: nacl.BoxKeyPair | null = null;
  private userId: string | null = null;
  private initialized = false;
  private initializing = false; // Lock to prevent concurrent initialization

  /**
   * Generate random bytes directly using crypto.getRandomValues
   */
  private getRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    global.crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Derive a key from password using PBKDF2-like approach
   * This key is used to encrypt the private key before storing in Firestore
   */
  private async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
    // Simple key derivation: hash(password + salt) repeated 10000 times
    let key = decodeUTF8(password + encodeBase64(salt));
    
    // Multiple rounds of hashing for key stretching
    for (let i = 0; i < 10000; i++) {
      key = nacl.hash(key).slice(0, 32); // Use first 32 bytes as the key
    }
    
    return key;
  }

  /**
   * Encrypt data with a symmetric key
   */
  private encryptWithKey(data: Uint8Array, key: Uint8Array): string {
    const nonce = this.getRandomBytes(nacl.secretbox.nonceLength);
    const encrypted = nacl.secretbox(data, nonce, key);
    
    // Combine nonce + encrypted data
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);
    
    return encodeBase64(combined);
  }

  /**
   * Decrypt data with a symmetric key
   */
  private decryptWithKey(ciphertext: string, key: Uint8Array): Uint8Array | null {
    const combined = decodeBase64(ciphertext);
    const nonce = combined.slice(0, nacl.secretbox.nonceLength);
    const encrypted = combined.slice(nacl.secretbox.nonceLength);
    
    return nacl.secretbox.open(encrypted, nonce, key);
  }

  /**
   * Initialize from local storage only (for app startup)
   * Returns true if keys were found, false if missing
   * Does NOT generate new keys if missing
   */
  async initializeFromLocalOnly(userId: string): Promise<boolean> {
    // If already initialized for this user, return true
    if (this.initialized && this.userId === userId) return true;
    
    // If initialization is in progress, wait
    if (this.initializing) {
      console.log('⏳ Initialization already in progress, waiting...');
      // Wait for initialization to complete (with timeout)
      let attempts = 0;
      while (this.initializing && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      return this.initialized && this.userId === userId;
    }
    
    this.initializing = true;
    this.userId = userId;
    
    try {
      const storedKeys = await this.loadKeys(userId);
      
      if (storedKeys) {
        this.keyPair = storedKeys;
        this.initialized = true;
        console.log('✅ Loaded existing encryption keys from local storage');
        return true;
      } else {
        console.log('📭 No local encryption keys found');
        this.initialized = false;
        return false;
      }
    } catch (error) {
      console.error('❌ Error initializing from local storage:', error);
      this.initialized = false;
      return false;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Initialize encryption service - now with password for cloud backup
   * This is used during sign in/sign up when password is available
   */
  async initialize(userId: string, password?: string) {
    // If already initialized for this user, return
    if (this.initialized && this.userId === userId) return;
    
    // If initialization is in progress, wait
    if (this.initializing) {
      console.log('⏳ Initialization already in progress, waiting...');
      let attempts = 0;
      while (this.initializing && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      if (this.initialized && this.userId === userId) return;
    }
    
    this.initializing = true;
    this.userId = userId;
    
    try {
      // First, try to load from local storage
      let storedKeys = await this.loadKeys(userId);
      
      // If not in local storage and password provided, try to load from cloud
      if (!storedKeys && password) {
        console.log('🔍 Checking for cloud backup...');
        storedKeys = await this.loadKeysFromCloud(userId, password);
        
        if (storedKeys) {
          // Save to local storage for faster access next time
          await this.saveKeys(userId, storedKeys);
          console.log('✅ Restored keys from cloud backup');
        }
      }
      
      if (storedKeys) {
        this.keyPair = storedKeys;
        console.log('✅ Loaded existing encryption keys');
      } else {
        // Generate new keys ONLY if password is provided
        if (password) {
          console.log('🔑 Generating new encryption keys...');
          const secretKey = this.getRandomBytes(32);
          this.keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
          
          // Save locally
          await this.saveKeys(userId, this.keyPair);
          
          // Backup to cloud with password
          await this.backupKeysToCloud(userId, this.keyPair, password);
          console.log('✅ Keys backed up to cloud');
          
          console.log('✅ Generated and saved new encryption keys');
        } else {
          console.error('❌ No keys found and no password provided - cannot generate keys');
          throw new Error('Cannot initialize encryption without keys or password');
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('❌ Encryption initialization failed:', error);
      throw error;
    } finally {
      this.initializing = false;
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
      const theirPublicKey = decodeBase64(recipientPublicKey);
      const nonce = this.getRandomBytes(nacl.box.nonceLength);
      const messageBytes = decodeUTF8(plaintext);
      
      const encrypted = nacl.box(
        messageBytes,
        nonce,
        theirPublicKey,
        this.keyPair!.secretKey
      );
      
      const fullMessage = new Uint8Array(nonce.length + encrypted.length);
      fullMessage.set(nonce);
      fullMessage.set(encrypted, nonce.length);
      
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
      const theirPublicKey = decodeBase64(senderPublicKey);
      const fullMessage = decodeBase64(ciphertext);
      const nonce = fullMessage.slice(0, nacl.box.nonceLength);
      const encrypted = fullMessage.slice(nacl.box.nonceLength);
      
      const decrypted = nacl.box.open(
        encrypted,
        nonce,
        theirPublicKey,
        this.keyPair!.secretKey
      );
      
      if (!decrypted) {
        throw new Error('Failed to decrypt message - invalid key or corrupted data');
      }
      
      return encodeUTF8(decrypted);
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error(`Failed to decrypt message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt a message for yourself using symmetric encryption
   */
  async encryptForSelf(plaintext: string): Promise<string> {
    this.ensureInitialized();
    
    try {
      const nonce = this.getRandomBytes(nacl.secretbox.nonceLength);
      const messageBytes = decodeUTF8(plaintext);
      
      const encrypted = nacl.secretbox(
        messageBytes,
        nonce,
        this.keyPair!.secretKey
      );
      
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
      const nonce = fullMessage.slice(0, nacl.secretbox.nonceLength);
      const encrypted = fullMessage.slice(nacl.secretbox.nonceLength);
      
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
   * Backup keys to Firestore (encrypted with password)
   */
  private async backupKeysToCloud(userId: string, keyPair: nacl.BoxKeyPair, password: string): Promise<void> {
    try {
      // Generate a salt for key derivation
      const salt = this.getRandomBytes(16);
      
      // Derive encryption key from password
      const derivedKey = await this.deriveKeyFromPassword(password, salt);
      
      // Encrypt the secret key
      const encryptedSecretKey = this.encryptWithKey(keyPair.secretKey, derivedKey);
      
      // Store in Firestore
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          encryptedPrivateKey: encryptedSecretKey,
          keySalt: encodeBase64(salt),
          keyBackupVersion: 1, // For future compatibility
        });
      
      console.log('💾 Private key backed up to cloud');
    } catch (error: any) {
      console.error('❌ Failed to backup keys to cloud:', error);
      
      // Check if it's a permission error
      if (error.code === 'firestore/permission-denied') {
        console.error('❌ Permission denied - cannot backup keys');
        // Don't throw - this shouldn't prevent login, but warn user
      }
      // Don't throw on other errors either - backup failure shouldn't prevent usage
    }
  }

  /**
   * Load keys from Firestore (decrypt with password)
   */
  private async loadKeysFromCloud(userId: string, password: string): Promise<nacl.BoxKeyPair | null> {
    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        console.log('📭 User document not found');
        return null;
      }
      
      const data = userDoc.data();
      
      if (!data?.encryptedPrivateKey || !data?.keySalt) {
        console.log('📭 No cloud backup found');
        return null;
      }
      
      // Derive decryption key from password
      const salt = decodeBase64(data.keySalt);
      const derivedKey = await this.deriveKeyFromPassword(password, salt);
      
      // Decrypt the secret key
      const secretKey = this.decryptWithKey(data.encryptedPrivateKey, derivedKey);
      
      if (!secretKey) {
        console.error('❌ Failed to decrypt cloud backup - wrong password?');
        return null;
      }
      
      // Reconstruct key pair
      const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
      
      console.log('📬 Loaded keys from cloud backup');
      return keyPair;
    } catch (error: any) {
      // Check if it's a permission error
      if (error.code === 'firestore/permission-denied') {
        console.error('❌ Permission denied accessing cloud backup');
        // This likely means user was signed out during the process
        throw new Error('Cannot access encryption keys - authentication issue');
      }
      
      console.error('❌ Error loading keys from cloud:', error);
      return null;
    }
  }

  /**
   * Save keys to local storage
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
      
      console.log('💾 Encryption keys saved to local storage');
    } catch (error) {
      console.error('❌ Failed to save encryption keys:', error);
      throw new Error('Failed to save encryption keys to storage');
    }
  }

  /**
   * Load keys from local storage
   */
  private async loadKeys(userId: string): Promise<nacl.BoxKeyPair | null> {
    try {
      const stored = await AsyncStorage.getItem(`encryption_keys_${userId}`);
      
      if (!stored) {
        console.log('📭 No local encryption keys found');
        return null;
      }
      
      const keys = JSON.parse(stored);
      
      console.log('📬 Found local encryption keys');
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