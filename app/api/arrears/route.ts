import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing from '@/lib/models/Billing';
import { getBillingPaidAmount } from '@/lib/billing-amounts';
import { requireAuthenticatedUser } from '@/lib/session';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const getPeriodIndex = (year: number, month: string) => year * 12 + months.indexOf(month);

export async function GET() {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const billings = await Billing.find({})
      .select('customerId customerName address month year status packagePrice totalDue carriedAmount paidAmount installmentAmount')
      .lean();
    const billingsByCustomer = new Map<string, typeof billings>();

    billings.forEach((billing) => {
      const customerId = billing.customerId.toString();
      const customerBillings = billingsByCustomer.get(customerId) || [];
      customerBillings.push(billing);
      billingsByCustomer.set(customerId, customerBillings);
    });

    const report = Array.from(billingsByCustomer.entries()).flatMap(([customerId, customerBillings]) => {
      const sortedBillings = [...customerBillings].sort((a, b) => getPeriodIndex(a.year, a.month) - getPeriodIndex(b.year, b.month));
      let remainingPayments = sortedBillings.reduce((sum, billing) => sum + getBillingPaidAmount(billing), 0);
      const outstandingPeriods = sortedBillings.flatMap((billing) => {
        const billedAmount = Math.max(0, Number(billing.packagePrice) || 0);
        const paidAmount = Math.min(billedAmount, remainingPayments);
        remainingPayments = Math.max(0, remainingPayments - paidAmount);
        const outstandingAmount = Math.max(0, billedAmount - paidAmount);
        if (outstandingAmount === 0) return [];

        return [{
          month: billing.month,
          year: billing.year,
          billedAmount,
          paidAmount,
          outstandingAmount,
          status: paidAmount > 0 ? 'Nyicil' : 'Belum Bayar',
        }];
      });

      if (outstandingPeriods.length === 0) return [];
      const latestBilling = sortedBillings[sortedBillings.length - 1];

      return [{
        customerId,
        customerName: latestBilling.customerName,
        address: latestBilling.address,
        totalOutstanding: outstandingPeriods.reduce((sum, period) => sum + period.outstandingAmount, 0),
        outstandingPeriods,
      }];
    }).sort((a, b) => a.customerName.localeCompare(b.customerName, 'id'));

    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil laporan tunggakan' }, { status: 500 });
  }
}