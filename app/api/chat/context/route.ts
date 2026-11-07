import { NextResponse } from 'next/server';
import type { PipelineStage } from 'mongoose';
import { getArrearsReport } from '@/lib/arrears-report';
import { getAIChatPageAccess, requireAuthenticatedUser } from '@/lib/session';
import { connectDB } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import Billing from '@/lib/models/Billing';
import Package from '@/lib/models/Package';
import Note from '@/lib/models/Note';
import CollectionVisit from '@/lib/models/CollectionVisit';
import { getDataOwnerScope, getOwnerFilter } from '@/lib/data-ownership';
import {
  getBillingOutstandingAmount,
  getBillingPaidAmount,
  getBillingTotalDue,
  getMonthlyBillingAmounts,
} from '@/lib/billing-amounts';
import {
  CHAT_MONTHS,
  getChatContextTopics,
  getChatCustomerAddressQualifierTerms,
  getChatNewCustomerPeriod,
  getChatUnpaidMonthThreshold,
  matchesChatCustomerNameQuery,
  matchesChatCustomerAddressQuery,
  requestsChatCustomerAddress,
  selectChatCustomerMatchIds,
  type ChatNewCustomerPeriod,
  type ChatTablePageSource,
} from '@/lib/chat-answer';

const CHAT_TABLE_PAGE_SIZE = 20;

function getJakartaPeriod() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  return {
    month: CHAT_MONTHS[Number(parts.find((part) => part.type === 'month')?.value) - 1],
    year: Number(parts.find((part) => part.type === 'year')?.value),
  };
}

function getJakartaDayRange(dayOffset: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  const localStart = Date.UTC(year, month - 1, day + dayOffset);
  return {
    $gte: new Date(localStart - jakartaOffsetMs),
    $lt: new Date(localStart + 24 * 60 * 60 * 1000 - jakartaOffsetMs),
  };
}

function getJakartaMonthRange(year: number, month: typeof CHAT_MONTHS[number]) {
  const monthIndex = CHAT_MONTHS.indexOf(month);
  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  return {
    $gte: new Date(Date.UTC(year, monthIndex, 1) - jakartaOffsetMs),
    $lt: new Date(Date.UTC(year, monthIndex + 1, 1) - jakartaOffsetMs),
  };
}

function getNewCustomerMonthSelection(period: ChatNewCustomerPeriod) {
  const current = getJakartaPeriod();
  if (period === 'current') return { ...current, label: 'bulan ini' };
  if (period === 'previous') {
    const previous = new Date(Date.UTC(current.year, CHAT_MONTHS.indexOf(current.month) - 1, 1));
    const month = CHAT_MONTHS[previous.getUTCMonth()];
    const year = previous.getUTCFullYear();
    return { month, year, label: 'bulan lalu' };
  }
  const year = period.year ?? current.year;
  return { month: period.month, year, label: `${period.month} ${year}` };
}

function getRequestedPeriod(question: string) {
  const current = getJakartaPeriod();
  const month = CHAT_MONTHS.find((candidate) => question.toLocaleLowerCase().includes(candidate.toLocaleLowerCase()));
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
    const normalizedQuestion = ` ${normalizeText(question)} `;
    const currentQuestion = question.split('\n').filter((line) => line.trim()).at(-1) || question;
    const normalizedCurrentQuestion = ` ${normalizeText(currentQuestion)} `;
    const requestedPage = Number(searchParams.get('page') || 1);
    if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > 10_000) {
      return NextResponse.json({ error: 'Nomor halaman tabel tidak valid.' }, { status: 400 });
    }
    const sourceParameter = searchParams.get('source');
    const pageSource: ChatTablePageSource = sourceParameter
      ? sourceParameter as ChatTablePageSource
      : topics.includes('packages')
        ? 'packages'
        : topics.includes('notes')
          ? 'notes'
          : topics.includes('billing')
            ? /\blebih dari \d+ bulan\b/u.test(normalizedQuestion) ? 'overdueCustomers' : 'billings'
            : topics.includes('collection')
              ? /\b(?:kemarin|hari sebelumnya)\b/u.test(normalizedQuestion) ? 'visits' : 'collectionCustomers'
              : includeArchived ? 'archivedCustomers' : 'customers';
    const allowedPageSources: readonly string[] = [
      'customers', 'archivedCustomers', 'packages', 'notes',
      'billings', 'overdueCustomers', 'visits', 'collectionCustomers',
    ];
    if (!allowedPageSources.includes(pageSource)) {
      return NextResponse.json({ error: 'Sumber halaman tabel tidak valid.' }, { status: 400 });
    }
    const pageOffset = (requestedPage - 1) * CHAT_TABLE_PAGE_SIZE;
    let hasNextPage = false;
    const pageRows = <T>(source: ChatTablePageSource, rows: T[]) => {
      if (pageSource === source) hasNextPage = rows.length > CHAT_TABLE_PAGE_SIZE;
      return rows.slice(0, CHAT_TABLE_PAGE_SIZE);
    };
    const newCustomersPeriod = getChatNewCustomerPeriod(question);
    const newCustomerSelection = newCustomersPeriod ? getNewCustomerMonthSelection(newCustomersPeriod) : null;
    const asksNewCustomers = newCustomersPeriod !== null;
    const asksAddress = requestsChatCustomerAddress(question);
    const asksYesterdayVisit = topics.includes('collection')
      && /\b(?:kemarin|hari sebelumnya)\b/u.test(normalizedQuestion);
    const statusFilter = includeArchived
      ? { status: 'inactive' as const }
      : { status: { $ne: 'inactive' as const } };
    const createdAtFilter = newCustomerSelection
      ? { createdAt: getJakartaMonthRange(newCustomerSelection.year, newCustomerSelection.month) }
      : {};
    const needsCustomerLookup = topics.some((topic) =>
      ['customers', 'billing', 'reports', 'archive', 'collection'].includes(topic));
    const allCustomers = needsCustomerLookup
      ? await Customer.find({
          ...ownerFilter,
          ...statusFilter,
          ...createdAtFilter,
        }).select('_id name').lean()
      : [];
    const customersMatchingName = allCustomers.filter((customer) =>
      matchesChatCustomerNameQuery(question, customer.name));
    const nameMatchingIds = customersMatchingName.map((customer) => customer._id);
    const hasAddressQualifier = needsCustomerLookup && (customersMatchingName.length > 0
      ? customersMatchingName.some((customer) =>
        getChatCustomerAddressQualifierTerms(question, customer.name).length > 0)
      : getChatCustomerAddressQualifierTerms(question, '').length > 0);
    const addressSearchCandidates = customersMatchingName.length > 0
      ? customersMatchingName
      : hasAddressQualifier ? allCustomers : [];
    const addressMatchedIds = new Set<string>();
    if (hasAddressQualifier && addressSearchCandidates.length > 0) {
      const addressCandidateIds = addressSearchCandidates.map((customer) => customer._id);
      const candidatesWithAddress = await Customer.find({
        ...ownerFilter,
        ...statusFilter,
        _id: { $in: addressCandidateIds },
      }).select('_id address').lean();
      const nameById = new Map(addressSearchCandidates.map((customer) => [customer._id.toString(), customer.name]));
      candidatesWithAddress.forEach((customer) => {
        const customerName = nameById.get(customer._id.toString());
        if (customerName && matchesChatCustomerAddressQuery(question, customerName, customer.address || '')) {
          addressMatchedIds.add(customer._id.toString());
        }
      });
    }
    const addressMatchingIds = addressSearchCandidates
      .filter((customer) => addressMatchedIds.has(customer._id.toString()))
      .map((customer) => customer._id);
    const matchingIds = selectChatCustomerMatchIds(nameMatchingIds, addressMatchingIds, hasAddressQualifier);
    const hasCustomerMatch = matchingIds.length > 0;
    const asksBroadData = /\b(?:daftar|semua|seluruh|siapa|berapa|jumlah|total|laporan|statistik|ringkasan|rekap|bulan|periode|tahun|data)\b/u
      .test(normalizedQuestion);
    const customerFilter = {
      ...ownerFilter,
      ...statusFilter,
      ...createdAtFilter,
      ...((hasCustomerMatch || hasAddressQualifier || !asksBroadData) ? { _id: { $in: matchingIds } } : {}),
    };
    const data: Record<string, unknown> = {};
    const addressByCustomerId = new Map<string, string>();

    if (topics.includes('packages')) {
      const packages = await Package.find(ownerFilter)
        .select('name price speed description')
        .sort({ price: 1, name: 1 })
        .skip(pageSource === 'packages' ? pageOffset : 0)
        .limit(CHAT_TABLE_PAGE_SIZE + 1)
        .lean();
      data.packages = pageRows('packages', packages).map(({ name, price, speed, description }) => ({
        name,
        price,
        speed,
        ...(description?.trim() && { description }),
      }));
    }

    if (topics.includes('notes')) {
      const notes = await Note.find({ ownerId: ownerScope.ownerId })
        .select('text completed createdAt')
        .sort({ completed: 1, createdAt: -1 })
        .skip(pageSource === 'notes' ? pageOffset : 0)
        .limit(CHAT_TABLE_PAGE_SIZE + 1)
        .lean();
      data.notes = pageRows('notes', notes).map(({ text, completed, createdAt }) => ({
        text,
        completed,
        createdAt,
      }));
    }

    let customerNotFound = needsCustomerLookup && hasAddressQualifier && !hasCustomerMatch && !asksNewCustomers;
    let unpaidBillingNotFound = false;
    let newCustomersNotFound = false;
    let visitedYesterdayNotFound = false;

    if ((topics.includes('customers') || topics.includes('archive')) && !asksYesterdayVisit) {
      const showAddress = asksAddress;
      const showPhone = /\b(?:nomor|telepon|kontak)\b/u.test(normalizedQuestion);
      const requestsCustomerList = /\b(?:daftar|semua|seluruh|siapa|tampilkan|cari|carikan|cariin|carikn|nyari|cek|periksa|lihat|liatin|lihatin|alamat|nomor|telepon|kontak)\b/u
        .test(normalizedQuestion);
      if (requestsCustomerList || hasCustomerMatch) {
        const customers = await Customer.find(customerFilter)
          .select('name status archivedAt packageId address phone createdAt')
          .populate('packageId', 'name speed price')
          .sort({ name: 1 })
          .skip(pageSource === (includeArchived ? 'archivedCustomers' : 'customers') ? pageOffset : 0)
          .limit(CHAT_TABLE_PAGE_SIZE + 1)
          .lean();
        customers.forEach((customer) => {
          if (asksAddress && typeof customer.address === 'string' && customer.address.trim()) {
            addressByCustomerId.set(customer._id.toString(), customer.address.trim());
          }
        });
        const customerPageSource = includeArchived ? 'archivedCustomers' : 'customers';
        data[customerPageSource] = pageRows(customerPageSource, customers).map((customer) => {
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
            ...(asksNewCustomers && { createdAt: customer.createdAt }),
            ...(showAddress && { address: customer.address }),
            ...(showPhone && { phone: customer.phone }),
          };
        });
        if (asksNewCustomers) {
          data.newCustomersOnly = true;
          data.newCustomersPeriod = newCustomersPeriod;
          data.newCustomersPeriodLabel = newCustomerSelection?.label;
        }
        if (requestsCustomerList && customers.length === 0) {
          if (asksNewCustomers) newCustomersNotFound = true;
          else customerNotFound = true;
        }
      } else if (asksBroadData) {
        data.customerCount = allCustomers.length;
      } else {
        data[topics.includes('archive') ? 'archivedCustomers' : 'customers'] = [];
      }
    }

    const customerIds = hasCustomerMatch || hasAddressQualifier
      ? matchingIds
      : asksBroadData
        ? allCustomers.map((customer) => customer._id)
        : [];

    const asksUnpaid = /\b(?:belum\s+(?:bayar|membayar|dibayar|lunas|transfer)|nunggak|tunggakan|utang)\b/u
      .test(normalizedCurrentQuestion);
    const minimumUnpaidMonths = asksUnpaid ? getChatUnpaidMonthThreshold(question) : null;
    const asksForBillingDetails = /\b(?:daftar|semua|seluruh|siapa|detail|rincian|riwayat|history|transaksi)\b/u
      .test(normalizedQuestion);
    if (topics.includes('billing') && (asksForBillingDetails || hasCustomerMatch || !topics.includes('reports'))) {
      const period = getRequestedPeriod(question);
      const periodRequested = minimumUnpaidMonths === null && (/\b(?:bulan|periode|tahun)\b/u.test(normalizedQuestion)
        || CHAT_MONTHS.some((month) => normalizedQuestion.includes(normalizeText(month)))
        || /\b20\d{2}\b/.test(question));
      const paymentDetails = /\b(?:riwayat|history|detail|rincian|transaksi|metode|cash|transfer|tunai)\b/u
        .test(normalizedCurrentQuestion);
      const asksForBillingHistory = /\b(?:riwayat|history|transaksi)\b/u.test(normalizedCurrentQuestion);
      const billingQuery: Record<string, unknown> = { customerId: { $in: customerIds } };
      if (periodRequested) {
        billingQuery.month = period.month;
        billingQuery.year = period.year;
      }
      data.unpaidOnly = asksUnpaid;
      data.billingHistory = asksForBillingHistory && !asksUnpaid;
      if (minimumUnpaidMonths !== null) {
        const arrearsPipeline: PipelineStage[] = [
          { $match: billingQuery },
          {
            $addFields: {
              _chatPaidAmount: {
                $cond: [
                  { $gt: ['$paidAmount', 0] },
                  { $min: ['$packagePrice', '$paidAmount'] },
                  {
                    $cond: [
                      { $in: ['$status', ['TF', 'Cash', 'Lunas']] },
                      '$packagePrice',
                      { $min: ['$packagePrice', { $ifNull: ['$installmentAmount', 0] }] },
                    ],
                  },
                ],
              },
            },
          },
          {
            $addFields: {
              _chatOutstanding: { $max: [0, { $subtract: ['$packagePrice', '$_chatPaidAmount'] }] },
            },
          },
          { $match: { _chatOutstanding: { $gt: 0 } } },
          {
            $group: {
              _id: { customerId: '$customerId', month: '$month', year: '$year' },
              customerName: { $first: '$customerName' },
              outstandingAmount: { $sum: '$_chatOutstanding' },
            },
          },
          {
            $group: {
              _id: '$_id.customerId',
              customerName: { $first: '$customerName' },
              unpaidMonths: { $sum: 1 },
              totalOutstanding: { $sum: '$outstandingAmount' },
            },
          },
          { $match: { unpaidMonths: { $gte: minimumUnpaidMonths } } },
          { $sort: { unpaidMonths: -1, customerName: 1 } },
          { $skip: pageSource === 'overdueCustomers' ? pageOffset : 0 },
          { $limit: CHAT_TABLE_PAGE_SIZE + 1 },
        ];
        const overdueCustomers = await Billing.aggregate(arrearsPipeline);
        data.minimumUnpaidMonths = minimumUnpaidMonths;
        data.overdueCustomers = pageRows('overdueCustomers', overdueCustomers).map((customer) => ({
          name: customer.customerName,
          unpaidMonths: customer.unpaidMonths,
          totalOutstanding: customer.totalOutstanding,
        }));
        data.billings = [];
        unpaidBillingNotFound = requestedPage === 1 && overdueCustomers.length === 0;
      } else {
        const billingQueryResult = await Billing.find(billingQuery)
          .select('customerId customerName month year status packagePrice paidAmount installmentAmount note createdAt paymentHistory')
          .sort({ year: -1, createdAt: -1 })
          .skip(!asksUnpaid && pageSource === 'billings' ? pageOffset : 0)
          .limit(asksUnpaid ? 0 : CHAT_TABLE_PAGE_SIZE + 1)
          .lean();
        const billingData = billingQueryResult.map((billing) => ({
          customerName: billing.customerName,
          ...(addressMatchedIds.has(billing.customerId.toString()) && { matchedByAddress: true }),
          ...(asksAddress && addressByCustomerId.has(billing.customerId.toString())
            ? { address: addressByCustomerId.get(billing.customerId.toString()) }
            : {}),
          month: billing.month,
          year: billing.year,
          status: billing.status,
          packagePrice: billing.packagePrice,
          totalDue: getBillingTotalDue(billing),
          paidAmount: getBillingPaidAmount(billing),
          outstandingAmount: getBillingOutstandingAmount(billing),
          ...(paymentDetails && {
            note: billing.note || '',
            createdAt: billing.createdAt,
            payments: (billing.paymentHistory || []).map((payment) => ({
              amount: payment.amount,
              date: payment.addedAt,
              addedBy: payment.addedBy,
              status: payment.status,
              method: payment.method,
              note: payment.note,
              isSettlementAllocation: payment.isSettlementAllocation,
            })),
          }),
        }));
        const selectedBillings = asksUnpaid
          ? billingData.filter((billing) => billing.outstandingAmount > 0)
          : billingData;
        data.billings = asksUnpaid
          ? pageRows('billings', selectedBillings.slice(pageOffset, pageOffset + CHAT_TABLE_PAGE_SIZE + 1))
          : pageRows('billings', selectedBillings);
        unpaidBillingNotFound = asksUnpaid && customerIds.length > 0 && selectedBillings.length === 0;
      }
    }

    if (topics.includes('reports')) {
      const period = getRequestedPeriod(question);
      const activeCustomerIds = await Customer.distinct('_id', {
        ...ownerFilter,
        status: { $ne: 'inactive' },
        ...((hasCustomerMatch || hasAddressQualifier || !asksBroadData) ? { _id: { $in: matchingIds } } : {}),
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
      if (asksYesterdayVisit) {
        const visits = await CollectionVisit.find({
          customerId: { $in: customerIds },
          visitedAt: getJakartaDayRange(-1),
        })
          .select('customerId collectorUsername visitedAt')
          .sort({ visitedAt: 1 })
          .skip(pageSource === 'visits' ? pageOffset : 0)
          .limit(CHAT_TABLE_PAGE_SIZE + 1)
          .lean();
        const visitedCustomerIds = visits.map((visit) => visit.customerId);
        const visitedCustomers = await Customer.find({
          ...ownerFilter,
          ...statusFilter,
          _id: { $in: visitedCustomerIds },
        }).select('_id name address').lean();
        const customersById = new Map(visitedCustomers.map((customer) => [customer._id.toString(), customer]));
        const visitData = visits.flatMap((visit) => {
          const customer = customersById.get(visit.customerId.toString());
          if (!customer) return [];
          return [{
            customerName: customer.name,
            ...(typeof customer.address === 'string' && customer.address.trim()
              ? { address: customer.address.trim() }
              : {}),
            collector: visit.collectorUsername,
            visitedAt: visit.visitedAt,
          }];
        });
        data.collection = {
          visitedYesterday: true,
          visits: pageRows('visits', visitData),
        };
        visitedYesterdayNotFound = visitData.length === 0;
      } else {
        const period = getRequestedPeriod(question);
        const activeCustomerIds = await Customer.distinct('_id', {
          ...ownerFilter,
          status: { $ne: 'inactive' },
          ...((hasCustomerMatch || hasAddressQualifier || !asksBroadData) ? { _id: { $in: matchingIds } } : {}),
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
        const collectionCustomers = currentBillings
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
          });
        const selectedCollectionCustomers = pageRows(
          'collectionCustomers',
          collectionCustomers.slice(
            pageSource === 'collectionCustomers' ? pageOffset : 0,
            (pageSource === 'collectionCustomers' ? pageOffset : 0) + CHAT_TABLE_PAGE_SIZE + 1,
          ),
        );
        data.collection = {
          month: period.month,
          year: period.year,
          customers: selectedCollectionCustomers,
        };
      }
    }

    return NextResponse.json({
      topics,
      data,
      pagination: {
        question,
        source: pageSource,
        page: requestedPage,
        pageSize: CHAT_TABLE_PAGE_SIZE,
        hasNext: hasNextPage,
      },
      ...(newCustomersNotFound && {
        notFound: 'new-customers',
        ...(newCustomerSelection && { notFoundPeriod: newCustomerSelection.label }),
      }),
      ...(customerNotFound && { notFound: 'customer' }),
      ...(visitedYesterdayNotFound && { notFound: 'visits-yesterday' }),
      ...(!customerNotFound && unpaidBillingNotFound && {
        notFound: minimumUnpaidMonths !== null ? 'unpaid-threshold' : 'unpaid-billing',
        ...(minimumUnpaidMonths !== null && { minimumUnpaidMonths }),
      }),
      ...(topics.length === 1 && topics.includes('packages')
        && Array.isArray(data.packages) && data.packages.length === 0 && { notFound: 'packages' }),
      ...(topics.length === 1 && topics.includes('notes')
        && Array.isArray(data.notes) && data.notes.length === 0 && { notFound: 'notes' }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/chat/context failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil konteks website untuk Chat AI' }, { status: 500 });
  }
}
