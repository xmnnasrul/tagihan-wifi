import mongoose from 'mongoose';
import Billing from './models/Billing';

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
  return cached.conn;
}
