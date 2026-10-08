import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import Billing from '@/lib/models/Billing';
import { requireAuthenticatedUser } from '@/lib/session';
import { getMonthlyBillingAmounts } from '@/lib/billing-amounts';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export async function GET(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const currentDateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(now);
    const currentMonthIndex = Number(currentDateParts.find((part) => part.type === 'month')?.value) - 1;
    const currentYear = Number(currentDateParts.find((part) => part.type === 'year')?.value);
    const requestedMonth = searchParams.get('month');
    const requestedYear = searchParams.get('year');
    const month = requestedMonth && months.includes(requestedMonth)
      ? requestedMonth
      : months[currentMonthIndex];
    const year = requestedYear && /^\d{4}$/.test(requestedYear)
      ? Number(requestedYear)
      : currentYear;
    const selectedMonthIndex = months.indexOf(month);
    const selectedPeriodIsFuture = year > currentYear || (year === currentYear && selectedMonthIndex > currentMonthIndex);
    const activeCustomerIds = await Customer.distinct('_id', { status: { $ne: 'inactive' } });
    const currentBillings = await Billing.find({ year, month, customerId: { $in: activeCustomerIds } })
      .select('customerId totalDue packagePrice carriedAmount paidAmount status installmentAmount')
      .lean();
    const archivedCustomers = await Customer.countDocuments({ status: 'inactive' });
    const totalCustomers = activeCustomerIds.length;
    const totalBillings = currentBillings.length;
    const monthlyAmounts = currentBillings.map(getMonthlyBillingAmounts);
    const totalDue = monthlyAmounts.reduce((sum, amounts) => sum + amounts.due, 0);
    const totalRevenue = monthlyAmounts.reduce((sum, amounts) => sum + amounts.paid, 0);
    const outstandingAmount = monthlyAmounts.reduce((sum, amounts) => sum + amounts.outstanding, 0);
    const unpaidBillings = monthlyAmounts.filter((amounts) => amounts.outstanding > 0).length;
    const unpaidCustomers = selectedPeriodIsFuture
      ? 0
      : currentBillings.filter((billing) => billing.status === 'Belum Bayar').length;
    const paidBillings = totalBillings - unpaidBillings;
    const installmentBillings = currentBillings.filter((b) => b.status === 'Nyicil').length;
    return NextResponse.json({
      totalCustomers,
      archivedCustomers,
      unpaidCustomers,
      totalBillings,
      paidBillings,
      unpaidBillings,
      installmentBillings,
      totalDue,
      outstandingAmount,
      totalRevenue,
      billingStatuses: currentBillings.map((billing) => ({
        customerId: billing.customerId.toString(),
        status: billing.status,
      })),
      currentMonth: month,
      currentYear: year,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengambil statistik' }, { status: 500 });
  }
}
