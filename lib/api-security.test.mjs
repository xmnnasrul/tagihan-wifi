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
  'billings/export/route.ts': { GET: ['requireAuthenticatedUser'] },
  'billings/generate-month/route.ts': { POST: ['requireAdmin'] },
  'billings/route.ts': {
    GET: ['requireAuthenticatedUser'],
    POST: ['requireAdmin'],
    PUT: ['requireAdmin'],
    DELETE: ['requireAdmin'],
  },
  'chat/context/route.ts': { GET: ['requireAuthenticatedUser'] },
  'chat/cloudflare/route.ts': { POST: ['requireAuthenticatedUser'] },
  'chat/history/route.ts': {
    GET: ['requireAuthenticatedUser'], POST: ['requireAuthenticatedUser'], DELETE: ['requireAuthenticatedUser'],
  },
  'collection-visits/route.ts': {
    GET: ['requireAuthenticatedUser'], PUT: ['requireAdmin'],
  },
  'collector/summary/route.ts': { GET: ['requireAdmin'] },
  'notes/route.ts': { GET: ['requireAdmin'], POST: ['requireAdmin'], PATCH: ['requireAdmin'], DELETE: ['requireAdmin'] },
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
      if (guards.length === 0 && !['auth/login/route.ts', 'auth/logout/route.ts', 'seed/route.ts'].includes(routePath)) {
        assert.fail(`${method} /api/${routePath} has no explicit guard classification`);
      }
    }
  }
});

test('public auth and seed endpoints retain explicit protections', async () => {
  const login = await readFile(path.join(apiRoot, 'auth/login/route.ts'), 'utf8');
  const logout = await readFile(path.join(apiRoot, 'auth/logout/route.ts'), 'utf8');
  const seed = await readFile(path.join(apiRoot, 'seed/route.ts'), 'utf8');

  assert.match(login, /bcrypt\.compare/);
  assert.match(logout, /cookies\.delete\(COOKIE_NAME\)/);
  assert.match(seed, /process\.env\.NODE_ENV\s*===\s*'production'/);
  assert.match(seed, /x-seed-secret/);
  assert.match(seed, /requireAdmin\(\)/);
});

test('login rate limit uses MongoDB update pipelines with Mongoose enabled', async () => {
  const rateLimit = await readFile(path.join(projectRoot, 'lib/login-rate-limit.ts'), 'utf8');
  assert.match(rateLimit, /\{\s*upsert:\s*true,\s*updatePipeline:\s*true\s*\}/);
});

test('business data endpoints scope records to the active owner unless superadmin', async () => {
  const scopedRoutes = [
    'customers/route.ts',
    'packages/route.ts',
    'billings/route.ts',
    'billings/export/route.ts',
    'billings/generate-month/route.ts',
    'stats/route.ts',
    'collection-visits/route.ts',
    'collector/summary/route.ts',
    'notes/route.ts',
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
  const arrearsReport = await readFile(path.join(projectRoot, 'lib/arrears-report.ts'), 'utf8');
  assert.match(customerModel, /ownerId:\s*\{\s*type:\s*Schema\.Types\.ObjectId/);
  assert.match(packageModel, /ownerId:\s*\{\s*type:\s*Schema\.Types\.ObjectId/);
  assert.match(customerModel, /LEGACY_DATA_OWNER_ID\s*=\s*'6ab3754d75400e992aad5eba'/);
  assert.match(billingModel, /addedById:\s*\{\s*type:\s*String/);
  assert.match(arrearsReport, /getDataOwnerScope\(\)/);
  assert.match(arrearsReport, /getOwnerFilter\(ownerScope\)/);
});

test('arrears report excludes billing history for archived customers', async () => {
  const arrearsReport = await readFile(path.join(projectRoot, 'lib/arrears-report.ts'), 'utf8');

  assert.match(arrearsReport, /Customer\.distinct\('_id',\s*\{\s*status:\s*\{\s*\$ne:\s*'inactive'\s*\}/);
  assert.match(arrearsReport, /Billing\.find\(\{\s*customerId:\s*\{\s*\$in:\s*activeCustomerIds\s*\}\s*\}\)/);
});

test('AI context requires chat authorization and scopes website data to the active owner', async () => {
  const chatContextRoute = await readFile(path.join(apiRoot, 'chat/context/route.ts'), 'utf8');

  assert.match(chatContextRoute, /export async function GET\(/);
  assert.doesNotMatch(chatContextRoute, /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/);
  assert.match(chatContextRoute, /getAIChatPageAccess\(\)/);
  assert.match(chatContextRoute, /getArrearsReport\(\)/);
  assert.match(chatContextRoute, /status:\s*403/);
  assert.match(chatContextRoute, /customerName,\s*totalOutstanding,\s*outstandingPeriods/);
  assert.match(chatContextRoute, /getOwnerFilter\(ownerScope\)/);
  assert.match(chatContextRoute, /topics\.includes\('customers'\)/);
  assert.match(chatContextRoute, /topics\.includes\('billing'\)/);
  assert.match(chatContextRoute, /topics\.includes\('reports'\)/);
  assert.match(chatContextRoute, /topics\.includes\('archive'\)/);
  assert.match(chatContextRoute, /topics\.includes\('collection'\)/);
  assert.match(chatContextRoute, /getJakartaDayRange\(-1\)/);
  assert.match(chatContextRoute, /visitedAt:\s*getJakartaDayRange\(-1\)/);
  assert.match(chatContextRoute, /data\.collection = \{ visitedYesterday: true, visits: visitData \}/);
  assert.match(chatContextRoute, /notFound: 'visits-yesterday'/);
  assert.match(chatContextRoute, /getChatNewCustomerPeriod\(question\)/);
  assert.match(chatContextRoute, /getJakartaMonthRange\(newCustomerSelection\.year,\s*newCustomerSelection\.month\)/);
  assert.match(chatContextRoute, /getChatCustomerAddressQualifierTerms\(question,\s*''\)/);
  assert.match(chatContextRoute, /requestsChatCustomerAddress\(question\)/);
  assert.match(chatContextRoute, /: hasAddressQualifier \? allCustomers : \[\]/);
  assert.match(chatContextRoute, /rekap\|bulan\|periode\|tahun\|data/);
  assert.match(chatContextRoute, /hasCustomerMatch \|\| hasAddressQualifier \|\| !asksBroadData/);
  assert.match(chatContextRoute, /const customerIds = hasCustomerMatch \|\| hasAddressQualifier/);
  assert.match(chatContextRoute, /let customerNotFound = hasAddressQualifier && !hasCustomerMatch/);
  assert.match(chatContextRoute, /billingData\.filter\(\(billing\) => billing\.outstandingAmount > 0\)/);
  assert.match(chatContextRoute, /const showAddress = asksAddress/);
  assert.match(chatContextRoute, /\.\.\.\(asksAddress && addressByCustomerId\.has/);
  assert.match(chatContextRoute, /\.\.\.\(showAddress && \{ address: customer\.address \}\)/);
  assert.match(chatContextRoute, /\.\.\.\(showPhone && \{ phone: customer\.phone \}\)/);
  assert.match(chatContextRoute, /if \(requestsCustomerList && customers\.length === 0\)/);
  assert.match(chatContextRoute, /else customerNotFound = true/);
  assert.match(chatContextRoute, /\.\.\.\(customerNotFound && \{ notFound: 'customer' \}\)/);
});

test('Cloudflare chat proxy requires chat access and uses only validated Workers AI endpoints', async () => {
  const cloudflareRoute = await readFile(path.join(apiRoot, 'chat/cloudflare/route.ts'), 'utf8');

  assert.match(cloudflareRoute, /getAIChatPageAccess\(\)/);
  assert.match(cloudflareRoute, /normalizeCloudflareAccountID\(candidate\.accountID\)/);
  assert.match(cloudflareRoute, /getCloudflareWorkersAIBaseURL\(accountID\)/);
  assert.match(cloudflareRoute, /isCloudflareWorkersAIModel\(candidate\.model\)/);
  assert.match(cloudflareRoute, /getChatRequestHeaders\('cloudflare', apiKey\)/);
  assert.match(cloudflareRoute, /new Response\(upstreamResponse\.body/);
  assert.match(cloudflareRoute, /Cache-Control': 'no-store'/);
  assert.doesNotMatch(cloudflareRoute, /fetch\(\s*candidate\.(?:url|endpoint)/);
});

test('AI chat history is private to the active account and expires after five days', async () => {
  const historyRoute = await readFile(path.join(apiRoot, 'chat/history/route.ts'), 'utf8');
  const chatMessageModel = await readFile(path.join(projectRoot, 'lib/models/ChatMessage.ts'), 'utf8');
  const mongodb = await readFile(path.join(projectRoot, 'lib/mongodb.ts'), 'utf8');

  assert.match(historyRoute, /getAIChatPageAccess\(\)/);
  assert.match(historyRoute, /getDataOwnerScope\(\)/);
  assert.match(historyRoute, /export async function DELETE\(\)/);
  assert.match(historyRoute, /ChatMessage\.deleteMany\(\{\s*ownerId\s*\}\)/);
  assert.match(historyRoute, /ChatMessage\.find\(\{\s*ownerId,\s*expiresAt:/);
  assert.match(historyRoute, /ownerId,\s*createdAt:\s*now,\s*expiresAt/);
  assert.doesNotMatch(historyRoute, /body\.ownerId/);
  assert.match(chatMessageModel, /ChatMessageSchema\.index\(\{ expiresAt: 1 \}, \{ expireAfterSeconds: 0 \}\)/);
  assert.match(mongodb, /ensureChatHistoryIndexes\(\)/);
});

test('archived billing stays hidden except on the archive history view', async () => {
  const billingRoute = await readFile(path.join(apiRoot, 'billings/route.ts'), 'utf8');
  const exportRoute = await readFile(path.join(apiRoot, 'billings/export/route.ts'), 'utf8');
  const archivePage = await readFile(path.join(projectRoot, 'app/(app)/archived/page.tsx'), 'utf8');
  const customerDetailPage = await readFile(path.join(projectRoot, 'app/(app)/customers/[id]/page.tsx'), 'utf8');

  assert.match(billingRoute, /searchParams\.get\('includeArchived'\) === 'true' && Boolean\(customerId\)/);
  assert.match(billingRoute, /status: 'inactive'/);
  assert.match(billingRoute, /status: \{ \$ne: 'inactive' \}/);
  assert.match(exportRoute, /Customer\.distinct\('_id',\s*\{\s*status:\s*\{\s*\$ne:\s*'inactive'\s*\}/);
  assert.match(archivePage, /&archived=true/);
  assert.match(customerDetailPage, /&includeArchived=true/);
});

test('billing history requested by customer ID is restricted to that customer', async () => {
  const billingRoute = await readFile(path.join(apiRoot, 'billings/route.ts'), 'utf8');

  assert.match(billingRoute, /\.\.\.\(customerId \? \{ _id: customerId \} : \{\}\)/);
  assert.match(billingRoute, /\? \{ _id: customerId, status: 'inactive' \}/);
  assert.match(billingRoute, /query\.customerId = \{ \$in: visibleCustomerIds \}/);
});

test('customer listing includes package price for daily collection cards', async () => {
  const customerRoute = await readFile(path.join(apiRoot, 'customers/route.ts'), 'utf8');
  assert.match(customerRoute, /\.populate\('packageId',\s*'name speed price'\)/);
});

test('updating a customer address synchronizes saved billing addresses', async () => {
  const customerRoute = await readFile(path.join(apiRoot, 'customers/route.ts'), 'utf8');
  const updateHandler = customerRoute.slice(customerRoute.indexOf('export async function PUT'));

  assert.match(updateHandler, /previousCustomer\.address[\s\S]*Billing\.updateMany\(\s*\{\s*customerId:\s*customer\._id\s*\}[\s\S]*address:\s*customer\.address/);
});

test('billing export supports TXT format and selected columns with filters', async () => {
  const exportRoute = await readFile(path.join(apiRoot, 'billings/export/route.ts'), 'utf8');
  const exportPage = await readFile(path.join(projectRoot, 'app/(app)/export/page.tsx'), 'utf8');
  assert.match(exportRoute, /requestedFormat[\s\S]*'csv', 'xlsx', 'txt'/);
  assert.match(exportRoute, /searchParams\.get\('columns'\)/);
  assert.match(exportRoute, /Content-Type':\s*'text\/plain; charset=utf-8'/);
  assert.match(exportRoute, /formatTxtBillingExport\(billings,\s*getBillingOutstandingAmount\)/);
  assert.doesNotMatch(exportRoute, /label\.padEnd\(labelWidth\)/);
  assert.match(exportRoute, /if \(status\) \{\s*query\.status = status/);
  assert.match(exportRoute, /const exportColumns = \{\s*customerName:[\s\S]*address:/);
  assert.doesNotMatch(exportRoute, /packageName:\s*\{/);
  assert.match(exportPage, /const exportFields = \[\s*\{ value: 'customerName'[\s\S]*\{ value: 'address'/);
  assert.doesNotMatch(exportPage, /value: 'packageName'/);
  assert.match(exportPage, /const response = await fetch\(`\/api\/billings\/export\?/);
  assert.match(exportPage, /URL\.createObjectURL\(blob\)/);
  assert.doesNotMatch(exportPage, /window\.open\(/);
  const billingExport = await readFile(path.join(projectRoot, 'lib/billing-export.ts'), 'utf8');
  assert.match(billingExport, /getOutstandingAmount\(billing\)/);
  assert.match(billingExport, /customer\.periods\.length > 1/);
  assert.match(billingExport, /formatMonths\(customer\.periods\)/);
  assert.match(billingExport, /Tidak ada data yang sesuai dengan filter/);
});

test('TXT billing export includes previous months through the selected period', async () => {
  const exportRoute = await readFile(path.join(apiRoot, 'billings/export/route.ts'), 'utf8');
  const billingExport = await readFile(path.join(projectRoot, 'lib/billing-export.ts'), 'utf8');

  assert.match(exportRoute, /month && format === 'txt'[\s\S]*cutoffYear = year \? Number\(year\) : new Date\(\)\.getFullYear\(\)[\s\S]*year: \{ \$lt: cutoffYear \}[\s\S]*month: \{ \$in: monthsThroughSelected \}/);
  assert.match(billingExport, /if \(outstandingAmount > 0\) \{\s*customer\.periods\.push/);
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