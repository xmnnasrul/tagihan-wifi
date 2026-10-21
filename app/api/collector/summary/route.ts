import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing from '@/lib/models/Billing';
import { requireAdmin } from '@/lib/session';
import Customer from '@/lib/models/Customer';
import { getDataOwnerScope, getOwnerFilter } from '@/lib/data-ownership';

export const dynamic = 'force-dynamic';

const getTodayInJakarta = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
};

export async function GET(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getTodayInJakarta();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Tanggal setoran tidak valid' }, { status: 400 });
    }

    const [year, month, day] = date.split('-').map(Number);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    if (calendarDate.toISOString().slice(0, 10) !== date) {
      return NextResponse.json({ error: 'Tanggal setoran tidak valid' }, { status: 400 });
    }

    const start = new Date(`${date}T00:00:00.000+07:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    await connectDB();

    const ownerScope = await getDataOwnerScope();
    const paymentMatch: Record<string, unknown> = {
      'paymentHistory.addedAt': { $gte: start, $lt: end },
      'paymentHistory.isSettlementAllocation': { $ne: true },
      'paymentHistory.note': { $not: /^Pelunasan otomatis dari pembayaran / },
    };
    if (!ownerScope.isSuperadmin) {
      paymentMatch.customerId = { $in: await Customer.distinct('_id', getOwnerFilter(ownerScope)) };
    }
    const payments = await Billing.aggregate([
      { $match: { 'paymentHistory.addedAt': { $gte: start, $lt: end } } },
      { $unwind: { path: '$paymentHistory', includeArrayIndex: 'paymentIndex' } },
      { $match: paymentMatch },
      { $sort: { 'paymentHistory.addedAt': -1 } },
      {
        $project: {
          customerName: 1,
          month: 1,
          year: 1,
          paymentIndex: 1,
          amount: '$paymentHistory.amount',
          method: '$paymentHistory.method',
          status: '$paymentHistory.status',
          addedBy: '$paymentHistory.addedBy',
          addedAt: '$paymentHistory.addedAt',
          note: '$paymentHistory.note',
        },
      },
    ]);

    const transactions = payments.map((payment) => ({
      id: `${payment._id.toString()}-${payment.paymentIndex}`,
      customerName: payment.customerName,
      month: payment.month,
      year: payment.year,
      amount: payment.amount,
      method: payment.method || (payment.status === 'Cash' || payment.status === 'TF' ? payment.status : null),
      status: payment.status,
      collectorUsername: payment.addedBy || 'Admin',
      addedAt: payment.addedAt,
      note: payment.note || '',
    }));

    return NextResponse.json({
      date,
      totalAmount: transactions.reduce((total, transaction) => total + transaction.amount, 0),
      cashAmount: transactions.reduce((total, transaction) => total + (transaction.status !== 'Nyicil' && transaction.method === 'Cash' ? transaction.amount : 0), 0),
      transferAmount: transactions.reduce((total, transaction) => total + (transaction.status !== 'Nyicil' && transaction.method === 'TF' ? transaction.amount : 0), 0),
      installmentAmount: transactions.reduce((total, transaction) => total + (transaction.status === 'Nyicil' ? transaction.amount : 0), 0),
      unclassifiedAmount: transactions.reduce((total, transaction) => total + (transaction.status === 'Nyicil' || transaction.method ? 0 : transaction.amount), 0),
      transactionCount: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error('GET /api/collector/summary failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil rekap setoran' }, { status: 500 });
  }
}