export interface AdminChatPublicIdentity {
  userId: string;
  publicKey: string;
  recoveryPublicKey?: string;
  recoveryKeyId?: string;
}

export interface WrappedAdminChatKey {
  userId: string;
  keyId?: string;
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
  keyVersion?: number;
  publicKey: string;
  privateKey?: CryptoKey;
  recoveryPublicKey?: string;
  recoveryKeyId?: string;
  recoveryPrivateKey?: CryptoKey;
  recoveryBackup?: AdminChatRecoveryBackup;
  migrationSourceRecoveryKeyId?: string;
  migrationSourceRecoveryPrivateKey?: CryptoKey;
}

interface StoredIdentity extends AdminChatIdentity {
  userId: string;
}

export interface AdminChatRecoveryBackup {
  version: 1;
  recoveryPublicKey: string;
  recoveryKeyId: string;
  ciphertext: string;
  salt: string;
  iv: string;
}

const keyDatabaseName = 'wifi-billing-admin-chat';
const keyStoreName = 'identities';
const RECOVERY_KDF_ITERATIONS = 600_000;

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

export async function getStoredAdminChatIdentity(userId: string): Promise<AdminChatIdentity | null> {
  const stored = await readStoredIdentity(userId);
  if (!stored) return null;
  const { userId: _userId, ...identity } = stored;
  return identity;
}

async function deriveRecoveryKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: RECOVERY_KDF_ITERATIONS, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function copyBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

export async function encryptAdminChatPrivateKeyBackup(
  userId: string,
  recoveryPublicKey: string,
  recoveryKeyId: string,
  privateDer: ArrayBuffer,
  password: string,
): Promise<AdminChatRecoveryBackup> {
  if (password.length < 10) throw new Error('Sandi Chat minimal 10 karakter.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveRecoveryKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv,
    additionalData: new TextEncoder().encode(`${userId}:${recoveryKeyId}`),
  }, wrappingKey, privateDer);
  return {
    version: 1,
    recoveryPublicKey,
    recoveryKeyId,
    ciphertext: toBase64(ciphertext),
    salt: toBase64(copyBuffer(salt)),
    iv: toBase64(copyBuffer(iv)),
  };
}

export async function decryptAdminChatPrivateKeyBackup(
  userId: string,
  backup: AdminChatRecoveryBackup,
  password: string,
): Promise<ArrayBuffer> {
  if (backup.version !== 1 || backup.ciphertext.length > 4096) throw new Error('Backup pemulihan tidak valid.');
  const salt = fromBase64(backup.salt);
  const iv = fromBase64(backup.iv);
  const wrappingKey = await deriveRecoveryKey(password, salt);
  return crypto.subtle.decrypt({
    name: 'AES-GCM',
    iv,
    additionalData: new TextEncoder().encode(`${userId}:${backup.recoveryKeyId}`),
  }, wrappingKey, fromBase64(backup.ciphertext));
}

export async function createAdminChatRecoveryIdentity(
  userId: string,
  password: string,
): Promise<{ identity: AdminChatIdentity; backup: AdminChatRecoveryBackup }> {
  const stored = await readStoredIdentity(userId);
  if (!stored || (!stored.privateKey && !stored.recoveryPrivateKey)) {
    throw new Error('Kunci chat tidak tersedia untuk menyiapkan backup di browser ini.');
  }
  if (password.length < 10) throw new Error('Sandi Chat minimal 10 karakter.');

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
  const recoveryPublicKey = toBase64(publicDer);
  const recoveryKeyId = `recovery-${crypto.randomUUID()}`;
  const backup = await encryptAdminChatPrivateKeyBackup(userId, recoveryPublicKey, recoveryKeyId, privateDer, password);
  const recoveryPrivateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateDer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
  const identity: StoredIdentity = {
    ...stored,
    userId,
    recoveryPublicKey,
    recoveryKeyId,
    recoveryPrivateKey,
    recoveryBackup: backup,
    migrationSourceRecoveryKeyId: stored.recoveryKeyId,
    migrationSourceRecoveryPrivateKey: stored.recoveryPrivateKey,
  };
  await storeIdentity(identity);

  return {
    identity,
    backup,
  };
}

export async function restoreAdminChatRecoveryIdentity(
  userId: string,
  backup: AdminChatRecoveryBackup,
  password: string,
  primaryPublicKey: string,
): Promise<AdminChatIdentity> {
  try {
    const privateDer = await decryptAdminChatPrivateKeyBackup(userId, backup, password);
    const recoveryPrivateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateDer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt'],
    );
    const recoveryPublicKeyObject = await crypto.subtle.importKey(
      'spki',
      fromBase64(backup.recoveryPublicKey),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const encryptedChallenge = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recoveryPublicKeyObject, challenge);
    const decryptedChallenge = new Uint8Array(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, recoveryPrivateKey, encryptedChallenge));
    if (decryptedChallenge.some((value, index) => value !== challenge[index])) throw new Error('Kunci pemulihan tidak cocok.');

    const stored = await readStoredIdentity(userId);
    const identity: StoredIdentity = {
      ...(stored || { userId, publicKey: primaryPublicKey }),
      userId,
      publicKey: primaryPublicKey,
      recoveryPublicKey: backup.recoveryPublicKey,
      recoveryKeyId: backup.recoveryKeyId,
      recoveryPrivateKey,
      recoveryBackup: backup,
      migrationSourceRecoveryKeyId: undefined,
      migrationSourceRecoveryPrivateKey: undefined,
    };
    await storeIdentity(identity);
    return identity;
  } catch {
    throw new Error('Sandi Chat salah atau backup pemulihan rusak.');
  }
}

export async function getOrCreateAdminChatIdentity(
  userId: string,
  registeredPublicKey: string | null,
  keyVersion = 0,
): Promise<AdminChatIdentity> {
  const stored = await readStoredIdentity(userId);
  if (stored && (stored.keyVersion || 0) === keyVersion) {
    if (registeredPublicKey && stored.publicKey !== registeredPublicKey) {
      throw new Error('Kunci chat di browser ini berbeda dengan kunci akun. Gunakan browser tempat kunci dibuat.');
    }
    return stored;
  }
  if (registeredPublicKey) {
    throw new Error('Kunci akun belum direset sepenuhnya. Muat ulang halaman dan coba lagi.');
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
  const identity = { userId, keyVersion, publicKey: toBase64(publicDer), privateKey };
  await storeIdentity(identity);
  return identity;
}

export async function clearAdminChatMigrationSource(userId: string): Promise<void> {
  const stored = await readStoredIdentity(userId);
  if (!stored) return;
  const identity: StoredIdentity = {
    ...stored,
    migrationSourceRecoveryKeyId: undefined,
    migrationSourceRecoveryPrivateKey: undefined,
  };
  await storeIdentity(identity);
}

export async function encryptAdminChatPayload(
  content: unknown,
  recipients: AdminChatPublicIdentity[],
  attachment?: ArrayBuffer,
): Promise<EncryptedAdminChatPayload> {
  if (recipients.length !== 2 || new Set(recipients.map(({ userId }) => userId)).size !== recipients.length) {
    throw new Error('Kunci pengirim dan penerima chat tidak lengkap.');
  }

  const messageKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(content));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, messageKey, plaintext);
  const rawMessageKey = await crypto.subtle.exportKey('raw', messageKey);
  const wrappedKeys = await Promise.all(recipients.flatMap((recipient) => [
    { userId: recipient.userId, keyId: 'primary' as const, publicKey: recipient.publicKey },
    ...(recipient.recoveryPublicKey ? [{ userId: recipient.userId, keyId: recipient.recoveryKeyId || 'recovery', publicKey: recipient.recoveryPublicKey }] : []),
  ]).map(async (recipient) => {
    const publicKey = await crypto.subtle.importKey(
      'spki',
      fromBase64(recipient.publicKey),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
    const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawMessageKey);
    return { userId: recipient.userId, keyId: recipient.keyId, encryptedKey: toBase64(encryptedKey) };
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
  identity: AdminChatIdentity,
): Promise<{ content: T; messageKey: CryptoKey }> {
  const candidates = [
    { keyId: 'primary', privateKey: identity.privateKey },
    { keyId: identity.recoveryKeyId || 'recovery', privateKey: identity.recoveryPrivateKey },
    { keyId: identity.migrationSourceRecoveryKeyId || '', privateKey: identity.migrationSourceRecoveryPrivateKey },
  ].filter((entry): entry is { keyId: string; privateKey: CryptoKey } => Boolean(entry.privateKey));
  let rawMessageKey: ArrayBuffer | null = null;
  for (const candidate of candidates) {
    const wrappedKey = payload.wrappedKeys.find((key) => key.userId === userId
      && (key.keyId || 'primary') === candidate.keyId);
    if (!wrappedKey) continue;
    try {
      rawMessageKey = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        candidate.privateKey,
        fromBase64(wrappedKey.encryptedKey),
      );
      break;
    } catch {
      continue;
    }
  }
  if (!rawMessageKey) throw new Error('Pesan ini tidak dapat dibuka dengan kunci perangkat atau pemulihan akun.');
  const messageKey = await crypto.subtle.importKey('raw', rawMessageKey, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) },
    messageKey,
    fromBase64(payload.ciphertext),
  );
  return { content: JSON.parse(new TextDecoder().decode(plaintext)) as T, messageKey };
}

export async function rewrapAdminChatMessageKey(
  wrappedKeys: WrappedAdminChatKey[],
  userId: string,
  identity: AdminChatIdentity,
  recoveryPublicKey: string,
): Promise<string> {
  const sources = [
    { keyId: 'primary', privateKey: identity.privateKey },
    { keyId: identity.recoveryKeyId || 'recovery', privateKey: identity.recoveryPrivateKey },
    { keyId: identity.migrationSourceRecoveryKeyId || '', privateKey: identity.migrationSourceRecoveryPrivateKey },
  ].filter((source): source is { keyId: string; privateKey: CryptoKey } => Boolean(source.privateKey));
  let rawMessageKey: ArrayBuffer | null = null;
  for (const source of sources) {
    const wrappedKey = wrappedKeys.find((key) => key.userId === userId && (key.keyId || 'primary') === source.keyId);
    if (!wrappedKey) continue;
    try {
      rawMessageKey = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        source.privateKey,
        fromBase64(wrappedKey.encryptedKey),
      );
      break;
    } catch {
      continue;
    }
  }
  if (!rawMessageKey) throw new Error('Kunci pesan lama tidak ditemukan untuk migrasi.');
  const publicKey = await crypto.subtle.importKey(
    'spki',
    fromBase64(recoveryPublicKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
  return toBase64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawMessageKey));
}

export async function decryptAdminChatAttachment(
  ciphertext: ArrayBuffer,
  iv: string,
  messageKey: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, messageKey, ciphertext);
}