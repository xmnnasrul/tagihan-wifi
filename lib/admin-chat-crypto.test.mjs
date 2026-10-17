import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  decryptAdminChatAttachment, decryptAdminChatPayload, decryptAdminChatPrivateKeyBackup,
  encryptAdminChatPayload, encryptAdminChatPrivateKeyBackup, rewrapAdminChatMessageKey,
} from './admin-chat-crypto.ts';

globalThis.crypto ??= webcrypto;

async function createIdentity(userId) {
  const keyPair = await crypto.subtle.generateKey({
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  }, true, ['encrypt', 'decrypt']);
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  return {
    userId,
    publicKey: Buffer.from(spki).toString('base64'),
    privateKey: keyPair.privateKey,
  };
}

test('only either DM participant can decrypt text, reply metadata, and media', async () => {
  const sender = await createIdentity('sender-id');
  const recipient = await createIdentity('recipient-id');
  const senderRecovery = await createIdentity('sender-recovery');
  const recipientRecovery = await createIdentity('recipient-recovery');
  const senderWithRecovery = { ...sender, recoveryPublicKey: senderRecovery.publicKey, recoveryPrivateKey: senderRecovery.privateKey };
  const recipientWithRecovery = { ...recipient, recoveryPublicKey: recipientRecovery.publicKey, recoveryPrivateKey: recipientRecovery.privateKey };
  const content = {
    text: 'pesan pribadi',
    replyTo: { messageId: 'previous-id', senderId: 'recipient-id', text: 'balasan sebelumnya' },
    media: { fileName: 'gambar.png', contentType: 'image/png' },
  };
  const media = new TextEncoder().encode('data gambar privat').buffer;
  const payload = await encryptAdminChatPayload(content, [senderWithRecovery, recipientWithRecovery], media);

  assert.equal(payload.ciphertext.includes('pesan pribadi'), false);
  const fromSender = await decryptAdminChatPayload(payload, sender.userId, senderWithRecovery);
  const fromRecipient = await decryptAdminChatPayload(payload, recipient.userId, recipientWithRecovery);
  const fromRecoveryDevice = await decryptAdminChatPayload(payload, sender.userId, {
    userId: sender.userId,
    publicKey: sender.publicKey,
    recoveryPublicKey: senderRecovery.publicKey,
    recoveryPrivateKey: senderRecovery.privateKey,
  });
  assert.deepEqual(fromSender.content, content);
  assert.deepEqual(fromRecipient.content, content);
  assert.deepEqual(fromRecoveryDevice.content, content);
  assert.equal(payload.encryptedAttachment.byteLength > media.byteLength, true);
  assert.deepEqual(
    Buffer.from(await decryptAdminChatAttachment(payload.encryptedAttachment, payload.attachmentIv, fromRecipient.messageKey)),
    Buffer.from(media),
  );

  const outsider = await createIdentity('outsider-id');
  await assert.rejects(decryptAdminChatPayload(payload, outsider.userId, outsider));
});

test('rewrapping a message key preserves access for a recovery identity', async () => {
  const sender = await createIdentity('sender-id');
  const recipient = await createIdentity('recipient-id');
  const recovery = await createIdentity('sender-recovery');
  const content = { text: 'riwayat tetap terbaca', replyTo: null, media: null };
  const payload = await encryptAdminChatPayload(content, [sender, recipient]);
  const encryptedRecoveryKey = await rewrapAdminChatMessageKey(
    payload.wrappedKeys,
    sender.userId,
    sender,
    recovery.publicKey,
  );
  const migratedPayload = {
    ...payload,
    wrappedKeys: [...payload.wrappedKeys, { userId: sender.userId, keyId: 'recovery', encryptedKey: encryptedRecoveryKey }],
  };
  const restored = await decryptAdminChatPayload(migratedPayload, sender.userId, {
    userId: sender.userId,
    publicKey: sender.publicKey,
    recoveryPublicKey: recovery.publicKey,
    recoveryPrivateKey: recovery.privateKey,
  });
  assert.deepEqual(restored.content, content);
});

test('recovery backup only opens with the correct password and account id', async () => {
  const keyPair = await crypto.subtle.generateKey({
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  }, true, ['encrypt', 'decrypt']);
  const privateDer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const recoveryPublicDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const recoveryPublicKey = Buffer.from(recoveryPublicDer).toString('base64');
  const backup = await encryptAdminChatPrivateKeyBackup('account-one', recoveryPublicKey, 'recovery-test', privateDer, 'a-long-chat-password');
  const restoredPrivateKey = await decryptAdminChatPrivateKeyBackup('account-one', backup, 'a-long-chat-password');

  assert.deepEqual(Buffer.from(restoredPrivateKey), Buffer.from(privateDer));
  await assert.rejects(decryptAdminChatPrivateKeyBackup('account-one', backup, 'wrong-password'));
  await assert.rejects(decryptAdminChatPrivateKeyBackup('account-two', backup, 'a-long-chat-password'));
});

test('rotating the recovery key preserves old access and unlocks history with the new key', async () => {
  const sender = await createIdentity('sender-id');
  const recipient = await createIdentity('recipient-id');
  const oldRecovery = await createIdentity('sender-recovery-old');
  const newRecovery = await createIdentity('sender-recovery-new');
  const content = { text: 'pesan sebelum rotasi', replyTo: null, media: null };
  const payload = await encryptAdminChatPayload(content, [
    { ...sender, recoveryPublicKey: oldRecovery.publicKey, recoveryKeyId: 'recovery-old' },
    recipient,
  ]);
  const oldIdentity = {
    userId: sender.userId,
    publicKey: sender.publicKey,
    recoveryPublicKey: oldRecovery.publicKey,
    recoveryKeyId: 'recovery-old',
    recoveryPrivateKey: oldRecovery.privateKey,
  };
  const newIdentity = {
    userId: sender.userId,
    publicKey: sender.publicKey,
    recoveryPublicKey: newRecovery.publicKey,
    recoveryKeyId: 'recovery-new',
    recoveryPrivateKey: newRecovery.privateKey,
    migrationSourceRecoveryKeyId: 'recovery-old',
    migrationSourceRecoveryPrivateKey: oldRecovery.privateKey,
  };
  const encryptedRecoveryKey = await rewrapAdminChatMessageKey(
    payload.wrappedKeys,
    sender.userId,
    newIdentity,
    newRecovery.publicKey,
  );
  const migratedPayload = {
    ...payload,
    wrappedKeys: [...payload.wrappedKeys, { userId: sender.userId, keyId: 'recovery-new', encryptedKey: encryptedRecoveryKey }],
  };

  const fromNewRecovery = await decryptAdminChatPayload(migratedPayload, sender.userId, newIdentity);
  assert.deepEqual(fromNewRecovery.content, content);
  const fromOldRecovery = await decryptAdminChatPayload(migratedPayload, sender.userId, oldIdentity);
  assert.deepEqual(fromOldRecovery.content, content);
});