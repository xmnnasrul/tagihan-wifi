import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.join(projectRoot, 'app', 'api');

const expectedGuards = {
  'admin-chat/contacts/[userId]/profile-image/route.ts': { GET: ['requireAdmin'] },
  'admin-chat/contacts/route.ts': { GET: ['requireAdmin'] },
  'admin-chat/identity/route.ts': { POST: ['requireAdmin'], PUT: ['requireAdmin'] },
  'admin-chat/identity/recovery/route.ts': { GET: ['requireAdmin'], POST: ['requireAdmin'] },
  'admin-chat/media/[uploadId]/route.ts': { GET: ['requireAdmin'] },
  'admin-chat/messages/route.ts': { GET: ['requireAdmin'], POST: ['requireAdmin'], PATCH: ['requireAdmin'], DELETE: ['requireAdmin'] },
  'admin-chat/uploads/route.ts': { POST: ['requireAdmin'] },
  'admins/route.ts': {
    GET: ['requireAdmin'], POST: ['requireAdmin'], PATCH: ['requireAdmin'], DELETE: ['requireAdmin'],
  },
  'arrears/route.ts': { GET: ['requireAuthenticatedUser'] },
  'audit/route.ts': { GET: ['requireAdmin'] },
  'auth/change-password/route.ts': { POST: ['requireAuthenticatedUser'] },
  'auth/login/route.ts': { POST: [] },
  'auth/logout/route.ts': { POST: [] },
  'auth/me/route.ts': { GET: ['requireAuthenticatedUser'], PATCH: ['requireAdmin'] },
  'auth/me/profile-image/original/route.ts': { GET: ['requireAdmin'] },
  'auth/register/route.ts': { POST: [] },
  'auth/socket-ticket/route.ts': { POST: ['requireAdmin'] },
  'billings/export/route.ts': { GET: ['requireAuthenticatedUser'] },
  'billings/generate-month/route.ts': { POST: ['requireAdmin'] },
  'billings/route.ts': {
    GET: ['requireAuthenticatedUser'],
    POST: ['requireCollectorOrAdmin', 'requireAdmin'],
    PUT: ['requireAdmin'],
    DELETE: ['requireAdmin'],
  },
  'collection-visits/route.ts': {
    GET: ['requireAuthenticatedUser'], PUT: ['requireCollectorOrAdmin'],
  },
  'collector/summary/route.ts': { GET: ['requireCollectorOrAdmin'] },
  'customers/route.ts': {
    GET: ['requireAuthenticatedUser'], POST: ['requireAdmin'], DELETE: ['requireAdmin'], PUT: ['requireAdmin'],
  },
  'packages/route.ts': {
    GET: ['requireAuthenticatedUser'], POST: ['requireAdmin'], PUT: ['requireAdmin'], DELETE: ['requireAdmin'],
  },
  'seed/route.ts': { POST: [] },
  'stats/route.ts': { GET: ['requireAuthenticatedUser'] },
};

async function findRouteFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findRouteFiles(path.join(directory, entry.name), relativePath));
    } else if (entry.name === 'route.ts') {
      files.push(relativePath);
    }
  }
  return files;
}

test('every API handler has an explicit access classification and required guard', async () => {
  const routeFiles = await findRouteFiles(apiRoot);
  assert.deepEqual(routeFiles.sort(), Object.keys(expectedGuards).sort(), 'API route inventory changed; classify new routes');

  for (const [routePath, methods] of Object.entries(expectedGuards)) {
    const source = await readFile(path.join(apiRoot, routePath), 'utf8');
    const handlers = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)];
    const actualMethods = handlers.map((match) => match[1]).sort();

    assert.deepEqual(actualMethods, Object.keys(methods).sort(), `${routePath} handler inventory changed`);
    for (const [index, handler] of handlers.entries()) {
      const method = handler[1];
      const guards = methods[method];
      const handlerSource = source.slice(handler.index, handlers[index + 1]?.index ?? source.length);
      for (const guard of guards) {
        assert.match(handlerSource, new RegExp(`${guard}\\(\\)`), `${method} /api/${routePath} must use ${guard}`);
      }
      if (guards.length) {
        const guardPosition = handlerSource.indexOf(`${guards[0]}()`);
        const databasePosition = handlerSource.indexOf('await connectDB()');
        assert.ok(databasePosition === -1 || guardPosition < databasePosition, `${method} /api/${routePath} must authorize before database access`);
      }
      if (guards.length === 0 && !['auth/login/route.ts', 'auth/logout/route.ts', 'auth/register/route.ts', 'seed/route.ts'].includes(routePath)) {
        assert.fail(`${method} /api/${routePath} has no explicit guard classification`);
      }
    }
  }
});

test('public auth and seed endpoints retain explicit protections', async () => {
  const login = await readFile(path.join(apiRoot, 'auth/login/route.ts'), 'utf8');
  const logout = await readFile(path.join(apiRoot, 'auth/logout/route.ts'), 'utf8');
  const register = await readFile(path.join(apiRoot, 'auth/register/route.ts'), 'utf8');
  const seed = await readFile(path.join(apiRoot, 'seed/route.ts'), 'utf8');

  assert.match(login, /bcrypt\.compare/);
  assert.match(logout, /cookies\.delete\(COOKIE_NAME\)/);
  assert.match(register, /status:\s*403/);
  assert.match(seed, /process\.env\.NODE_ENV\s*===\s*'production'/);
  assert.match(seed, /x-seed-secret/);
  assert.match(seed, /requireAdmin\(\)/);
});

test('profile bio, username, and photo updates are admin-only', async () => {
  const profileRoute = await readFile(path.join(apiRoot, 'auth/me/route.ts'), 'utf8');
  const patchHandler = profileRoute.slice(profileRoute.indexOf('export async function PATCH'));

  assert.match(profileRoute, /roles\.includes\('admin'\) \? \{ bio: account\.bio \|\| '' \} : \{\}/);
  assert.match(patchHandler, /if \(Object\.hasOwn\(body, 'bio'\)\)/);
  assert.match(patchHandler, /const authError = await requireAdmin\(\)/);
  assert.ok(patchHandler.indexOf('requireAdmin()') < patchHandler.indexOf('const body = await request.json()'));
  assert.ok(patchHandler.indexOf('requireAdmin()') < patchHandler.indexOf('const username ='));
});

test('full-size profile photo endpoint is admin-only and never publicly cached', async () => {
  const route = await readFile(path.join(apiRoot, 'auth/me/profile-image/original/route.ts'), 'utf8');
  const contactImageRoute = await readFile(path.join(apiRoot, 'admin-chat/contacts/[userId]/profile-image/route.ts'), 'utf8');
  const profileRoute = await readFile(path.join(apiRoot, 'auth/me/route.ts'), 'utf8');

  assert.match(route, /requireAdmin\(\)/);
  assert.match(route, /Cache-Control':\s*'private, no-store'/);
  assert.match(route, /Content-Type':\s*'image\/jpeg'/);
  assert.match(profileRoute, /originalProfileImage/);
  assert.match(profileRoute, /hasOriginalProfileImage:\s*Boolean\(account\.originalProfileImage\)/);
  assert.match(contactImageRoute, /requireAdmin\(\)/);
  assert.match(contactImageRoute, /normalizeUserRoles\(account\.role, account\.roles\)\.includes\('admin'\)/);
  assert.match(contactImageRoute, /Cache-Control':\s*'private, no-store'/);
});

test('socket ticket endpoint requires an admin session and signs short-lived tickets', async () => {
  const socketTicketRoute = await readFile(path.join(apiRoot, 'auth/socket-ticket/route.ts'), 'utf8');
  const auth = await readFile(path.join(projectRoot, 'lib', 'auth.ts'), 'utf8');
  const socketServer = await readFile(path.join(projectRoot, 'socket-server', 'server.js'), 'utf8');

  assert.match(socketTicketRoute, /requireAdmin\(\)/);
  assert.match(socketTicketRoute, /userId: account\._id\.toString\(\)/);
  assert.match(socketTicketRoute, /normalizeUserRoles\(account\.role, account\.roles\)/);
  assert.match(socketTicketRoute, /account\.chatRecoveryStatus !== 'ready'/);
  assert.match(socketTicketRoute, /signSocketTicket\(/);
  assert.match(auth, /purpose: 'socket-ticket'/);
  assert.match(auth, /expiresIn: '15m'/);
  assert.match(socketServer, /socket\.handshake\.auth\?\.ticket/);
  assert.match(socketServer, /jwt\.verify\(/);
});

test('socket events are limited to admin chat and addressed to private admin rooms', async () => {
  const billingRoute = await readFile(path.join(apiRoot, 'billings/route.ts'), 'utf8');
  const socketServer = await readFile(path.join(projectRoot, 'socket-server', 'server.js'), 'utf8');
  const eventPublisher = await readFile(path.join(projectRoot, 'lib', 'socket-events.ts'), 'utf8');

  assert.doesNotMatch(billingRoute, /publishPaymentReceived|payment\.received/);
  assert.match(socketServer, /admin-chat\.updated/);
  assert.match(socketServer, /admin:\$\{socket\.data\.user\.userId\}/);
  assert.doesNotMatch(socketServer, /payment\.received|role:collector/);
  assert.match(socketServer, /SOCKET_PUBLISH_SECRET/);
  assert.match(eventPublisher, /SOCKET_SERVER_URL/);
  assert.match(eventPublisher, /admin-chat\.updated/);
});

test('admin chat stores encrypted payloads and limits each message to its two participants', async () => {
  const messageRoute = await readFile(path.join(apiRoot, 'admin-chat/messages/route.ts'), 'utf8');
  const uploadRoute = await readFile(path.join(apiRoot, 'admin-chat/uploads/route.ts'), 'utf8');
  const mediaRoute = await readFile(path.join(apiRoot, 'admin-chat/media/[uploadId]/route.ts'), 'utf8');
  const recoveryRoute = await readFile(path.join(apiRoot, 'admin-chat/identity/recovery/route.ts'), 'utf8');
  const model = await readFile(path.join(projectRoot, 'lib', 'models', 'AdminChatMessage.ts'), 'utf8');

  assert.match(messageRoute, /account\.chatRecoveryStatus !== 'ready'/);
  assert.match(messageRoute, /sender\.chatRecoveryStatus !== 'ready'/);
  assert.match(messageRoute, /recipient\.chatRecoveryStatus !== 'ready'/);
  assert.match(uploadRoute, /account\.chatRecoveryStatus !== 'ready'/);
  assert.match(mediaRoute, /account\.chatRecoveryStatus !== 'ready'/);
  assert.match(messageRoute, /participantIds:\s*\{\s*\$all:/);
  assert.match(messageRoute, /publishAdminChatUpdate\(\[sender\._id\.toString\(\), recipient\._id\.toString\(\)\]\)/);
  assert.match(messageRoute, /publishAdminChatUpdate\(\[account\._id\.toString\(\)\]\)/);
  assert.match(messageRoute, /publishAdminChatUpdate\(\[\s*account\._id\.toString\(\),\s*\.\.\.messages\.map\(\(message\) => message\.recipientId\.toString\(\)\)/);
  assert.match(messageRoute, /expectedWrappedKeys/);
  assert.match(messageRoute, /ciphertext,\s*iv,\s*wrappedKeys/);
  assert.doesNotMatch(messageRoute, /text:\s*text/);
  assert.match(uploadRoute, /uploadedBy:\s*account\._id/);
  assert.match(mediaRoute, /participantIds:\s*account\._id/);
  assert.match(mediaRoute, /'Content-Type':\s*'application\/octet-stream'/);
  assert.match(model, /ciphertext:\s*\{\s*type:\s*String,\s*required:\s*true/);
  assert.match(model, /deletedFor:/);
  assert.match(recoveryRoute, /participantIds:\s*account\._id/);
  assert.match(recoveryRoute, /keyId:\s*account\.chatRecoveryPendingKeyId/);
  assert.match(recoveryRoute, /requestedUserId !== account\._id\.toString\(\)/);
  assert.match(recoveryRoute, /body\.accountId !== account\._id\.toString\(\)/);
  assert.match(recoveryRoute, /remainingMessages > 0/);
  assert.match(recoveryRoute, /account\.chatRecoveryPublicKey = account\.chatRecoveryPendingPublicKey/);
  assert.match(messageRoute, /\$addToSet:\s*\{\s*deletedFor:\s*account\._id/);
  assert.match(messageRoute, /senderId:\s*account\._id/);
  assert.match(messageRoute, /Hapus untuk semua hanya tersedia/);
  assert.match(messageRoute, /isDeleted:\s*true,\s*ciphertext:\s*''/);
  assert.match(messageRoute, /export async function PATCH/);
  assert.match(messageRoute, /recipientId:\s*account\._id/);
  assert.match(messageRoute, /readAt:\s*null/);
  assert.match(messageRoute, /publishAdminChatUpdate\(\[otherAdmin\._id\.toString\(\)\]\)/);
  assert.match(model, /readAt:\s*\{\s*type:\s*Date,\s*default:\s*null\s*\}/);
});

test('admin chat key registration is tied to the server key version', async () => {
  const contactsRoute = await readFile(path.join(apiRoot, 'admin-chat/contacts/route.ts'), 'utf8');
  const identityRoute = await readFile(path.join(apiRoot, 'admin-chat/identity/route.ts'), 'utf8');
  const userModel = await readFile(path.join(projectRoot, 'lib', 'models', 'User.ts'), 'utf8');
  const chatClient = await readFile(path.join(projectRoot, 'components', 'AdminDirectChat.tsx'), 'utf8');

  assert.match(userModel, /chatKeyVersion: \{ type: Number, default: 0 \}/);
  assert.match(contactsRoute, /keyVersion: account\.chatKeyVersion \|\| 0/);
  assert.match(identityRoute, /account\.chatKeyVersion \|\| 0\) !== keyVersion/);
  assert.match(identityRoute, /account\.chatKeyVersion = \(account\.chatKeyVersion \|\| 0\) \+ 1/);
  assert.match(identityRoute, /publishAdminChatUpdate\(adminIds\.slice\(offset, offset \+ 100\)\)/);
  assert.match(identityRoute, /\$pull:\s*\{\s*wrappedKeys:\s*\{\s*userId:\s*account\._id\s*\}\s*\}/);
  assert.match(chatClient, /getOrCreateAdminChatIdentity\(userId, null, keyVersion\)/);
});