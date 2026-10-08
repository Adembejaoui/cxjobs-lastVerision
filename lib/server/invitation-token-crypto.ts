import crypto from "crypto";

const ENCRYPTION_KEY_BASE64 = process.env.INVITATION_TOKEN_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY_BASE64) {
  throw new Error(
    "INVITATION_TOKEN_ENCRYPTION_KEY environment variable is required. Generate one with: openssl rand -base64 32"
  );
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_BASE64, "base64");

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error("INVITATION_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  const result = Buffer.concat([iv, ciphertext, authTag]);

  return result.toString("base64");
}

export function decryptToken(ciphertextBase64: string): string {
  const data = Buffer.from(ciphertextBase64, "base64");

  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}