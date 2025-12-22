// services/signal-store.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KeyPairType,
  PreKeyType,
  SessionRecordType,
  SignedPreKeyPairType,
} from '@privacyresearch/libsignal-protocol-typescript';

export class SignalProtocolStore {
  private userId: string;
  private prefix: string;

  constructor(userId: string) {
    this.userId = userId;
    this.prefix = `signal_${userId}_`;
  }

  async initialize() {
    // Nothing specific to initialize
  }

  // Identity Key Pair
  async saveIdentityKeyPair(keyPair: KeyPairType<ArrayBuffer>): Promise<void> {
    await AsyncStorage.setItem(
      `${this.prefix}identityKey`,
      JSON.stringify({
        pubKey: Array.from(new Uint8Array(keyPair.pubKey)),
        privKey: Array.from(new Uint8Array(keyPair.privKey)),
      })
    );
  }

  async loadIdentityKeyPair(): Promise<KeyPairType<ArrayBuffer> | undefined> {
    const data = await AsyncStorage.getItem(`${this.prefix}identityKey`);
    if (!data) return undefined;
    
    const parsed = JSON.parse(data);
    return {
      pubKey: new Uint8Array(parsed.pubKey).buffer,
      privKey: new Uint8Array(parsed.privKey).buffer,
    };
  }

  // Registration ID
  async saveRegistrationId(registrationId: number): Promise<void> {
    await AsyncStorage.setItem(
      `${this.prefix}registrationId`,
      registrationId.toString()
    );
  }

  async loadRegistrationId(): Promise<number | undefined> {
    const data = await AsyncStorage.getItem(`${this.prefix}registrationId`);
    return data ? parseInt(data, 10) : undefined;
  }

  // Pre Keys - Accept string or number
  async storePreKey(keyId: string | number, keyPair: KeyPairType<ArrayBuffer>): Promise<void> {
    await AsyncStorage.setItem(
      `${this.prefix}preKey_${keyId}`,
      JSON.stringify({
        pubKey: Array.from(new Uint8Array(keyPair.pubKey)),
        privKey: Array.from(new Uint8Array(keyPair.privKey)),
      })
    );
  }

  async loadPreKey(keyId: string | number): Promise<KeyPairType<ArrayBuffer> | undefined> {
    const data = await AsyncStorage.getItem(`${this.prefix}preKey_${keyId}`);
    if (!data) return undefined;
    
    const parsed = JSON.parse(data);
    return {
      pubKey: new Uint8Array(parsed.pubKey).buffer,
      privKey: new Uint8Array(parsed.privKey).buffer,
    };
  }

  async removePreKey(keyId: string | number): Promise<void> {
    await AsyncStorage.removeItem(`${this.prefix}preKey_${keyId}`);
  }

  // Signed Pre Keys - Accept string or number
  async storeSignedPreKey(keyId: string | number, keyPair: KeyPairType<ArrayBuffer>): Promise<void> {
    await AsyncStorage.setItem(
      `${this.prefix}signedPreKey_${keyId}`,
      JSON.stringify({
        pubKey: Array.from(new Uint8Array(keyPair.pubKey)),
        privKey: Array.from(new Uint8Array(keyPair.privKey)),
      })
    );
  }

  async loadSignedPreKey(keyId: string | number): Promise<KeyPairType<ArrayBuffer> | undefined> {
    const data = await AsyncStorage.getItem(`${this.prefix}signedPreKey_${keyId}`);
    if (!data) return undefined;
    
    const parsed = JSON.parse(data);
    return {
      pubKey: new Uint8Array(parsed.pubKey).buffer,
      privKey: new Uint8Array(parsed.privKey).buffer,
    };
  }

  async removeSignedPreKey(keyId: string | number): Promise<void> {
    await AsyncStorage.removeItem(`${this.prefix}signedPreKey_${keyId}`);
  }

  // Sessions
  async storeSession(
    encodedAddress: string,
    record: SessionRecordType
  ): Promise<void> {
    await AsyncStorage.setItem(
      `${this.prefix}session_${encodedAddress}`,
      JSON.stringify(record)
    );
  }

  async loadSession(encodedAddress: string): Promise<SessionRecordType | undefined> {
    const data = await AsyncStorage.getItem(`${this.prefix}session_${encodedAddress}`);
    return data ? JSON.parse(data) : undefined;
  }

  async removeSession(encodedAddress: string): Promise<void> {
    await AsyncStorage.removeItem(`${this.prefix}session_${encodedAddress}`);
  }

  async removeAllSessions(encodedAddress: string): Promise<void> {
    // In a full implementation, you'd remove all device sessions
    await this.removeSession(encodedAddress);
  }

  // Identity
  async saveIdentity(
    encodedAddress: string,
    publicKey: ArrayBuffer
  ): Promise<boolean> {
    const existing = await this.loadIdentity(encodedAddress);
    await AsyncStorage.setItem(
      `${this.prefix}identity_${encodedAddress}`,
      JSON.stringify(Array.from(new Uint8Array(publicKey)))
    );
    return existing !== undefined;
  }

  async isTrustedIdentity(
    encodedAddress: string,
    publicKey: ArrayBuffer
  ): Promise<boolean> {
    const trusted = await this.loadIdentity(encodedAddress);
    if (!trusted) return true;
    return this.arrayBuffersEqual(trusted, publicKey);
  }

  async loadIdentity(encodedAddress: string): Promise<ArrayBuffer | undefined> {
    const data = await AsyncStorage.getItem(`${this.prefix}identity_${encodedAddress}`);
    if (!data) return undefined;
    
    const parsed = JSON.parse(data);
    return new Uint8Array(parsed).buffer;
  }

  // Helper methods
  private arrayBuffersEqual(buf1: ArrayBuffer, buf2: ArrayBuffer): boolean {
    const arr1 = new Uint8Array(buf1);
    const arr2 = new Uint8Array(buf2);
    
    if (arr1.length !== arr2.length) return false;
    
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    
    return true;
  }

  // Direction (for Signal Protocol)
  Direction = {
    SENDING: 1,
    RECEIVING: 2,
  };

  // Required interface methods
  getIdentityKeyPair = this.loadIdentityKeyPair;
  getLocalRegistrationId = this.loadRegistrationId;
  getPreKey = this.loadPreKey;
  getSignedPreKey = this.loadSignedPreKey;
}