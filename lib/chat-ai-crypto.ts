import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedChatAIKey {
  encryptedApiKey: string;
  apiKeyIV: string;
  apiKeyAuthTag: string;
}

function getEncryptionKey(): Buffer {
  const encodedKey = process.env.CHAT_AI_ENCRYPTION_KEY?.trim();
  if (!encodedKey) throw new Error('CHAT_AI_ENCRYPTION_KEY is not configured');

  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encodedKey) {
    throw new Error('CHAT_AI_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}

export function encryptChatAIKey(apiKey: string): EncryptedChatAIKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encryptedApiKey = Buffer.concat([
    cipher.update(apiKey, 'utf8'),
    cipher.final(),
  ]);
  return {
    encryptedApiKey: encryptedApiKey.toString('base64'),
    apiKeyIV: iv.toString('base64'),
    apiKeyAuthTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptChatAIKey(value: EncryptedChatAIKey): string {
  const iv = Buffer.from(value.apiKeyIV, 'base64');
  const authTag = Buffer.from(value.apiKeyAuthTag, 'base64');
  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error('Encrypted chat API key has invalid metadata');
  }

  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(Buffer.from(value.encryptedApiKey, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
