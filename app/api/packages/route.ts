import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Package from '@/lib/models/Package';
import { getCurrentUser, requireAuthenticatedUser } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const packages = await Package.find({}).sort({ price: 1 });
    return NextResponse.json(packages);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengambil data paket' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const body = await request.json();
    const { name, price, speed, description } = body;

    if (!name || !price || !speed) {
      return NextResponse.json({ error: 'Nama, harga, dan kecepatan wajib diisi' }, { status: 400 });
    }

    const existing = await Package.findOne({ name });
    if (existing) {
      return NextResponse.json({ error: 'Nama paket sudah ada' }, { status: 400 });
    }

    const pkg = await Package.create({ name, price: Number(price), speed, description: description || '' });
    const actor = await getCurrentUser();
    await writeAuditLog({
      actorUsername: actor?.username || 'Admin',
      action: 'package.created',
      entityType: 'package',
      entityId: pkg._id.toString(),
      entityLabel: pkg.name,
      summary: `Paket ${pkg.name} dibuat dengan harga ${pkg.price}`,
    });
    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menambah paket' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const body = await request.json();
    const { id, name, price, speed, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID paket wajib diisi' }, { status: 400 });
    }

    const pkg = await Package.findByIdAndUpdate(
      id,
      { name, price: Number(price), speed, description: description || '' },
      { new: true }
    );

    if (!pkg) {
      return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 404 });
    }

    const actor = await getCurrentUser();
    await writeAuditLog({
      actorUsername: actor?.username || 'Admin',
      action: 'package.updated',
      entityType: 'package',
      entityId: pkg._id.toString(),
      entityLabel: pkg.name,
      summary: `Data paket ${pkg.name} diperbarui dengan harga ${pkg.price}`,
    });

    return NextResponse.json(pkg);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengedit paket' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID paket wajib diisi' }, { status: 400 });
    }

    const pkg = await Package.findByIdAndDelete(id);
    if (!pkg) {
      return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 404 });
    }

    const actor = await getCurrentUser();
    await writeAuditLog({
      actorUsername: actor?.username || 'Admin',
      action: 'package.deleted',
      entityType: 'package',
      entityId: pkg._id.toString(),
      entityLabel: pkg.name,
      summary: `Paket ${pkg.name} dihapus`,
    });

    return NextResponse.json({ message: 'Paket berhasil dihapus' });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menghapus paket' }, { status: 500 });
  }
}
