import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ADMIN_CHAT_RETENTION_DAYS, ADMIN_CHAT_UPLOAD_CHUNK_SIZE, getAdminChatExpiry, isAdminChatMediaType } from './admin-chat-constants.ts';
import { ADMIN_CHAT_WALLPAPERS } from './admin-chat-wallpaper.ts';
import { serializeAdminChatMessage } from './admin-chat-serialization.ts';

test('chat offers six built-in wallpapers, including local scenic photos', async () => {
  assert.equal(Object.keys(ADMIN_CHAT_WALLPAPERS).length, 6);
  for (const filename of ['mountain-lake.jpg', 'alpine-lake.jpg']) {
    const image = await readFile(new URL(`../public/images/chat-wallpapers/${filename}`, import.meta.url));
    assert.ok(image.byteLength > 0);
  }
});

test('admin chat messages and media expire after 15 days', async () => {
  const createdAt = new Date('2026-10-16T12:00:00.000Z');
  assert.equal(ADMIN_CHAT_RETENTION_DAYS, 15);
  assert.equal(getAdminChatExpiry(createdAt).getTime(), createdAt.getTime() + 15 * 24 * 60 * 60 * 1000);

  const messageSchema = await readFile(new URL('./models/AdminChatMessage.ts', import.meta.url), 'utf8');
  const mediaSchema = await readFile(new URL('./models/AdminChatMediaChunk.ts', import.meta.url), 'utf8');
  assert.ok(messageSchema.includes('AdminChatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })'));
  assert.ok(mediaSchema.includes('AdminChatMediaChunkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })'));
});

test('encrypted admin chat media uses small upload chunks', () => {
  assert.equal(ADMIN_CHAT_UPLOAD_CHUNK_SIZE, 1024 * 1024);
});

test('chat media types permit supported audio attachments but reject unsafe or unknown audio', () => {
  assert.equal(isAdminChatMediaType('audio/webm;codecs=opus'), true);
  assert.equal(isAdminChatMediaType('audio/ogg'), true);
  assert.equal(isAdminChatMediaType('audio/mpeg'), true);
  assert.equal(isAdminChatMediaType('audio/x-wav'), false);
  assert.equal(isAdminChatMediaType('image/svg+xml'), false);
});

test('serializes ciphertext and encrypted attachment metadata from a Mongoose document', () => {
  const attachment = Object.defineProperties({}, {
    uploadId: { value: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    size: { value: 512 },
    totalChunks: { value: 1 },
    iv: { value: 'AAAAAAAAAAAAAAAA' },
  });
  const source = {
    _id: { toString: () => 'message-id' },
    senderId: { toString: () => 'sender-id' },
    recipientId: { toString: () => 'recipient-id' },
    ciphertext: 'encrypted-content',
    iv: 'AAAAAAAAAAAAAAAA',
    wrappedKeys: [{ userId: { toString: () => 'sender-id' }, encryptedKey: 'wrapped-key' }],
    createdAt: new Date('2026-10-16T12:00:00.000Z'),
    expiresAt: new Date('2026-10-31T12:00:00.000Z'),
    isDeleted: false,
    readAt: null,
    attachment,
  };
  const message = serializeAdminChatMessage(source);

  assert.equal(message.ciphertext, 'encrypted-content');
  assert.equal(message.senderId, 'sender-id');
  assert.equal(message.isDeleted, false);
  assert.equal(message.readAt, null);
  assert.equal(message.wrappedKeys[0].keyId, 'primary');
  assert.equal(message.attachment.iv, 'AAAAAAAAAAAAAAAA');
  assert.equal(message.attachment.url, '/api/admin-chat/media/a1b2c3d4-e5f6-7890-abcd-ef1234567890');

  const readMessage = serializeAdminChatMessage({ ...source, readAt: new Date('2026-10-17T12:30:00.000Z') });
  assert.equal(readMessage.readAt, '2026-10-17T12:30:00.000Z');

  const deletedMessage = serializeAdminChatMessage({ ...source, isDeleted: true, attachment: null });
  assert.equal(deletedMessage.isDeleted, true);
  assert.equal(deletedMessage.attachment, null);
});