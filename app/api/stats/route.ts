import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import Billing from '@/lib/models/Billing';
import { requireAuthenticatedUser } from '@/lib/session';
import { getBillingPaidAmount, getBillingTotalDue } from '@/lib/billing-amounts';

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
    const requestedMonth = searchParams.get('month');
    const requestedYear = searchParams.get('year');
    const month = requestedMonth && months.includes(requestedMonth)
      ? requestedMonth
      : new Date().toLocaleString('id-ID', { month: 'long' });
    const year = requestedYear && /^\d{4}$/.test(requestedYear)
      ? Number(requestedYear)
      : new Date().getFullYear();

    const activeCustomerIds = await Customer.distinct('_id', { status: { $ne: 'inactive' } });
    const currentBillings = await Billing.find({ year, month, customerId: { $in: activeCustomerIds } })
      .select('customerId totalDue packagePrice carriedAmount paidAmount status installmentAmount')
      .lean();
    const totalCustomers = activeCustomerIds.length;
    const totalBillings = currentBillings.length;
    const totalDue = currentBillings.reduce((sum, billing) => sum + getBillingTotalDue(billing), 0);
    const totalRevenue = currentBillings.reduce((sum, billing) => sum + getBillingPaidAmount(billing), 0);
    const outstandingAmount = currentBillings.reduce(
      (sum, billing) => sum + Math.max(0, getBillingTotalDue(billing) - getBillingPaidAmount(billing)),
      0
    );
    const unpaidBillings = currentBillings.filter(
      (billing) => getBillingTotalDue(billing) > getBillingPaidAmount(billing)
    ).length;
    const paidBillings = totalBillings - unpaidBillings;
    const installmentBillings = currentBillings.filter((b) => b.status === 'Nyicil').length;

    return NextResponse.json({
      totalCustomers,
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
