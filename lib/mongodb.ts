import mongoose from 'mongoose';
import Billing from './models/Billing';
import Customer, { LEGACY_DATA_OWNER_ID } from './models/Customer';
import Package from './models/Package';

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.warn('MONGODB_URI environment variable is not defined');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null };
let billingIndexesPromise: Promise<void> | null = null;
let ownershipMigrationPromise: Promise<void> | null = null;

if (!global.mongoose) {
  global.mongoose = cached;
}

async function ensureBillingIndexes() {
  if (!billingIndexesPromise) {
    const migrationPromise = (async () => {
      await Billing.collection.createIndex(
        { customerId: 1, month: 1, year: 1 },
        { unique: true }
      );

      const indexes = await Billing.collection.indexes();
      const legacyIndex = indexes.find((index) => index.name === 'customerName_1_month_1_year_1');
      if (legacyIndex?.name) {
        try {
          await Billing.collection.dropIndex(legacyIndex.name);
        } catch (error) {
          if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 27)) {
            throw error;
          }
        }
      }
    })();

    billingIndexesPromise = migrationPromise;
    void migrationPromise.catch(() => {
      if (billingIndexesPromise === migrationPromise) billingIndexesPromise = null;
    });
  }

  await billingIndexesPromise;
}

async function ensureDataOwnership() {
  if (!ownershipMigrationPromise) {
    const migrationPromise = (async () => {
      const legacyOwnerId = new mongoose.Types.ObjectId(LEGACY_DATA_OWNER_ID);
      await Promise.all([
        Customer.collection.updateMany(
          { $or: [{ ownerId: { $exists: false } }, { ownerId: null }] },
          { $set: { ownerId: legacyOwnerId } }
        ),
        Package.collection.updateMany(
          { $or: [{ ownerId: { $exists: false } }, { ownerId: null }] },
          { $set: { ownerId: legacyOwnerId } }
        ),
      ]);

      const [customerIndexes, packageIndexes] = await Promise.all([
        Customer.collection.indexes(),
        Package.collection.indexes(),
      ]);
      const legacyIndexes = [
        [Customer.collection, customerIndexes, 'name_1_address_1'],
        [Package.collection, packageIndexes, 'name_1'],
      ] as const;
      await Promise.all(legacyIndexes.map(async ([collection, indexes, indexName]) => {
        const legacyIndex = indexes.find((index) => index.name === indexName && index.unique);
        if (legacyIndex?.name) {
          try {
            await collection.dropIndex(legacyIndex.name);
          } catch (error) {
            if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 27)) {
              throw error;
            }
          }
        }
      }));

      await Promise.all([
        Customer.collection.createIndex({ ownerId: 1, name: 1, address: 1 }, { unique: true }),
        Package.collection.createIndex({ ownerId: 1, name: 1 }, { unique: true }),
      ]);
    })();

    ownershipMigrationPromise = migrationPromise;
    void migrationPromise.catch(() => {
      if (ownershipMigrationPromise === migrationPromise) ownershipMigrationPromise = null;
    });
  }

  await ownershipMigrationPromise;
}

export async function connectDB() {
  if (!cached.conn) {
    if (!cached.promise) {
      const connectionPromise = mongoose.connect(MONGODB_URI, {
        maxPoolSize: 5,
        minPoolSize: 0,
        maxIdleTimeMS: 10000,
        serverSelectionTimeoutMS: 10000,
      });
      cached.promise = connectionPromise;
      void connectionPromise.catch(() => {
        if (cached.promise === connectionPromise) cached.promise = null;
      });
    }

    cached.conn = await cached.promise;
  }

  await ensureBillingIndexes();
  await ensureDataOwnership();
  return cached.conn;
}
