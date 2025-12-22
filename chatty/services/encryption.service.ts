// services/encryption.service.ts
import { SignalProtocolStore } from './signal-store';
import {
  KeyHelper,
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
} from '@privacyresearch/libsignal-protocol-typescript';

class EncryptionService {
  private store: SignalProtocolStore | null = null;
  private initialized = false;

  async initialize(userId: string) {
    if (this.initialized && this.store) return;
    
    this.store = new SignalProtocolStore(userId);
    await this.store.initialize();
    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.store || !this.initialized) {
      throw new Error('Encryption service not initialized. Call initialize() first.');
    }
  }

  // Generate keys for new user
  async generateKeys() {
    this.ensureInitialized();
    
    const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    const registrationId = KeyHelper.generateRegistrationId();
    const preKeys = await KeyHelper.generatePreKeys(0, 100);
    const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, 0);

    // Store locally
    await this.store!.saveIdentityKeyPair(identityKeyPair);
    await this.store!.saveRegistrationId(registrationId);
    
    // Store pre-keys
    for (const preKey of preKeys) {
      await this.store!.storePreKey(preKey.keyId, preKey.keyPair);
    }
    await this.store!.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

    // Return public keys to store in Firestore
    return {
      identityKey: this.arrayBufferToBase64(identityKeyPair.pubKey),
      registrationId,
      preKey: this.arrayBufferToBase64(preKeys[0].keyPair.pubKey),
      preKeyId: preKeys[0].keyId,
      signedPreKey: this.arrayBufferToBase64(signedPreKey.keyPair.pubKey),
      signedPreKeyId: signedPreKey.keyId,
      signedPreKeySignature: this.arrayBufferToBase64(signedPreKey.signature),
    };
  }

  // Build session with other user
  async buildSession(theirUserId: string, theirPublicKeys: any) {
    this.ensureInitialized();
    
    const address = new SignalProtocolAddress(theirUserId, 1);
    const sessionBuilder = new SessionBuilder(this.store!, address);
    
    await sessionBuilder.processPreKey({
      registrationId: theirPublicKeys.registrationId,
      identityKey: this.base64ToArrayBuffer(theirPublicKeys.identityKey),
      signedPreKey: {
        keyId: theirPublicKeys.signedPreKeyId,
        publicKey: this.base64ToArrayBuffer(theirPublicKeys.signedPreKey),
        signature: this.base64ToArrayBuffer(theirPublicKeys.signedPreKeySignature),
      },
      preKey: {
        keyId: theirPublicKeys.preKeyId,
        publicKey: this.base64ToArrayBuffer(theirPublicKeys.preKey),
      },
    });
  }

  // Encrypt message
  async encryptMessage(recipientId: string, plaintext: string): Promise<any> {
    this.ensureInitialized();
    
    const address = new SignalProtocolAddress(recipientId, 1);
    const sessionCipher = new SessionCipher(this.store!, address);
    
    const ciphertext = await sessionCipher.encrypt(
      new TextEncoder().encode(plaintext).buffer
    );
    
    return {
      type: ciphertext.type,
      body: this.arrayBufferToBase64(ciphertext.body!),
      registrationId: ciphertext.registrationId,
    };
  }

  // Decrypt message
  async decryptMessage(senderId: string, ciphertext: any): Promise<string> {
    this.ensureInitialized();
    
    const address = new SignalProtocolAddress(senderId, 1);
    const sessionCipher = new SessionCipher(this.store!, address);
    
    const messageBody = this.base64ToArrayBuffer(ciphertext.body);
    
    let plaintext: ArrayBuffer;
    if (ciphertext.type === 3) {
      // PreKey message
      plaintext = await sessionCipher.decryptPreKeyWhisperMessage(messageBody);
    } else {
      // Regular message
      plaintext = await sessionCipher.decryptWhisperMessage(messageBody);
    }
    
    return new TextDecoder().decode(plaintext);
  }

  // Helper: ArrayBuffer to Base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Helper: Base64 to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Check if session exists
  async hasSession(userId: string): Promise<boolean> {
    this.ensureInitialized();
    const address = new SignalProtocolAddress(userId, 1);
    const session = await this.store!.loadSession(address.toString());
    return session !== undefined;
  }
}

export default new EncryptionService();