import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.join(projectRoot, 'app', 'api');

const expectedGuards = {
  'admins/route.ts': {
    GET: ['requireSuperadmin'], POST: ['requireSuperadmin'], PATCH: ['requireSuperadmin'], DELETE: ['requireSuperadmin'],
  },
  'arrears/route.ts': { GET: ['requireAuthenticatedUser'] },
  'audit/route.ts': { GET: ['requireAdmin'] },
  'auth/change-password/route.ts': { POST: ['requireAuthenticatedUser'] },
  'auth/login/route.ts': { POST: [] },
  'auth/logout/route.ts': { POST: [] },
  'auth/me/route.ts': { GET: ['requireAuthenticatedUser'], PATCH: ['requireAdmin'] },
  'auth/me/profile-image/original/route.ts': { GET: ['requireAdmin'] },
  'auth/register/route.ts': { POST: [] },
  'billings/export/route.ts': { GET: ['requireAuthenticatedUser'] },
  'billings/generate-month/route.ts': { POST: ['requireAdmin'] },
  'billings/route.ts': {
    GET: ['requireAuthenticatedUser'],
    POST: ['requireAdmin'],
    PUT: ['requireAdmin'],
    DELETE: ['requireAdmin'],
  },
  'collection-visits/route.ts': {
    GET: ['requireAuthenticatedUser'], PUT: ['requireAdmin'],
  },
  'collector/summary/route.ts': { GET: ['requireAdmin'] },
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

test('business data endpoints scope records to the active owner unless superadmin', async () => {
  const scopedRoutes = [
    'customers/route.ts',
    'packages/route.ts',
    'billings/route.ts',
    'billings/export/route.ts',
    'billings/generate-month/route.ts',
    'stats/route.ts',
    'arrears/route.ts',
    'collection-visits/route.ts',
    'collector/summary/route.ts',
    'audit/route.ts',
  ];

  for (const routePath of scopedRoutes) {
    const source = await readFile(path.join(apiRoot, routePath), 'utf8');
    assert.match(source, /getDataOwnerScope\(\)/, `${routePath} must determine the current owner scope`);
  }

  const customerModel = await readFile(path.join(projectRoot, 'lib/models/Customer.ts'), 'utf8');
  const packageModel = await readFile(path.join(projectRoot, 'lib/models/Package.ts'), 'utf8');
  const migration = await readFile(path.join(projectRoot, 'lib/mongodb.ts'), 'utf8');
  const billingModel = await readFile(path.join(projectRoot, 'lib/models/Billing.ts'), 'utf8');
  assert.match(customerModel, /ownerId:\s*\{\s*type:\s*Schema\.Types\.ObjectId/);
  assert.match(packageModel, /ownerId:\s*\{\s*type:\s*Schema\.Types\.ObjectId/);
  assert.match(customerModel, /LEGACY_DATA_OWNER_ID\s*=\s*'6ab3754d75400e992aad5eba'/);
  assert.match(billingModel, /addedById:\s*\{\s*type:\s*String/);
});

test('arrears report excludes billing history for archived customers', async () => {
  const arrearsRoute = await readFile(path.join(apiRoot, 'arrears/route.ts'), 'utf8');

  assert.match(arrearsRoute, /Customer\.distinct\('_id',\s*\{\s*status:\s*\{\s*\$ne:\s*'inactive'\s*\}/);
  assert.match(arrearsRoute, /Billing\.find\(\{\s*customerId:\s*\{\s*\$in:\s*activeCustomerIds\s*\}\s*\}\)/);
});

test('customer listing includes package price for daily collection cards', async () => {
  const customerRoute = await readFile(path.join(apiRoot, 'customers/route.ts'), 'utf8');
  assert.match(customerRoute, /\.populate\('packageId',\s*'name speed price'\)/);
});

test('billing export supports TXT format and selected columns with filters', async () => {
  const exportRoute = await readFile(path.join(apiRoot, 'billings/export/route.ts'), 'utf8');
  const exportPage = await readFile(path.join(projectRoot, 'app/(app)/export/page.tsx'), 'utf8');
  assert.match(exportRoute, /requestedFormat[\s\S]*'csv', 'xlsx', 'txt'/);
  assert.match(exportRoute, /searchParams\.get\('columns'\)/);
  assert.match(exportRoute, /Content-Type':\s*'text\/plain; charset=utf-8'/);
  assert.match(exportRoute, /const txtLines = rows\.map\(\(row, index\)/);
  assert.match(exportRoute, /`\$\{index \+ 1\}\. \$\{row\.map\(safeTextCell\)\.filter\(Boolean\)\.join\(' '\)\}`/);
  assert.doesNotMatch(exportRoute, /label\.padEnd\(labelWidth\)/);
  assert.match(exportRoute, /Tidak ada data yang sesuai dengan filter/);
  assert.match(exportRoute, /if \(status\) \{\s*query\.status = status/);
  assert.match(exportRoute, /const exportColumns = \{\s*customerName:[\s\S]*address:/);
  assert.doesNotMatch(exportRoute, /packageName:\s*\{/);
  assert.match(exportPage, /const exportFields = \[\s*\{ value: 'customerName'[\s\S]*\{ value: 'address'/);
  assert.doesNotMatch(exportPage, /value: 'packageName'/);
  assert.match(exportPage, /const response = await fetch\(`\/api\/billings\/export\?/);
  assert.match(exportPage, /URL\.createObjectURL\(blob\)/);
  assert.doesNotMatch(exportPage, /window\.open\(/);
});

test('profile username and photo updates are admin-only; bio is removed', async () => {
  const profileRoute = await readFile(path.join(apiRoot, 'auth/me/route.ts'), 'utf8');
  const patchHandler = profileRoute.slice(profileRoute.indexOf('export async function PATCH'));

  assert.doesNotMatch(profileRoute, /bio/i);
  assert.match(patchHandler, /const authError = await requireAdmin\(\)/);
  assert.ok(patchHandler.indexOf('requireAdmin()') < patchHandler.indexOf('const body = await request.json()'));
  assert.ok(patchHandler.indexOf('requireAdmin()') < patchHandler.indexOf('const username ='));
});

test('full-size profile photo endpoint is admin-only and never publicly cached', async () => {
  const route = await readFile(path.join(apiRoot, 'auth/me/profile-image/original/route.ts'), 'utf8');
  const profileRoute = await readFile(path.join(apiRoot, 'auth/me/route.ts'), 'utf8');

  assert.match(route, /requireAdmin\(\)/);
  assert.match(route, /Cache-Control':\s*'private, no-store'/);
  assert.match(route, /Content-Type':\s*'image\/jpeg'/);
  assert.match(profileRoute, /originalProfileImage/);
  assert.match(profileRoute, /hasOriginalProfileImage:\s*Boolean\(account\.originalProfileImage\)/);
});

test('user schema no longer retains admin chat key fields', async () => {
  const userModel = await readFile(path.join(projectRoot, 'lib', 'models', 'User.ts'), 'utf8');

  assert.doesNotMatch(userModel, /^\s+(?:chatKeyVersion|chatRecovery\w*|chatPublicKey)\s*:/m);
});