import mongoose from 'mongoose';
import { LEGACY_DATA_OWNER_ID } from './legacy-data.ts';

function isIndexNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { code?: unknown }).code === 27;
}

async function dropLegacyIndex(
  collectionName: string,
  indexName: string,
  requireUnique = false,
): Promise<void> {
  const collection = mongoose.connection.collection(collectionName);
  const indexes = await collection.indexes();
  const legacyIndex = indexes.find((index) => index.name === indexName && (!requireUnique || index.unique));

  if (!legacyIndex?.name) return;

  try {
    await collection.dropIndex(legacyIndex.name);
  } catch (error) {
    if (!isIndexNotFoundError(error)) throw error;
  }
}

async function createAppIndexes(): Promise<void> {
  const db = mongoose.connection;

  await Promise.all([
    db.collection('billings').createIndex({ customerId: 1, month: 1, year: 1 }, { unique: true }),
    db.collection('billinggenerations').createIndex({ ownerId: 1, year: 1, month: 1 }, { unique: true }),
    db.collection('customers').createIndex({ ownerId: 1, name: 1, address: 1 }, { unique: true }),
    db.collection('packages').createIndex({ ownerId: 1, name: 1 }, { unique: true }),
    db.collection('chatmessages').createIndex({ ownerId: 1, createdAt: -1 }),
    db.collection('chatmessages').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('chatknowledges').createIndex({ ownerId: 1, updatedAt: -1 }),
  ]).then(() => undefined);
}

let appIndexesPromise: Promise<void> | null = null;

/**
 * Memastikan index aplikasi ada. Aman dipanggil berkali-kali karena
 * createIndex tidak menulis ulang dokumen dan tidak mengubah data.
 */
export async function ensureAppIndexes(): Promise<void> {
  if (!appIndexesPromise) {
    const indexPromise = createAppIndexes();
    appIndexesPromise = indexPromise;
    void indexPromise.catch(() => {
      if (appIndexesPromise === indexPromise) appIndexesPromise = null;
    });
  }

  await appIndexesPromise;
}

/**
 * Migrasi data lama ke format terbaru. Jalankan lewat `npm run migrate`,
 * bukan di setiap request atau cold start. Aman dijalankan berulang.
 */
export async function runMigrations(): Promise<void> {
  const legacyOwnerId = new mongoose.Types.ObjectId(LEGACY_DATA_OWNER_ID);

  await Promise.all([
    mongoose.connection.collection('customers').updateMany(
      { $or: [{ ownerId: { $exists: false } }, { ownerId: null }] },
      { $set: { ownerId: legacyOwnerId } },
    ),
    mongoose.connection.collection('packages').updateMany(
      { $or: [{ ownerId: { $exists: false } }, { ownerId: null }] },
      { $set: { ownerId: legacyOwnerId } },
    ),
  ]);

  await dropLegacyIndex('customers', 'name_1_address_1', true);
  await dropLegacyIndex('packages', 'name_1', true);
  await dropLegacyIndex('billings', 'customerName_1_month_1_year_1');

  await ensureAppIndexes();
}
