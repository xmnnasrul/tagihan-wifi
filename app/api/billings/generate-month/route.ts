import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing from '@/lib/models/Billing';
import Customer from '@/lib/models/Customer';
import Package from '@/lib/models/Package';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { getBillingPaidAmount, getBillingTotalDue } from '@/lib/billing-amounts';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const getBillingPeriod = (month: string, year: number) => year * 12 + months.indexOf(month);

interface PackageDetails {
  _id: { toString(): string };
  name: string;
  price: number;
}

export async function POST() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    await Package.findOne({}).select('_id').lean();

    const dateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date());
    const year = Number(dateParts.find((part) => part.type === 'year')?.value);
    const monthIndex = Number(dateParts.find((part) => part.type === 'month')?.value) - 1;
    const day = Number(dateParts.find((part) => part.type === 'day')?.value);
    const month = months[monthIndex];
    const period = getBillingPeriod(month, year);
    const firstAllowedPeriod = getBillingPeriod('Oktober', 2026);

    if (period < firstAllowedPeriod || day < 15) {
      return NextResponse.json({ month, year, created: 0, skipped: true });
    }

    const customers = await Customer.find({ status: { $ne: 'inactive' } }).populate('packageId').lean();
    const customerIds = customers.map((customer) => customer._id);
    if (customerIds.length === 0) {
      return NextResponse.json({ month, year, created: 0 });
    }

    const existingBillings = await Billing.find({ customerId: { $in: customerIds }, month, year })
      .select('customerId')
      .lean();
    const existingCustomerIds = new Set(existingBillings.map((billing) => billing.customerId.toString()));
    const previousBillings = await Billing.find({ customerId: { $in: customerIds }, year: { $lte: year } })
      .select('customerId month year totalDue packagePrice carriedAmount paidAmount status installmentAmount')
      .lean();
    const previousBillingByCustomer = new Map<string, typeof previousBillings[number]>();

    for (const billing of previousBillings) {
      const billingPeriod = getBillingPeriod(billing.month, billing.year);
      if (billingPeriod >= period) continue;
      const customerId = billing.customerId.toString();
      const previous = previousBillingByCustomer.get(customerId);
      if (!previous || billingPeriod > getBillingPeriod(previous.month, previous.year)) {
        previousBillingByCustomer.set(customerId, billing);
      }
    }

    const currentUser = await getCurrentUser();
    let created = 0;

    for (const customer of customers) {
      const customerId = customer._id.toString();
      const pkg = customer.packageId as unknown as PackageDetails | null;
      if (existingCustomerIds.has(customerId) || !pkg?._id) continue;

      const previousBilling = previousBillingByCustomer.get(customerId);
      const carriedAmount = previousBilling && ['Nyicil', 'Belum Bayar'].includes(previousBilling.status)
        ? Math.max(0, getBillingTotalDue(previousBilling) - getBillingPaidAmount(previousBilling))
        : 0;

      try {
        const billing = await Billing.create({
          customerId: customer._id,
          customerName: customer.name,
          address: customer.address || '',
          packageName: pkg.name,
          packagePrice: pkg.price,
          carriedAmount,
          totalDue: pkg.price + carriedAmount,
          paidAmount: 0,
          month,
          year,
          status: 'Belum Bayar',
          installmentAmount: 0,
          note: '',
          paymentHistory: [],
        });

        existingCustomerIds.add(customerId);
        created += 1;
        await writeAuditLog({
          actorUsername: currentUser?.username || 'Admin',
          action: 'billing.created',
          entityType: 'billing',
          entityId: billing._id.toString(),
          entityLabel: `${customer.name} - ${month} ${year}`,
          summary: `Tagihan ${month} ${year} dibuat otomatis dengan status belum bayar`,
          changes: {
            before: null,
            after: {
              status: billing.status,
              totalDue: billing.totalDue,
              paidAmount: billing.paidAmount,
              month: billing.month,
              year: billing.year,
            },
          },
        });
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) continue;
        throw error;
      }
    }

    return NextResponse.json({ month, year, created });
  } catch (error) {
    console.error('POST /api/billings/generate-month failed:', error);
    return NextResponse.json({ error: 'Gagal membuat tagihan bulanan otomatis' }, { status: 500 });
  }
}