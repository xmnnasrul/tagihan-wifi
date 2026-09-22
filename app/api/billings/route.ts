import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing from '@/lib/models/Billing';
import Customer from '@/lib/models/Customer';
import Package from '@/lib/models/Package';

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const customerName = searchParams.get('customerName');
    const status = searchParams.get('status');

    const query: Record<string, unknown> = {};
    if (month) query.month = month;
    if (year) query.year = Number(year);
    if (customerName) query.customerName = { $regex: customerName, $options: 'i' };
    if (status && status !== 'all') query.status = status;

    const billings = await Billing.find(query).sort({ year: -1, createdAt: -1 });
    return NextResponse.json(billings);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengambil data tagihan' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { customerName, address, packageId, month, year, status, installmentAmount, note } = body;

    if (!customerName || !month || !year || !status) {
      return NextResponse.json({ error: 'Field wajib belum lengkap' }, { status: 400 });
    }

    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 400 });
    }

    let customer = await Customer.findOne({ name: { $regex: new RegExp(`^${customerName}$`, 'i') } });
    if (!customer) {
      customer = await Customer.create({ name: customerName, address: address || '', packageId: pkg._id });
    } else {
      customer.address = address || customer.address;
      customer.packageId = pkg._id;
      await customer.save();
    }

    const existingBilling = await Billing.findOne({ customerName: { $regex: new RegExp(`^${customerName}$`, 'i') }, month, year: Number(year) });
    if (existingBilling) {
      return NextResponse.json({ error: `Tagihan untuk ${customerName} bulan ${month} ${year} sudah ada` }, { status: 400 });
    }

    const billing = await Billing.create({
      customerId: customer._id,
      customerName: customer.name,
      address: address || '',
      packageName: pkg.name,
      packagePrice: pkg.price,
      month,
      year: Number(year),
      status,
      installmentAmount: status === 'Nyicil' ? Number(installmentAmount) || 0 : 0,
      note: note || '',
    });

    return NextResponse.json(billing, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menambah tagihan' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { id, status, installmentAmount, note } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID tagihan wajib diisi' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (installmentAmount !== undefined) updateData.installmentAmount = Number(installmentAmount) || 0;
    if (note !== undefined) updateData.note = note;

    const billing = await Billing.findByIdAndUpdate(id, updateData, { new: true });
    if (!billing) {
      return NextResponse.json({ error: 'Tagihan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(billing);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengedit tagihan' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID tagihan wajib diisi' }, { status: 400 });
    }

    const billing = await Billing.findByIdAndDelete(id);
    if (!billing) {
      return NextResponse.json({ error: 'Tagihan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Tagihan berhasil dihapus' });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menghapus tagihan' }, { status: 500 });
  }
}
