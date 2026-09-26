import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import Package from '@/lib/models/Package';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      const seedSecret = process.env.SEED_SECRET;
      if (!seedSecret || request.headers.get('x-seed-secret') !== seedSecret) {
        return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
      }
    }

    await connectDB();

    const existingAdmin = await User.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const initialPassword = process.env.NODE_ENV === 'production'
        ? process.env.INITIAL_ADMIN_PASSWORD
        : 'admin123';
      if (!initialPassword) {
        return NextResponse.json({ error: 'INITIAL_ADMIN_PASSWORD wajib dikonfigurasi' }, { status: 500 });
      }
      const hashedPassword = await bcrypt.hash(initialPassword, 10);
      await User.create({ username: 'admin', password: hashedPassword, role: 'admin' });
    }

    const packages = [
      { name: 'Paket 10 Mbps', price: 150000, speed: '10 Mbps', description: 'Cocok untuk rumah kecil' },
      { name: 'Paket 20 Mbps', price: 200000, speed: '20 Mbps', description: 'Cocok untuk keluarga' },
      { name: 'Paket 50 Mbps', price: 350000, speed: '50 Mbps', description: 'Cocok untuk streaming & gaming' },
      { name: 'Paket 100 Mbps', price: 500000, speed: '100 Mbps', description: 'Cocok untuk bisnis kecil' },
    ];

    for (const pkg of packages) {
      const existing = await Package.findOne({ name: pkg.name });
      if (!existing) {
        await Package.create(pkg);
      }
    }

    return NextResponse.json({ message: 'Seed berhasil' });
  } catch (error) {
    return NextResponse.json({ error: 'Seed gagal: ' + (error as Error).message }, { status: 500 });
  }
}
