import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Encryption utility for sensitive data (API keys, tokens, etc.)
 * Uses AES-256-GCM for authenticated encryption
 */

/**
 * Get and validate the encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error(
      "ENCRYPTION_SECRET environment variable is required for API key encryption",
    );
  }

  if (secret.length < KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_SECRET must be at least ${KEY_LENGTH} characters long`,
    );
  }

  // Use first 32 bytes of secret as encryption key
  return Buffer.from(secret.slice(0, KEY_LENGTH), "utf-8");
}

/**
 * Encrypt a string value
 * @param text - Plain text to encrypt
 * @returns Object containing encrypted value, IV, and authentication tag
 */
export function encrypt(text: string): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
    };
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Decrypt an encrypted string
 * @param encrypted - Encrypted hex string
 * @param iv - Initialization vector (hex)
 * @param tag - Authentication tag (hex)
 * @returns Decrypted plain text
 */
export function decrypt(encrypted: string, iv: string, tag: string): string {
  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, "hex"),
    );

    decipher.setAuthTag(Buffer.from(tag, "hex"));

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Mask an API key for display (show only last 4 characters)
 * @param apiKey - Full API key
 * @returns Masked string (e.g., "re_••••••••5a3f")
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) {
    return "••••";
  }

  const lastFour = apiKey.slice(-4);
  const prefix = apiKey.includes("_") ? apiKey.split("_")[0] + "_" : "";
  const dotsCount = Math.min(apiKey.length - 4 - prefix.length, 10);

  return prefix + "•".repeat(dotsCount) + lastFour;
}

/**
 * Get last 4 characters of a string for storage/display
 * @param value - Full value
 * @returns Last 4 characters
 */
export function getLastFourChars(value: string): string {
  return value.slice(-4);
}
