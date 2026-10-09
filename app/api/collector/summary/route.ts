import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing from '@/lib/models/Billing';
import { getCurrentUser, requireCollectorOrAdmin } from '@/lib/session';
import { normalizeUserRoles } from '@/lib/roles';

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
    const authError = await requireCollectorOrAdmin();
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

    const currentUser = await getCurrentUser();
    const roles = normalizeUserRoles(currentUser?.role, currentUser?.roles);
    const isAdmin = roles.includes('admin');
    const bills = await Billing.find({ 'paymentHistory.addedAt': { $gte: start, $lt: end } })
      .select('customerName month year paymentHistory')
      .lean();

    const transactions = bills.flatMap((billing) => (billing.paymentHistory || [])
      .map((payment, index) => ({ payment, index }))
      .filter(({ payment }) => {
        const addedAt = new Date(payment.addedAt);
        if (addedAt < start || addedAt >= end) return false;
        if (payment.isSettlementAllocation || payment.note?.startsWith('Pelunasan otomatis dari pembayaran ')) return false;
        return isAdmin || payment.addedBy === currentUser?.username;
      })
      .map(({ payment, index }) => ({
        id: `${billing._id.toString()}-${index}`,
        customerName: billing.customerName,
        month: billing.month,
        year: billing.year,
        amount: payment.amount,
        status: payment.status,
        collectorUsername: payment.addedBy || 'Admin',
        addedAt: payment.addedAt,
        note: payment.note || '',
      })))
      .sort((first, second) => new Date(second.addedAt).getTime() - new Date(first.addedAt).getTime());

    return NextResponse.json({
      date,
      totalAmount: transactions.reduce((total, transaction) => total + transaction.amount, 0),
      transactionCount: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error('GET /api/collector/summary failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil rekap setoran' }, { status: 500 });
  }
}