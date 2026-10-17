import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.join(projectRoot, 'app', 'api');

const expectedGuards = {
  'admin-chat/media/[uploadId]/route.ts': { GET: ['requireAdmin'] },
  'admin-chat/messages/route.ts': { GET: ['requireAdmin'], POST: ['requireAdmin'] },
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
  'auth/register/route.ts': { POST: [] },
  'auth/socket-ticket/route.ts': { POST: ['requireAuthenticatedUser'] },
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

test('socket ticket endpoint requires an authenticated session and signs short-lived tickets', async () => {
  const socketTicketRoute = await readFile(path.join(apiRoot, 'auth/socket-ticket/route.ts'), 'utf8');
  const auth = await readFile(path.join(projectRoot, 'lib', 'auth.ts'), 'utf8');
  const socketServer = await readFile(path.join(projectRoot, 'socket-server', 'server.js'), 'utf8');

  assert.match(socketTicketRoute, /requireAuthenticatedUser\(\)/);
  assert.match(socketTicketRoute, /signSocketTicket\(/);
  assert.match(auth, /purpose: 'socket-ticket'/);
  assert.match(auth, /expiresIn: '15m'/);
  assert.match(socketServer, /socket\.handshake\.auth\?\.ticket/);
  assert.match(socketServer, /jwt\.verify\(/);
});

test('payment events are published for receipts and limited to admin and collector rooms', async () => {
  const billingRoute = await readFile(path.join(apiRoot, 'billings/route.ts'), 'utf8');
  const socketServer = await readFile(path.join(projectRoot, 'socket-server', 'server.js'), 'utf8');
  const eventPublisher = await readFile(path.join(projectRoot, 'lib', 'socket-events.ts'), 'utf8');
  const paymentPost = billingRoute.slice(
    billingRoute.indexOf('export async function POST'),
    billingRoute.indexOf('export async function PUT')
  );

  assert.equal([...paymentPost.matchAll(/if \(receipt\) \{\s*await publishPaymentReceived\(/g)].length, 2);
  assert.equal([...paymentPost.matchAll(/await publishPaymentReceived\(/g)].length, 2);
  assert.match(socketServer, /io\.to\('role:admin'\)\.to\('role:collector'\)\.emit\('payment\.received'/);
  assert.match(socketServer, /SOCKET_PUBLISH_SECRET/);
  assert.match(eventPublisher, /SOCKET_SERVER_URL/);
});