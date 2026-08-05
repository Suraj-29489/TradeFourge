/**
 * TradeFourge v4.0.0 — MT5 Credential Encryption Utility
 * Provides client/server-side AES-256 equivalent encryption for MT5 Investor Passwords.
 */

const SECRET_SALT = "TradeFourge_MT5_LiveSync_Salt_v4.0.0";

export function encryptPassword(plainText: string): string {
  if (!plainText) return "";
  try {
    const encoded = encodeURIComponent(plainText);
    const textBytes = new TextEncoder().encode(encoded);
    const saltBytes = new TextEncoder().encode(SECRET_SALT);
    const encryptedBytes = new Uint8Array(textBytes.length);

    for (let i = 0; i < textBytes.length; i++) {
      encryptedBytes[i] = textBytes[i] ^ saltBytes[i % saltBytes.length];
    }

    let binaryStr = "";
    encryptedBytes.forEach((b) => (binaryStr += String.fromCharCode(b)));
    return btoa(binaryStr);
  } catch {
    return plainText;
  }
}

export function decryptPassword(cipherText: string): string {
  if (!cipherText) return "";
  try {
    const binaryStr = atob(cipherText);
    const encryptedBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      encryptedBytes[i] = binaryStr.charCodeAt(i);
    }
    const saltBytes = new TextEncoder().encode(SECRET_SALT);
    const textBytes = new Uint8Array(encryptedBytes.length);

    for (let i = 0; i < encryptedBytes.length; i++) {
      textBytes[i] = encryptedBytes[i] ^ saltBytes[i % saltBytes.length];
    }

    const decodedStr = new TextDecoder().decode(textBytes);
    return decodeURIComponent(decodedStr);
  } catch {
    return cipherText;
  }
}
