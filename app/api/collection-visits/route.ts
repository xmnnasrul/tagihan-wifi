import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import CollectionVisit from '@/lib/models/CollectionVisit';
import Customer from '@/lib/models/Customer';
import { getCurrentUser, requireAdmin, requireAuthenticatedUser, requireCollectorOrAdmin } from '@/lib/session';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export async function GET(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || '';
    const year = Number(searchParams.get('year'));
    if (!months.includes(month) || !Number.isInteger(year)) {
      return NextResponse.json({ error: 'Periode kunjungan tidak valid' }, { status: 400 });
    }

    await connectDB();
    const visits = await CollectionVisit.find({ month, year }).lean();
    return NextResponse.json(visits.map((visit) => ({
      customerId: visit.customerId.toString(),
      collectorUsername: visit.collectorUsername,
      visitedAt: visit.visitedAt?.toISOString() || null,
      note: visit.note || '',
    })));
  } catch (error) {
    console.error('GET /api/collection-visits failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil status kunjungan' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authError = await requireCollectorOrAdmin();
    if (authError) return authError;

    const body = await request.json();
    const customerId = typeof body.customerId === 'string' ? body.customerId : '';
    const month = typeof body.month === 'string' ? body.month : '';
    const year = Number(body.year);
    const visited = body.visited;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
    if (!customerId || !months.includes(month) || !Number.isInteger(year) || typeof visited !== 'boolean') {
      return NextResponse.json({ error: 'Data kunjungan tidak valid' }, { status: 400 });
    }

    await connectDB();
    const customer = await Customer.findOne({ _id: customerId, status: { $ne: 'inactive' } }).select('_id').lean();
    if (!customer) return NextResponse.json({ error: 'Pelanggan tidak ditemukan atau sudah diarsipkan' }, { status: 404 });

    const currentUser = await getCurrentUser();
    const visit = await CollectionVisit.findOneAndUpdate(
      { customerId, month, year },
      {
        $set: {
          collectorUsername: currentUser?.username || 'Collector',
          visitedAt: visited ? new Date() : null,
          note,
        },
      },
      { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({
      customerId: visit.customerId.toString(),
      collectorUsername: visit.collectorUsername,
      visitedAt: visit.visitedAt?.toISOString() || null,
      note: visit.note || '',
    });
  } catch (error) {
    console.error('PUT /api/collection-visits failed:', error);
    return NextResponse.json({ error: 'Gagal menyimpan status kunjungan' }, { status: 500 });
  }
}