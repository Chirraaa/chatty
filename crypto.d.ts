// crypto.d.ts
// Type declarations for our custom crypto extensions

interface CryptoExtended extends Crypto {
  randomBytes?: (length: number) => Uint8Array;
}

declare global {
  var crypto: CryptoExtended;
  
  interface Window {
    crypto: CryptoExtended;
  }
  
  namespace NodeJS {
    interface Global {
      crypto: CryptoExtended;
    }
  }
}

export {};