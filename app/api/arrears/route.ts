import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing from '@/lib/models/Billing';
import { getBillingOutstandingAmount, getBillingPaidAmount, getBillingTotalDue } from '@/lib/billing-amounts';
import { requireAuthenticatedUser } from '@/lib/session';
import Customer from '@/lib/models/Customer';
import { getDataOwnerScope, getOwnerFilter } from '@/lib/data-ownership';

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
    const ownerScope = await getDataOwnerScope();
    const activeCustomerIds = await Customer.distinct('_id', {
      status: { $ne: 'inactive' },
      ...getOwnerFilter(ownerScope),
    });
    const billings = await Billing.find({ customerId: { $in: activeCustomerIds } })
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
      const outstandingPeriods = sortedBillings.flatMap((billing) => {
        const billedAmount = Math.max(0, getBillingTotalDue(billing));
        const paidAmount = Math.min(billedAmount, getBillingPaidAmount(billing));
        const outstandingAmount = getBillingOutstandingAmount(billing);
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