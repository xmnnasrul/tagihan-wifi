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
    const customerId = searchParams.get('customerId');
    const customerName = searchParams.get('customerName');
    const status = searchParams.get('status');

    const query: Record<string, unknown> = {};
    if (month) query.month = month;
    if (year) query.year = Number(year);
    if (customerId) query.customerId = customerId;
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
    const { customerId, month, year, status, paidAmount, installmentAmount, note } = body;

    if (!customerId || !month || !year || !status) {
      return NextResponse.json({ error: 'Field wajib belum lengkap' }, { status: 400 });
    }

    const customer = await Customer.findById(customerId).populate('packageId');
    if (!customer || customer.status === 'inactive') {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan atau sudah diarsipkan' }, { status: 404 });
    }

    const pkg = customer.packageId as unknown as { _id: string; name: string; price: number } | null;
    if (!pkg?._id) {
      return NextResponse.json({ error: 'Pelanggan belum memiliki paket' }, { status: 400 });
    }

    const paymentAmount = Number(paidAmount) || (status === 'Nyicil' ? Number(installmentAmount) || 0 : pkg.price);
    const existingBilling = await Billing.findOne({ customerId, month, year: Number(year) });
    if (existingBilling && existingBilling.status !== 'Nyicil') {
      return NextResponse.json({ error: `Tagihan bulan ${month} ${year} sudah selesai` }, { status: 400 });
    }

    if (existingBilling) {
      existingBilling.status = status;
      existingBilling.paidAmount = (existingBilling.paidAmount || existingBilling.installmentAmount || 0) + paymentAmount;
      existingBilling.installmentAmount = status === 'Nyicil' ? existingBilling.paidAmount : 0;
      existingBilling.note = [existingBilling.note, note].filter(Boolean).join(' | ');
      await existingBilling.save();
      return NextResponse.json(existingBilling);
    }

    const billing = await Billing.create({
      customerId: customer._id,
      customerName: customer.name,
      address: customer.address,
      packageName: pkg.name,
      packagePrice: pkg.price,
      paidAmount: paymentAmount,
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
    const { id, status, paidAmount, installmentAmount, note } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID tagihan wajib diisi' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (paidAmount !== undefined) updateData.paidAmount = Number(paidAmount) || 0;
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
