import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import Package from '@/lib/models/Package';
import Billing from '@/lib/models/Billing';

export async function GET() {
  try {
    await connectDB();
    const customers = await Customer.find({}).populate('packageId').sort({ name: 1 });
    return NextResponse.json(customers);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengambil data pelanggan' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { name, address, packageId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nama pelanggan wajib diisi' }, { status: 400 });
    }

    const existing = await Customer.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return NextResponse.json({ error: 'Nama pelanggan sudah ada' }, { status: 400 });
    }

    const customer = await Customer.create({ name, address: address || '', packageId: packageId || null });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menambah pelanggan' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID pelanggan wajib diisi' }, { status: 400 });
    }

    await Billing.deleteMany({ customerId: id });
    const customer = await Customer.findByIdAndDelete(id);

    if (!customer) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Pelanggan dan semua tagihannya berhasil dihapus' });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menghapus pelanggan' }, { status: 500 });
  }
}
