import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing, { IBilling } from '@/lib/models/Billing';
import Customer from '@/lib/models/Customer';
import Package from '@/lib/models/Package';
import { getCurrentUser, requireAdmin, requireAuthenticatedUser, requireCollectorOrAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { applyPaymentToPreviousBillings } from '@/lib/billing-amounts';

const billingMonths = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const getBillingPeriod = (month: string, year: number) => year * 12 + billingMonths.indexOf(month);

const getBillingAuditSnapshot = (billing: IBilling) => ({
  status: billing.status,
  paidAmount: billing.paidAmount || 0,
  installmentAmount: billing.installmentAmount || 0,
  totalDue: billing.totalDue || billing.packagePrice + (billing.carriedAmount || 0),
  note: billing.note || '',
  paymentCount: billing.paymentHistory?.length || 0,
});

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
    const { customerId, month, year, status, paidAmount, installmentAmount, note } = body;
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

    const previousBillings = await Billing.find({ customerId }).sort({ year: 1, createdAt: 1 });
    const targetPeriod = getBillingPeriod(month, Number(year));
    const olderOutstandingBillings = previousBillings.filter((bill) => {
      const billPeriod = getBillingPeriod(bill.month, bill.year);
      return billPeriod < targetPeriod && ['Belum Bayar', 'Nyicil'].includes(bill.status);
    });

    let carriedAmount = 0;
    if (!existingBilling) {
      const targetPeriod = getBillingPeriod(month, Number(year));
      const previousBillings = await Billing.find({ customerId }).sort({ year: -1, createdAt: -1 });
      const previousBilling = previousBillings.find((billing) => getBillingPeriod(billing.month, billing.year) < targetPeriod);
      if (previousBilling?.status === 'Nyicil' || previousBilling?.status === 'Belum Bayar') {
        carriedAmount = Math.max(0, (previousBilling.totalDue || previousBilling.packagePrice) - (previousBilling.paidAmount || 0));
      }
    }

    const totalDue = existingBilling?.totalDue || (existingBilling?.packagePrice ?? pkg.price) + carriedAmount;
    const previousPaid = existingBilling?.paidAmount || existingBilling?.installmentAmount || 0;
    const remainingDue = totalDue - previousPaid;
    const paymentAmount = status === 'Belum Bayar'
      ? 0
      : status === 'Nyicil'
        ? Number(installmentAmount ?? paidAmount)
        : Number(paidAmount) || remainingDue;
    if (status !== 'Belum Bayar' && (!Number.isFinite(paymentAmount) || paymentAmount <= 0)) {
      return NextResponse.json({ error: 'Nominal pembayaran harus lebih dari 0' }, { status: 400 });
    }
    if (paymentAmount > remainingDue) {
      return NextResponse.json({ error: `Nominal tidak boleh melebihi sisa tagihan ${remainingDue}` }, { status: 400 });
    }

    if (existingBilling) {
      const before = getBillingAuditSnapshot(existingBilling);
      const totalPaid = previousPaid + paymentAmount;
      if (totalPaid > totalDue) {
        return NextResponse.json({ error: `Total cicilan tidak boleh melebihi total tagihan ${totalDue}` }, { status: 400 });
      }
      const isPaidInFull = totalPaid === totalDue;
      const nextStatus = isPaidInFull
        ? (status === 'TF' || status === 'Cash' ? status : 'Lunas')
        : 'Nyicil';
      existingBilling.status = nextStatus;
      existingBilling.totalDue = totalDue;
      existingBilling.paidAmount = totalPaid;
      existingBilling.installmentAmount = isPaidInFull ? 0 : totalPaid;
      existingBilling.note = [existingBilling.note, note].filter(Boolean).join(' | ');
      existingBilling.paymentHistory = existingBilling.paymentHistory || [];
      existingBilling.paymentHistory.push({ amount: paymentAmount, addedAt: new Date(), addedBy: adminName, status: nextStatus, note: note || '' });
      await existingBilling.save();

      const { billings: settledPreviousBillings } = applyPaymentToPreviousBillings(olderOutstandingBillings, paymentAmount, {
        addedBy: adminName,
        note: `Pelunasan otomatis dari pembayaran ${month} ${year}`,
        appliedAt: new Date(),
      });

      for (const settledBilling of settledPreviousBillings) {
        const currentDoc = await Billing.findById(settledBilling._id);
        if (!currentDoc) continue;

        currentDoc.status = settledBilling.status;
        currentDoc.paidAmount = settledBilling.paidAmount;
        currentDoc.installmentAmount = settledBilling.installmentAmount;
        currentDoc.paymentHistory = settledBilling.paymentHistory;
        await currentDoc.save();
      }

      await writeAuditLog({
        actorUsername: adminName,
        action: 'billing.payment_added',
        entityType: 'billing',
        entityId: existingBilling._id.toString(),
        entityLabel: `${customer.name} - ${month} ${year}`,
        summary: `Pembayaran ${paymentAmount} ditambahkan; total dibayar ${totalPaid} dari ${totalDue}`,
        changes: { before, after: getBillingAuditSnapshot(existingBilling) },
      });
      return NextResponse.json(existingBilling);
    }

    const finalStatus = status === 'Belum Bayar'
      ? 'Belum Bayar'
      : paymentAmount === totalDue
        ? (status === 'TF' || status === 'Cash' ? status : 'Lunas')
        : 'Nyicil';
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
      status: finalStatus,
      installmentAmount: paymentAmount === totalDue ? 0 : paymentAmount,
      note: note || '',
      paymentHistory: status === 'Belum Bayar' ? [] : [{
          amount: paymentAmount,
          addedAt: new Date(),
          addedBy: adminName,
          status: finalStatus as 'TF' | 'Cash' | 'Nyicil' | 'Lunas',
          note: note || '',
        }],
    });

    const { billings: settledPreviousBillings } = applyPaymentToPreviousBillings(olderOutstandingBillings, paymentAmount, {
      addedBy: adminName,
      note: `Pelunasan otomatis dari pembayaran ${month} ${year}`,
      appliedAt: new Date(),
    });

    for (const settledBilling of settledPreviousBillings) {
      const currentDoc = await Billing.findById(settledBilling._id);
      if (!currentDoc) continue;

      currentDoc.status = settledBilling.status;
      currentDoc.paidAmount = settledBilling.paidAmount;
      currentDoc.installmentAmount = settledBilling.installmentAmount;
      currentDoc.paymentHistory = settledBilling.paymentHistory;
      await currentDoc.save();
    }

    await writeAuditLog({
      actorUsername: adminName,
      action: 'billing.created',
      entityType: 'billing',
      entityId: billing._id.toString(),
      entityLabel: `${customer.name} - ${month} ${year}`,
      summary: status === 'Belum Bayar'
        ? `Tagihan dibuat dengan total ${totalDue}; belum ada pembayaran`
        : `Tagihan dibuat dengan total ${totalDue}; pembayaran awal ${paymentAmount}`,
      changes: { before: null, after: getBillingAuditSnapshot(billing) },
    });

    return NextResponse.json(billing, { status: 201 });
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

    let carriedAmount = billing.carriedAmount || 0;
    if (!billing.totalDue) {
      const targetPeriod = getBillingPeriod(billing.month, billing.year);
      const previousBillings = await Billing.find({ customerId: billing.customerId, _id: { $ne: billing._id } }).sort({ year: -1, createdAt: -1 });
      const previousBilling = previousBillings.find((item) => getBillingPeriod(item.month, item.year) < targetPeriod);
      if (previousBilling?.status === 'Nyicil' || previousBilling?.status === 'Belum Bayar') {
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
