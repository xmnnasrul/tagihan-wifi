import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing, { IBilling, PaymentMethod } from '@/lib/models/Billing';
import Customer from '@/lib/models/Customer';
import '@/lib/models/Package';
import { getCurrentUser, requireAdmin, requireAuthenticatedUser, requireCollectorOrAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { publishPaymentReceived } from '@/lib/socket-events';
import { applyPaymentToPreviousBillings, getBillingOutstandingAmount, getBillingTotalDue } from '@/lib/billing-amounts';
import mongoose from 'mongoose';

const billingMonths = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const getBillingPeriod = (month: string, year: number) => year * 12 + billingMonths.indexOf(month);

const getBillingAuditSnapshot = (billing: IBilling) => ({
  status: billing.status,
  paidAmount: billing.paidAmount || 0,
  installmentAmount: billing.installmentAmount || 0,
  totalDue: getBillingTotalDue(billing),
  note: billing.note || '',
  paymentCount: billing.paymentHistory?.length || 0,
});

const getBillingAllocationSnapshot = (billing: IBilling) => ({
  _id: billing._id.toString(),
  customerId: billing.customerId.toString(),
  month: billing.month,
  year: billing.year,
  packagePrice: billing.packagePrice,
  totalDue: billing.packagePrice,
  carriedAmount: 0,
  paidAmount: billing.paidAmount || 0,
  installmentAmount: billing.installmentAmount || 0,
  status: billing.status,
});

const saveSettlementAllocations = async (session: mongoose.ClientSession, billings: IBilling[]) => {
  for (const settledBilling of billings) {
    const currentDoc = await Billing.findById(settledBilling._id).session(session);
    if (!currentDoc) continue;

    currentDoc.status = settledBilling.status;
    currentDoc.totalDue = currentDoc.packagePrice;
    currentDoc.carriedAmount = 0;
    currentDoc.paidAmount = settledBilling.paidAmount;
    currentDoc.installmentAmount = settledBilling.installmentAmount;
    currentDoc.paymentHistory = settledBilling.paymentHistory;
    await currentDoc.save({ session });
  }
};

export async function GET(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const customerId = searchParams.get('customerId');
    const customerName = searchParams.get('customerName');
    const status = searchParams.get('status');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const summaryOnly = searchParams.get('summary') === 'true';

    const query: Record<string, unknown> = {};
    if (month) query.month = month;
    if (year) query.year = Number(year);
    if (customerId) query.customerId = customerId;
    if (customerName) query.customerName = { $regex: customerName, $options: 'i' };
    if (status && status !== 'all') query.status = status;
    if (activeOnly) {
      const activeCustomerIds = await Customer.distinct('_id', { status: { $ne: 'inactive' } });
      query.customerId = { $in: activeCustomerIds };
    }

    if (summaryOnly) {
      const summaries = await Billing.find(query).select('customerId status month year createdAt').lean();
      return NextResponse.json(summaries.map((billing) => ({
        customerId: billing.customerId.toString(),
        status: billing.status,
        month: billing.month,
        year: billing.year,
        createdAt: billing.createdAt,
      })));
    }

    const billings = await Billing.find(query).sort({ year: -1, createdAt: -1 });
    return NextResponse.json(billings);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengambil data tagihan' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireCollectorOrAdmin();
    if (authError) return authError;

    await connectDB();
    const body = await request.json();
    const { customerId, month, year, status, paidAmount, installmentAmount, note, method } = body;
    const paymentMethod: PaymentMethod | undefined = method === 'Cash' || method === 'TF'
      ? method
      : status === 'Cash' || status === 'TF'
        ? status
        : undefined;
    const currentUser = await getCurrentUser();
    const adminName = currentUser?.username || 'Admin';

    if (!customerId || !month || !year || !status) {
      return NextResponse.json({ error: 'Field wajib belum lengkap' }, { status: 400 });
    }
    if (!['TF', 'Cash', 'Nyicil', 'Belum Bayar'].includes(status)) {
      return NextResponse.json({ error: 'Status pembayaran tidak valid' }, { status: 400 });
    }
    if (status === 'Belum Bayar') {
      const adminError = await requireAdmin();
      if (adminError) return adminError;
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
    if (existingBilling && !['Nyicil', 'Belum Bayar'].includes(existingBilling.status)) {
      return NextResponse.json({ error: `Tagihan bulan ${month} ${year} sudah selesai` }, { status: 400 });
    }
    if (existingBilling && status === 'Belum Bayar') {
      return NextResponse.json({ error: `Tagihan bulan ${month} ${year} sudah ada` }, { status: 400 });
    }

    const previousBillings = await Billing.find({ customerId });
    const targetPeriod = getBillingPeriod(month, Number(year));
    const olderOutstandingBillings = previousBillings
      .filter((bill) => getBillingPeriod(bill.month, bill.year) < targetPeriod)
      .sort((first, second) => getBillingPeriod(first.month, first.year) - getBillingPeriod(second.month, second.year))
      .filter((bill) => getBillingOutstandingAmount(bill) > 0);
    const monthlyDue = existingBilling?.packagePrice ?? pkg.price;
    const currentPaid = existingBilling
      ? Math.min(monthlyDue, Math.max(existingBilling.paidAmount || existingBilling.installmentAmount || 0, 0))
      : 0;
    const currentOutstanding = Math.max(0, monthlyDue - currentPaid);
    const totalOutstanding = olderOutstandingBillings.reduce(
      (total, billing) => total + getBillingOutstandingAmount(billing),
      currentOutstanding,
    );
    const paymentAmount = status === 'Belum Bayar'
      ? 0
      : status === 'Nyicil'
        ? Number(installmentAmount ?? paidAmount)
        : Number(paidAmount) || totalOutstanding;
    if (status !== 'Belum Bayar' && (!Number.isFinite(paymentAmount) || paymentAmount <= 0)) {
      return NextResponse.json({ error: 'Nominal pembayaran harus lebih dari 0' }, { status: 400 });
    }
    if (paymentAmount > totalOutstanding) {
      return NextResponse.json({ error: `Nominal tidak boleh melebihi total sisa tagihan ${totalOutstanding}` }, { status: 400 });
    }

    const receiptAt = new Date();
    const receiptStatus = paymentAmount >= totalOutstanding
      ? (status === 'Cash' || status === 'TF' ? status : 'Lunas')
      : 'Nyicil';
    const receipt = paymentAmount > 0 ? {
      amount: paymentAmount,
      addedAt: receiptAt,
      addedBy: adminName,
      status: receiptStatus as 'TF' | 'Cash' | 'Nyicil' | 'Lunas',
      method: paymentMethod,
      note: note || '',
    } : null;

    if (existingBilling) {
      const before = getBillingAuditSnapshot(existingBilling);
      existingBilling.totalDue = monthlyDue;
      existingBilling.carriedAmount = 0;
      existingBilling.note = [existingBilling.note, note].filter(Boolean).join(' | ');
      existingBilling.paymentHistory = existingBilling.paymentHistory || [];
      if (receipt) existingBilling.paymentHistory.push(receipt);
      const { billings: affectedBillings } = applyPaymentToPreviousBillings(
        [...olderOutstandingBillings, existingBilling],
        paymentAmount,
        {
          addedBy: adminName,
          note: `Alokasi dari pembayaran ${month} ${year}`,
          appliedAt: receiptAt,
          method: paymentMethod,
          skipHistoryFor: existingBilling,
        },
      );

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await saveSettlementAllocations(session, affectedBillings);
        });
      } finally {
        await session.endSession();
      }

      await writeAuditLog({
        actorUsername: adminName,
        action: 'billing.payment_added',
        entityType: 'billing',
        entityId: existingBilling._id.toString(),
        entityLabel: `${customer.name} - ${month} ${year}`,
        summary: `Pembayaran ${paymentAmount} diterima dan dialokasikan ke tagihan tertua; total saldo pelanggan sebelum pembayaran ${totalOutstanding}`,
        changes: { before, after: getBillingAuditSnapshot(existingBilling) },
      });
      if (receipt) {
        await publishPaymentReceived({
          customerName: customer.name,
          amount: receipt.amount,
          month,
          year: Number(year),
          method: paymentMethod || null,
          recordedBy: adminName,
          receivedAt: receiptAt.toISOString(),
        });
      }
      return NextResponse.json({
        ...existingBilling.toObject(),
        allocationUpdates: affectedBillings.map(getBillingAllocationSnapshot),
        paymentReceipt: receipt ? { ...receipt, customerName: customer.name, month, year: Number(year) } : null,
      });
    }

    const billingData = {
      customerId: customer._id,
      customerName: customer.name,
      address: customer.address,
      packageName: pkg.name,
      packagePrice: pkg.price,
      carriedAmount: 0,
      totalDue: pkg.price,
      paidAmount: 0,
      month,
      year: Number(year),
      status: 'Belum Bayar' as const,
      installmentAmount: 0,
      note: note || '',
      paymentHistory: receipt ? [receipt] : [],
    };

    const session = await mongoose.startSession();
    let transactionResult: { billing: IBilling; affectedBillings: IBilling[] } | null = null;
    try {
      transactionResult = await session.withTransaction(async () => {
        const [createdBilling] = await Billing.create([billingData], { session });
        const { billings: affectedBillings } = applyPaymentToPreviousBillings(
          [...olderOutstandingBillings, createdBilling],
          paymentAmount,
          {
            addedBy: adminName,
            note: `Alokasi dari pembayaran ${month} ${year}`,
            appliedAt: receiptAt,
            method: paymentMethod,
            skipHistoryFor: createdBilling,
          },
        );
        await saveSettlementAllocations(session, affectedBillings);
        return { billing: createdBilling, affectedBillings };
      });
    } finally {
      await session.endSession();
    }

    const billing = transactionResult?.billing;
    if (!billing) throw new Error('Transaksi pembayaran tidak menghasilkan tagihan');

    await writeAuditLog({
      actorUsername: adminName,
      action: 'billing.created',
      entityType: 'billing',
      entityId: billing._id.toString(),
      entityLabel: `${customer.name} - ${month} ${year}`,
      summary: status === 'Belum Bayar'
        ? `Tagihan dibuat dengan harga bulanan ${monthlyDue}; belum ada pembayaran`
        : `Pembayaran ${paymentAmount} diterima dan dialokasikan ke tagihan tertua; total saldo pelanggan sebelum pembayaran ${totalOutstanding}`,
      changes: { before: null, after: getBillingAuditSnapshot(billing) },
    });

    if (receipt) {
      await publishPaymentReceived({
        customerName: customer.name,
        amount: receipt.amount,
        month,
        year: Number(year),
        method: paymentMethod || null,
        recordedBy: adminName,
        receivedAt: receiptAt.toISOString(),
      });
    }

    return NextResponse.json({
      ...billing.toObject(),
      allocationUpdates: transactionResult.affectedBillings.map(getBillingAllocationSnapshot),
      paymentReceipt: receipt ? { ...receipt, customerName: customer.name, month, year: Number(year) } : null,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menambah tagihan' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

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
    const before = getBillingAuditSnapshot(billing);

    const carriedAmount = 0;
    const totalDue = billing.packagePrice;
    const updateData: Record<string, unknown> = {};
    if (status === 'Nyicil' || status === 'Lunas') {
      const editedAmount = status === 'Lunas'
        ? totalDue
        : Number(installmentAmount ?? paidAmount ?? billing.paidAmount);
      if (!Number.isFinite(editedAmount) || editedAmount <= 0 || editedAmount > totalDue) {
        return NextResponse.json({ error: `Nominal cicilan harus antara 1 dan ${totalDue}` }, { status: 400 });
      }
      const isPaidInFull = editedAmount === totalDue;
      updateData.status = isPaidInFull ? 'Lunas' : 'Nyicil';
      updateData.carriedAmount = carriedAmount;
      updateData.totalDue = totalDue;
      updateData.paidAmount = editedAmount;
      updateData.installmentAmount = isPaidInFull ? 0 : editedAmount;
    } else if (status === 'TF' || status === 'Cash') {
      updateData.status = status;
      updateData.carriedAmount = carriedAmount;
      updateData.totalDue = totalDue;
      updateData.paidAmount = totalDue;
      updateData.installmentAmount = 0;
    }
    if (note !== undefined) updateData.note = note;

    const updatedBilling = await Billing.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
    const actor = await getCurrentUser();
    if (updatedBilling) {
      await writeAuditLog({
        actorUsername: actor?.username || 'Admin',
        action: 'billing.updated',
        entityType: 'billing',
        entityId: updatedBilling._id.toString(),
        entityLabel: `${updatedBilling.customerName} - ${updatedBilling.month} ${updatedBilling.year}`,
        summary: `Tagihan diubah; status ${updatedBilling.status}, total dibayar ${updatedBilling.paidAmount}`,
        changes: { before, after: getBillingAuditSnapshot(updatedBilling) },
      });
    }

    return NextResponse.json(updatedBilling);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengedit tagihan' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

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

    const actor = await getCurrentUser();
    await writeAuditLog({
      actorUsername: actor?.username || 'Admin',
      action: 'billing.deleted',
      entityType: 'billing',
      entityId: billing._id.toString(),
      entityLabel: `${billing.customerName} - ${billing.month} ${billing.year}`,
      summary: `Tagihan dihapus; total ${billing.totalDue || billing.packagePrice}, dibayar ${billing.paidAmount}`,
      changes: { before: getBillingAuditSnapshot(billing), after: null },
    });

    return NextResponse.json({ message: 'Tagihan berhasil dihapus' });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menghapus tagihan' }, { status: 500 });
  }
}
