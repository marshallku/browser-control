/**
 * Shared crypto utilities for credential encryption/decryption.
 * Uses Web Crypto API with AES-256-GCM + PBKDF2 key derivation.
 */

const PBKDF2_ITERATIONS = 600000;
const SALT_LEN = 32;
const IV_LEN = 12;

async function deriveKey(masterPassword, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a JSON-serializable object.
 * Returns { salt, iv, ciphertext } as base64 strings.
 */
async function encryptData(masterPassword, data) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(masterPassword, salt);

  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(data)),
  );

  return {
    salt: uint8ToBase64(salt),
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypt data encrypted by encryptData.
 * Returns the original JSON object.
 * Throws on wrong password or tampered data.
 */
async function decryptData(masterPassword, encrypted) {
  const salt = base64ToUint8(encrypted.salt);
  const iv = base64ToUint8(encrypted.iv);
  const ciphertext = base64ToUint8(encrypted.ciphertext);
  const key = await deriveKey(masterPassword, salt);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(plainBuffer));
}

function uint8ToBase64(arr) {
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64) {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

// Export for use in both background.js and credentials.js
if (typeof globalThis.__cryptoUtils === "undefined") {
  globalThis.__cryptoUtils = { encryptData, decryptData };
}
