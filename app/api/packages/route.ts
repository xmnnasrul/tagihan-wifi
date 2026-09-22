import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Package from '@/lib/models/Package';

export async function GET() {
  try {
    await connectDB();
    const packages = await Package.find({}).sort({ price: 1 });
    return NextResponse.json(packages);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengambil data paket' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menambah paket' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
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

    return NextResponse.json(pkg);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengedit paket' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
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

    return NextResponse.json({ message: 'Paket berhasil dihapus' });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menghapus paket' }, { status: 500 });
  }
}
