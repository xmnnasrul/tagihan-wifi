import mongoose from 'mongoose';
import { runMigrations } from '../lib/db-migrations.ts';

const MONGODB_URI = process.env.MONGODB_URI || '';

async function main(): Promise<void> {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI belum diset. Tambahkan ke .env.local lalu jalankan ulang.');
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });
    await runMigrations();
    console.log('Migrasi selesai.');
  } catch (error) {
    console.error('Migrasi gagal:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

await main();
