export interface AdminChatPublicIdentity {
  userId: string;
  publicKey: string;
}

export interface WrappedAdminChatKey {
  userId: string;
  encryptedKey: string;
}

export interface EncryptedAdminChatPayload {
  ciphertext: string;
  iv: string;
  wrappedKeys: WrappedAdminChatKey[];
  encryptedAttachment: ArrayBuffer | null;
  attachmentIv: string | null;
}

export interface AdminChatIdentity {
  publicKey: string;
  privateKey: CryptoKey;
}

interface StoredIdentity extends AdminChatIdentity {
  userId: string;
}

const keyDatabaseName = 'wifi-billing-admin-chat';
const keyStoreName = 'identities';

function toBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function openKeyDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Browser ini tidak mendukung penyimpanan kunci chat.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(keyDatabaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(keyStoreName)) {
        request.result.createObjectStore(keyStoreName, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka penyimpanan kunci chat.'));
  });
}

async function readStoredIdentity(userId: string): Promise<StoredIdentity | null> {
  const database = await openKeyDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(keyStoreName, 'readonly').objectStore(keyStoreName).get(userId);
      request.onsuccess = () => resolve((request.result as StoredIdentity | undefined) || null);
      request.onerror = () => reject(request.error || new Error('Gagal membaca kunci chat.'));
    });
  } finally {
    database.close();
  }
}

async function storeIdentity(identity: StoredIdentity): Promise<void> {
  const database = await openKeyDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(keyStoreName, 'readwrite');
      transaction.objectStore(keyStoreName).put(identity);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Gagal menyimpan kunci chat.'));
      transaction.onabort = () => reject(transaction.error || new Error('Penyimpanan kunci chat dibatalkan.'));
    });
  } finally {
    database.close();
  }
}

export async function getOrCreateAdminChatIdentity(
  userId: string,
  registeredPublicKey: string | null,
): Promise<AdminChatIdentity> {
  const stored = await readStoredIdentity(userId);
  if (stored) {
    if (registeredPublicKey && stored.publicKey !== registeredPublicKey) {
      throw new Error('Kunci chat di browser ini berbeda dengan kunci akun. Gunakan browser tempat kunci dibuat.');
    }
    return stored;
  }
  if (registeredPublicKey) {
    throw new Error('Kunci privat tidak ditemukan di browser ini. Chat lama tidak dapat dipulihkan tanpa kunci tersebut.');
  }

  const pair = await crypto.subtle.generateKey({
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  }, true, ['encrypt', 'decrypt']) as CryptoKeyPair;
  const [publicDer, privateDer] = await Promise.all([
    crypto.subtle.exportKey('spki', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
  ]);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateDer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
  const identity = { userId, publicKey: toBase64(publicDer), privateKey };
  await storeIdentity(identity);
  return identity;
}

export async function encryptAdminChatPayload(
  content: unknown,
  recipients: AdminChatPublicIdentity[],
  attachment?: ArrayBuffer,
): Promise<EncryptedAdminChatPayload> {
  if (recipients.length < 2 || new Set(recipients.map(({ userId }) => userId)).size !== recipients.length) {
    throw new Error('Kunci pengirim dan penerima chat tidak lengkap.');
  }

  const messageKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(content));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, messageKey, plaintext);
  const rawMessageKey = await crypto.subtle.exportKey('raw', messageKey);
  const wrappedKeys = await Promise.all(recipients.map(async (recipient) => {
    const publicKey = await crypto.subtle.importKey(
      'spki',
      fromBase64(recipient.publicKey),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
    const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawMessageKey);
    return { userId: recipient.userId, encryptedKey: toBase64(encryptedKey) };
  }));

  let encryptedAttachment: ArrayBuffer | null = null;
  let attachmentIv: string | null = null;
  if (attachment) {
    const mediaIv = crypto.getRandomValues(new Uint8Array(12));
    encryptedAttachment = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: mediaIv }, messageKey, attachment);
    attachmentIv = toBase64(mediaIv.buffer);
  }

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv.buffer),
    wrappedKeys,
    encryptedAttachment,
    attachmentIv,
  };
}

export async function decryptAdminChatPayload<T>(
  payload: Pick<EncryptedAdminChatPayload, 'ciphertext' | 'iv' | 'wrappedKeys'>,
  userId: string,
  privateKey: CryptoKey,
): Promise<{ content: T; messageKey: CryptoKey }> {
  const wrappedKey = payload.wrappedKeys.find((key) => key.userId === userId);
  if (!wrappedKey) throw new Error('Pesan ini tidak dienkripsi untuk akun Anda.');

  const rawMessageKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    fromBase64(wrappedKey.encryptedKey),
  );
  const messageKey = await crypto.subtle.importKey('raw', rawMessageKey, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) },
    messageKey,
    fromBase64(payload.ciphertext),
  );
  return { content: JSON.parse(new TextDecoder().decode(plaintext)) as T, messageKey };
}

export async function decryptAdminChatAttachment(
  ciphertext: ArrayBuffer,
  iv: string,
  messageKey: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, messageKey, ciphertext);
}