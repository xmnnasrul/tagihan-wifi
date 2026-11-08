import { NextResponse } from 'next/server';
import Billing from '@/lib/models/Billing';
import Customer from '@/lib/models/Customer';
import { connectDB } from '@/lib/mongodb';
import { requireAuthenticatedUser } from '@/lib/session';
import { getDataOwnerScope, getOwnerFilter } from '@/lib/data-ownership';
import { summarizeMonthlyRecap } from '@/lib/monthly-recap';

export async function GET() {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const ownerScope = await getDataOwnerScope();
    const activeCustomerIds = await Customer.distinct('_id', {
      ...getOwnerFilter(ownerScope),
      status: { $ne: 'inactive' },
    });
    const billings = await Billing.find({ customerId: { $in: activeCustomerIds } })
      .select('customerId month year packagePrice paidAmount installmentAmount status paymentHistory.amount paymentHistory.method paymentHistory.status')
      .lean();

    return NextResponse.json(summarizeMonthlyRecap(billings.map((billing) => ({
      customerId: billing.customerId.toString(),
      month: billing.month,
      year: billing.year,
      packagePrice: billing.packagePrice,
      paidAmount: billing.paidAmount,
      installmentAmount: billing.installmentAmount,
      status: billing.status,
      paymentHistory: billing.paymentHistory,
    }))), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/monthly-recap failed', error);
    return NextResponse.json({ error: 'Gagal memuat rekap bulanan.' }, { status: 500 });
  }
}
