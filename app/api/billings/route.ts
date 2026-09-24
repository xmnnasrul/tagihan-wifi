import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing from '@/lib/models/Billing';
import Customer from '@/lib/models/Customer';
import Package from '@/lib/models/Package';
import { getCurrentUser } from '@/lib/session';

const billingMonths = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const getBillingPeriod = (month: string, year: number) => year * 12 + billingMonths.indexOf(month);

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
    const currentUser = await getCurrentUser();
    const adminName = currentUser?.username || 'Admin';

    if (!customerId || !month || !year || !status) {
      return NextResponse.json({ error: 'Field wajib belum lengkap' }, { status: 400 });
    }
    if (!['TF', 'Cash', 'Nyicil'].includes(status)) {
      return NextResponse.json({ error: 'Status pembayaran tidak valid' }, { status: 400 });
    }

    const customer = await Customer.findById(customerId).populate('packageId');
    if (!customer || customer.status === 'inactive') {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan atau sudah diarsipkan' }, { status: 404 });
    }

    const pkg = customer.packageId as unknown as { _id: string; name: string; price: number } | null;
    if (!pkg?._id) {
      return NextResponse.json({ error: 'Pelanggan belum memiliki paket' }, { status: 400 });
    }

    const existingBilling = await Billing.findOne({ customerId, month, year: Number(year) });
    if (existingBilling && existingBilling.status !== 'Nyicil') {
      return NextResponse.json({ error: `Tagihan bulan ${month} ${year} sudah selesai` }, { status: 400 });
    }

    let carriedAmount = 0;
    if (!existingBilling) {
      const targetPeriod = getBillingPeriod(month, Number(year));
      const previousBillings = await Billing.find({ customerId }).sort({ year: -1, createdAt: -1 });
      const previousBilling = previousBillings.find((billing) => getBillingPeriod(billing.month, billing.year) < targetPeriod);
      if (previousBilling?.status === 'Nyicil') {
        carriedAmount = Math.max(0, (previousBilling.totalDue || previousBilling.packagePrice) - (previousBilling.paidAmount || 0));
      }
    }

    const totalDue = existingBilling?.totalDue || (existingBilling?.packagePrice ?? pkg.price) + carriedAmount;
    const previousPaid = existingBilling?.paidAmount || existingBilling?.installmentAmount || 0;
    const remainingDue = totalDue - previousPaid;
    const paymentAmount = status === 'Nyicil'
      ? Number(installmentAmount ?? paidAmount)
      : Number(paidAmount) || remainingDue;
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json({ error: 'Nominal pembayaran harus lebih dari 0' }, { status: 400 });
    }
    if (paymentAmount > remainingDue) {
      return NextResponse.json({ error: `Nominal tidak boleh melebihi sisa tagihan ${remainingDue}` }, { status: 400 });
    }

    if (existingBilling) {
      const totalPaid = previousPaid + paymentAmount;
      if (totalPaid > totalDue) {
        return NextResponse.json({ error: `Total cicilan tidak boleh melebihi total tagihan ${totalDue}` }, { status: 400 });
      }
      const isPaidInFull = totalPaid === totalDue;
      const nextStatus = isPaidInFull ? 'Lunas' : 'Nyicil';
      existingBilling.status = nextStatus;
      existingBilling.totalDue = totalDue;
      existingBilling.paidAmount = totalPaid;
      existingBilling.installmentAmount = isPaidInFull ? 0 : totalPaid;
      existingBilling.note = [existingBilling.note, note].filter(Boolean).join(' | ');
      existingBilling.paymentHistory = existingBilling.paymentHistory || [];
      existingBilling.paymentHistory.push({ amount: paymentAmount, addedAt: new Date(), addedBy: adminName, status: nextStatus, note: note || '' });
      await existingBilling.save();
      return NextResponse.json(existingBilling);
    }

    const billing = await Billing.create({
      customerId: customer._id,
      customerName: customer.name,
      address: customer.address,
      packageName: pkg.name,
      packagePrice: pkg.price,
      carriedAmount,
      totalDue,
      paidAmount: paymentAmount,
      month,
      year: Number(year),
      status: paymentAmount === totalDue ? 'Lunas' : 'Nyicil',
      installmentAmount: paymentAmount === totalDue ? 0 : paymentAmount,
      note: note || '',
      paymentHistory: [{
        amount: paymentAmount,
        addedAt: new Date(),
        addedBy: adminName,
        status: paymentAmount === totalDue ? 'Lunas' : 'Nyicil',
        note: note || '',
      }],
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

    const billing = await Billing.findById(id);
    if (!billing) {
      return NextResponse.json({ error: 'Tagihan tidak ditemukan' }, { status: 404 });
    }

    let carriedAmount = billing.carriedAmount || 0;
    if (!billing.totalDue) {
      const targetPeriod = getBillingPeriod(billing.month, billing.year);
      const previousBillings = await Billing.find({ customerId: billing.customerId, _id: { $ne: billing._id } }).sort({ year: -1, createdAt: -1 });
      const previousBilling = previousBillings.find((item) => getBillingPeriod(item.month, item.year) < targetPeriod);
      if (previousBilling?.status === 'Nyicil') {
        carriedAmount = Math.max(0, (previousBilling.totalDue || previousBilling.packagePrice) - (previousBilling.paidAmount || 0));
      }
    }
    const totalDue = billing.totalDue || billing.packagePrice + carriedAmount;
    const updateData: Record<string, unknown> = {};
    if (status === 'Nyicil' || status === 'Lunas') {
      const editedAmount = status === 'Lunas'
        ? totalDue
        : Number(installmentAmount ?? paidAmount ?? billing.paidAmount);
      if (!Number.isFinite(editedAmount) || editedAmount <= 0 || editedAmount > totalDue) {
        return NextResponse.json({ error: `Nominal cicilan harus antara 1 dan ${totalDue}` }, { status: 400 });
      }
      const isPaidInFull = editedAmount === totalDue;
      const nextStatus = isPaidInFull ? 'Lunas' : 'Nyicil';
      updateData.status = isPaidInFull ? 'Lunas' : 'Nyicil';
      updateData.carriedAmount = carriedAmount;
      updateData.totalDue = totalDue;
      updateData.paidAmount = editedAmount;
      updateData.installmentAmount = isPaidInFull ? 0 : editedAmount;
      const history = billing.paymentHistory || [];
      if (history.length > 0) {
        const previousHistoryPaid = history.slice(0, -1).reduce((sum, payment) => sum + payment.amount, 0);
        const lastPaymentAmount = editedAmount - previousHistoryPaid;
        if (lastPaymentAmount < 0) {
          return NextResponse.json({ error: 'Nominal edit tidak boleh lebih kecil dari total cicilan sebelumnya' }, { status: 400 });
        }
        updateData.paymentHistory = history.map((payment, index) => index === history.length - 1
          ? { ...payment, amount: lastPaymentAmount, status: nextStatus, note: note !== undefined ? note : payment.note }
          : payment);
      }
    } else if (status === 'TF' || status === 'Cash') {
      updateData.status = status;
      updateData.carriedAmount = carriedAmount;
      updateData.totalDue = totalDue;
      updateData.paidAmount = totalDue;
      updateData.installmentAmount = 0;
      const history = billing.paymentHistory || [];
      if (history.length > 0) {
        const previousHistoryPaid = history.slice(0, -1).reduce((sum, payment) => sum + payment.amount, 0);
        updateData.paymentHistory = history.map((payment, index) => index === history.length - 1
          ? { ...payment, amount: totalDue - previousHistoryPaid, status, note: note !== undefined ? note : payment.note }
          : payment);
      }
    }
    if (note !== undefined) updateData.note = note;

    const updatedBilling = await Billing.findByIdAndUpdate(id, updateData, { new: true });

    return NextResponse.json(updatedBilling);
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
