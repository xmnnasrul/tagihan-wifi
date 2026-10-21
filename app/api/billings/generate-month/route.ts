import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing from '@/lib/models/Billing';
import Customer from '@/lib/models/Customer';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { getDataOwnerScope, getOwnerFilter } from '@/lib/data-ownership';

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

    await connectDB();
    const ownerScope = await getDataOwnerScope();
    const [customers, existingBillings] = await Promise.all([
      Customer.find({ status: { $ne: 'inactive' }, ...getOwnerFilter(ownerScope) })
        .select('name address packageId')
        .populate('packageId', 'name price')
        .lean(),
      Billing.find({
        month,
        year,
        customerId: { $in: await Customer.distinct('_id', getOwnerFilter(ownerScope)) },
      }).select('customerId').lean(),
    ]);
    if (!customers.length) {
      return NextResponse.json({ month, year, created: 0 });
    }

    const existingCustomerIds = new Set(existingBillings.map((billing) => billing.customerId.toString()));
    const currentUser = await getCurrentUser();
    let created = 0;

    const customersToBill = customers.filter((customer) => (
      !existingCustomerIds.has(customer._id.toString()) && Boolean(customer.packageId)
    ));
    const batchSize = 20;
    for (let offset = 0; offset < customersToBill.length; offset += batchSize) {
      const batchResults = await Promise.allSettled(customersToBill.slice(offset, offset + batchSize).map(async (customer) => {
        const customerId = customer._id.toString();
        const pkg = customer.packageId as unknown as PackageDetails | null;
        if (!pkg?._id) return false;

        try {
          const billing = await Billing.create({
            customerId: customer._id,
            customerName: customer.name,
            address: customer.address || '',
            packageName: pkg.name,
            packagePrice: pkg.price,
            carriedAmount: 0,
            totalDue: pkg.price,
            paidAmount: 0,
            month,
            year,
            status: 'Belum Bayar',
            installmentAmount: 0,
            note: '',
            paymentHistory: [],
          });

          existingCustomerIds.add(customerId);
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
          return true;
        } catch (error) {
          if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) return false;
          throw error;
        }
      }));
      for (const result of batchResults) {
        if (result.status === 'rejected') throw result.reason;
        if (result.value) created += 1;
      }
    }

    return NextResponse.json({ month, year, created });
  } catch (error) {
    console.error('POST /api/billings/generate-month failed:', error);
    return NextResponse.json({ error: 'Gagal membuat tagihan bulanan otomatis' }, { status: 500 });
  }
}