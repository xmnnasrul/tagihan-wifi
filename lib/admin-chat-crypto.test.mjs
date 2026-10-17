import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { decryptAdminChatAttachment, decryptAdminChatPayload, encryptAdminChatPayload } from './admin-chat-crypto.ts';

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
  const content = {
    text: 'pesan pribadi',
    replyTo: { messageId: 'previous-id', senderId: 'recipient-id', text: 'balasan sebelumnya' },
    media: { fileName: 'gambar.png', contentType: 'image/png' },
  };
  const media = new TextEncoder().encode('data gambar privat').buffer;
  const payload = await encryptAdminChatPayload(content, [sender, recipient], media);

  assert.equal(payload.ciphertext.includes('pesan pribadi'), false);
  const fromSender = await decryptAdminChatPayload(payload, sender.userId, sender.privateKey);
  const fromRecipient = await decryptAdminChatPayload(payload, recipient.userId, recipient.privateKey);
  assert.deepEqual(fromSender.content, content);
  assert.deepEqual(fromRecipient.content, content);
  assert.equal(payload.encryptedAttachment.byteLength > media.byteLength, true);
  assert.deepEqual(
    Buffer.from(await decryptAdminChatAttachment(payload.encryptedAttachment, payload.attachmentIv, fromRecipient.messageKey)),
    Buffer.from(media),
  );

  const outsider = await createIdentity('outsider-id');
  await assert.rejects(decryptAdminChatPayload(payload, outsider.userId, outsider.privateKey));
});