const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes IV
const AUTH_TAG_LENGTH = 16; // 16 bytes Auth Tag

/**
 * Gets a 32-byte Key Buffer from environment master key or fallback
 */
function getMasterKey() {
  const envKey = process.env.ENCRYPTION_MASTER_KEY || 'default_32_byte_secret_key_hiddenvault_2026';
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypts a buffer using AES-256-GCM and packs [12-byte IV][16-byte AuthTag][Ciphertext]
 * @param {Buffer} buffer - Plaintext file content
 * @returns {Object} { encryptedBuffer, ivHex, authTagHex }
 */
function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack self-contained payload: [IV (12B)] [AuthTag (16B)] [Ciphertext]
  const packedPayload = Buffer.concat([iv, authTag, ciphertext]);

  return {
    encryptedBuffer: packedPayload,
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex')
  };
}

/**
 * Decrypts a buffer using AES-256-GCM (Supports packed payloads or explicit IV/AuthTag)
 * @param {Buffer} buffer - Encrypted file content or packed payload
 * @param {string} [ivHex] - Optional Hex string IV
 * @param {string} [authTagHex] - Optional Hex string Auth Tag
 * @returns {Buffer} Decrypted plaintext buffer
 */
function decryptBuffer(buffer, ivHex = null, authTagHex = null) {
  const key = getMasterKey();

  // 1. Decrypt using explicit IV and AuthTag if provided
  if (ivHex && authTagHex) {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      // If packed payload was passed with explicit IV, strip header
      let ciphertext = buffer;
      if (buffer.length > IV_LENGTH + AUTH_TAG_LENGTH) {
        const potentialIv = buffer.subarray(0, IV_LENGTH);
        if (potentialIv.equals(iv)) {
          ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
        }
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (e) {
      console.warn('Explicit IV/AuthTag decryption fallback:', e.message);
    }
  }

  // 2. Decrypt self-contained packed payload [IV (12B)] [AuthTag (16B)] [Ciphertext]
  if (buffer.length > IV_LENGTH + AUTH_TAG_LENGTH) {
    try {
      const iv = buffer.subarray(0, IV_LENGTH);
      const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (e) {
      console.warn('Packed payload decryption notice:', e.message);
    }
  }

  // 3. Return raw buffer if unencrypted image or fallback
  return buffer;
}

/**
 * Hash a string (e.g., secret PIN) using SHA-256
 */
function hashSHA256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

module.exports = {
  encryptBuffer,
  decryptBuffer,
  hashSHA256
};
