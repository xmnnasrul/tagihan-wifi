import { NextResponse } from 'next/server';
import { getArrearsReport } from '@/lib/arrears-report';
import { getAIChatPageAccess, requireAuthenticatedUser } from '@/lib/session';
import { connectDB } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import Billing from '@/lib/models/Billing';
import '@/lib/models/Package';
import CollectionVisit from '@/lib/models/CollectionVisit';
import { getDataOwnerScope, getOwnerFilter } from '@/lib/data-ownership';
import {
  getBillingOutstandingAmount,
  getBillingPaidAmount,
  getBillingTotalDue,
  getMonthlyBillingAmounts,
} from '@/lib/billing-amounts';
import {
  getChatContextTopics,
  getChatCustomerAddressQualifierTerms,
  matchesChatCustomerNameQuery,
  matchesChatCustomerAddressQuery,
} from '@/lib/chat-answer';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function getJakartaPeriod() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  return {
    month: months[Number(parts.find((part) => part.type === 'month')?.value) - 1],
    year: Number(parts.find((part) => part.type === 'year')?.value),
  };
}

function getRequestedPeriod(question: string) {
  const current = getJakartaPeriod();
  const month = months.find((candidate) => question.toLocaleLowerCase().includes(candidate.toLocaleLowerCase()));
  const year = question.match(/\b20\d{2}\b/)?.[0];
  return { month: month || current.month, year: year ? Number(year) : current.year };
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export async function GET(request: Request) {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  try {
    const access = await getAIChatPageAccess();
    if (!access.allowed) return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const question = searchParams.get('question');
    if (!question) {
      const report = await getArrearsReport();
      const context = report.map(({ customerName, totalOutstanding, outstandingPeriods }) => ({
        customerName,
        totalOutstanding,
        outstandingPeriods: outstandingPeriods.map(({ month, year, outstandingAmount, status }) => ({
          month,
          year,
          outstandingAmount,
          status,
        })),
      }));
      return NextResponse.json(context, { headers: { 'Cache-Control': 'no-store' } });
    }

    const topics = getChatContextTopics(question);
    if (topics.length === 0) {
      return NextResponse.json({ topics, data: null }, { headers: { 'Cache-Control': 'no-store' } });
    }

    await connectDB();
    const ownerScope = await getDataOwnerScope();
    const ownerFilter = getOwnerFilter(ownerScope);
    const includeArchived = topics.includes('archive');
    const statusFilter = includeArchived
      ? { status: 'inactive' as const }
      : { status: { $ne: 'inactive' as const } };
    const allCustomers = await Customer.find({
      ...ownerFilter,
      ...statusFilter,
    }).select('_id name').lean();
    const normalizedQuestion = ` ${normalizeText(question)} `;
    const customersMatchingName = allCustomers.filter((customer) =>
      matchesChatCustomerNameQuery(question, customer.name));
    const nameMatchingIds = customersMatchingName.map((customer) => customer._id);
    const hasAddressQualifier = customersMatchingName.some((customer) =>
      getChatCustomerAddressQualifierTerms(question, customer.name).length > 0);
    const addressMatchedIds = new Set<string>();
    if (hasAddressQualifier && nameMatchingIds.length > 0) {
      const candidatesWithAddress = await Customer.find({
        ...ownerFilter,
        ...statusFilter,
        _id: { $in: nameMatchingIds },
      }).select('_id address').lean();
      const nameById = new Map(customersMatchingName.map((customer) => [customer._id.toString(), customer.name]));
      candidatesWithAddress.forEach((customer) => {
        const customerName = nameById.get(customer._id.toString());
        if (customerName && matchesChatCustomerAddressQuery(question, customerName, customer.address || '')) {
          addressMatchedIds.add(customer._id.toString());
        }
      });
    }
    const matchingIds = addressMatchedIds.size > 0
      ? customersMatchingName
        .filter((customer) => addressMatchedIds.has(customer._id.toString()))
        .map((customer) => customer._id)
      : nameMatchingIds;
    const hasCustomerMatch = matchingIds.length > 0;
    const asksBroadData = /\b(?:daftar|semua|seluruh|siapa|berapa|jumlah|total|laporan|statistik|ringkasan|rekap|bulan|periode|tahun)\b/u
      .test(normalizedQuestion);
    const customerFilter = {
      ...ownerFilter,
      ...statusFilter,
      ...((hasCustomerMatch || !asksBroadData) ? { _id: { $in: matchingIds } } : {}),
    };
    const data: Record<string, unknown> = {};

    if (topics.includes('customers') || topics.includes('archive')) {
      const showAddress = hasCustomerMatch || /\b(?:alamat|kontak)\b/u.test(normalizedQuestion);
      const showPhone = /\b(?:nomor|telepon|kontak)\b/u.test(normalizedQuestion);
      const requestsCustomerList = /\b(?:daftar|semua|seluruh|siapa|tampilkan|cari|carikan|cariin|nyari|alamat|nomor|telepon|kontak)\b/u
        .test(normalizedQuestion);
      if (requestsCustomerList || hasCustomerMatch) {
        const customers = await Customer.find(customerFilter)
          .select('name status archivedAt packageId address phone')
          .populate('packageId', 'name speed price')
          .sort({ name: 1 })
          .limit(101)
          .lean();
        data[topics.includes('archive') ? 'archivedCustomers' : 'customers'] = customers.slice(0, 100).map((customer) => {
          const packageValue = customer.packageId;
          const packageInfo = typeof packageValue === 'object' && packageValue !== null && 'name' in packageValue
            ? {
                name: packageValue.name,
                speed: 'speed' in packageValue ? packageValue.speed : undefined,
                price: 'price' in packageValue ? packageValue.price : undefined,
              }
            : null;
          return {
            name: customer.name,
            status: customer.status,
            ...(addressMatchedIds.has(customer._id.toString()) && { matchedByAddress: true }),
            ...(topics.includes('archive') && { archivedAt: customer.archivedAt }),
            package: packageInfo,
            ...(showAddress && { address: customer.address }),
            ...(showPhone && { phone: customer.phone }),
          };
        });
        if (customers.length > 100) data.customerListTruncated = true;
      } else if (asksBroadData) {
        data.customerCount = allCustomers.length;
      } else {
        data[topics.includes('archive') ? 'archivedCustomers' : 'customers'] = [];
      }
    }

    const customerIds = hasCustomerMatch
      ? matchingIds
      : asksBroadData
        ? allCustomers.map((customer) => customer._id)
        : [];

    const asksForBillingDetails = /\b(?:daftar|semua|seluruh|siapa|detail|rincian|riwayat|transaksi)\b/u
      .test(normalizedQuestion);
    if (topics.includes('billing') && (asksForBillingDetails || hasCustomerMatch || !topics.includes('reports'))) {
      const period = getRequestedPeriod(question);
      const periodRequested = /\b(?:bulan|periode|tahun)\b/u.test(normalizedQuestion)
        || months.some((month) => normalizedQuestion.includes(normalizeText(month)))
        || /\b20\d{2}\b/.test(question);
      const paymentDetails = /\b(?:riwayat|detail|rincian|transaksi|metode|cash|transfer|tunai)\b/u.test(normalizedQuestion);
      const billingQuery: Record<string, unknown> = { customerId: { $in: customerIds } };
      if (periodRequested) {
        billingQuery.month = period.month;
        billingQuery.year = period.year;
      }
      const billings = await Billing.find(billingQuery)
        .select('customerId customerName month year status packagePrice paidAmount installmentAmount paymentHistory')
        .sort({ year: -1, createdAt: -1 })
        .limit(201)
        .lean();
      data.billings = billings.slice(0, 200).map((billing) => ({
        customerName: billing.customerName,
        month: billing.month,
        year: billing.year,
        status: billing.status,
        totalDue: getBillingTotalDue(billing),
        paidAmount: getBillingPaidAmount(billing),
        outstandingAmount: getBillingOutstandingAmount(billing),
        ...(paymentDetails && {
          payments: (billing.paymentHistory || []).slice(-10).map((payment) => ({
            amount: payment.amount,
            date: payment.addedAt,
            method: payment.method || payment.status,
          })),
        }),
      }));
      if (billings.length > 200) data.billingHistoryTruncated = true;
    }

    if (topics.includes('reports')) {
      const period = getRequestedPeriod(question);
      const activeCustomerIds = await Customer.distinct('_id', {
        ...ownerFilter,
        status: { $ne: 'inactive' },
        ...((hasCustomerMatch || !asksBroadData) ? { _id: { $in: matchingIds } } : {}),
      });
      const currentBillings = await Billing.find({
        customerId: { $in: activeCustomerIds },
        month: period.month,
        year: period.year,
      }).select('customerId status packagePrice paidAmount installmentAmount').lean();
      const amounts = currentBillings.map(getMonthlyBillingAmounts);
      data.report = {
        month: period.month,
        year: period.year,
        customerCount: activeCustomerIds.length,
        billingCount: currentBillings.length,
        totalDue: amounts.reduce((sum, item) => sum + item.due, 0),
        totalPaid: amounts.reduce((sum, item) => sum + item.paid, 0),
        totalOutstanding: amounts.reduce((sum, item) => sum + item.outstanding, 0),
        unpaidBillings: amounts.filter((item) => item.outstanding > 0).length,
        installmentBillings: currentBillings.filter((billing) => billing.status === 'Nyicil').length,
      };
    }

    if (topics.includes('collection')) {
      const period = getRequestedPeriod(question);
      const activeCustomerIds = await Customer.distinct('_id', {
        ...ownerFilter,
        status: { $ne: 'inactive' },
        ...((hasCustomerMatch || !asksBroadData) ? { _id: { $in: matchingIds } } : {}),
      });
      const [currentBillings, visits] = await Promise.all([
        Billing.find({
          customerId: { $in: activeCustomerIds },
          month: period.month,
          year: period.year,
        }).select('customerId customerName packagePrice paidAmount installmentAmount status').lean(),
        CollectionVisit.find({
          customerId: { $in: activeCustomerIds },
          month: period.month,
          year: period.year,
        }).select('customerId collectorUsername visitedAt').lean(),
      ]);
      const visitedByCustomer = new Map(visits.map((visit) => [visit.customerId.toString(), visit]));
      data.collection = {
        month: period.month,
        year: period.year,
        customers: currentBillings
          .filter((billing) => getBillingOutstandingAmount(billing) > 0)
          .map((billing) => {
            const visit = visitedByCustomer.get(billing.customerId.toString());
            return {
              customerName: billing.customerName,
              outstandingAmount: getBillingOutstandingAmount(billing),
              visited: Boolean(visit?.visitedAt),
              collector: visit?.collectorUsername || null,
              visitedAt: visit?.visitedAt || null,
            };
          }),
      };
    }

    return NextResponse.json({ topics, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/chat/context failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil konteks website untuk Chat AI' }, { status: 500 });
  }
}
