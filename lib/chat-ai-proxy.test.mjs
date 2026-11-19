import test from 'node:test';
import assert from 'node:assert/strict';

import { isChatAIProxyBaseURLAllowed, isPrivateIpAddress } from './chat-ai-proxy.ts';

test('only custom providers are checked', async () => {
  assert.equal(await isChatAIProxyBaseURLAllowed('openai', 'http://127.0.0.1:8080'), true);
});

test('blocks local, internal, and non-http URLs', async () => {
  assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'http://localhost:3000/v1'), false);
  assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'http://api.internal/v1'), false);
  assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'http://printer.local/v1'), false);
  assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'file:///etc/passwd'), false);
  assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'bukan-url'), false);
});

test('blocks literal private and loopback addresses', async () => {
  assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'http://10.0.0.5/v1'), false);
  assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'http://169.254.169.254/latest/meta-data'), false);
  assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'http://8.8.8.8/v1'), true);
});

test('classifies private IPv4 and IPv6 ranges', () => {
  for (const ip of ['0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.1.1',
    '172.16.0.1', '172.31.255.255', '192.168.1.1', '198.18.0.1', '224.0.0.1', '255.255.255.255']) {
    assert.equal(isPrivateIpAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '192.169.0.1']) {
    assert.equal(isPrivateIpAddress(ip), false, ip);
  }
  assert.equal(isPrivateIpAddress('::1'), true);
  assert.equal(isPrivateIpAddress('fc00::1'), true);
  assert.equal(isPrivateIpAddress('fe80::1'), true);
  assert.equal(isPrivateIpAddress('::ffff:10.0.0.1'), true);
  assert.equal(isPrivateIpAddress('2001:4860:4860::8888'), false);
});

test('allows loopback in development only', async () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'http://127.0.0.1:8080/v1'), true);
    assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'http://[::1]:8080/v1'), true);
    process.env.NODE_ENV = 'production';
    assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'http://127.0.0.1:8080/v1'), false);
    assert.equal(await isChatAIProxyBaseURLAllowed('custom', 'http://[::1]:8080/v1'), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
