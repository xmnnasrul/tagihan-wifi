import type { IBilling } from './models/Billing';

type TxtBilling = Pick<
  IBilling,
  'customerId' | 'customerName' | 'address' | 'month' | 'year' | 'packagePrice' | 'paidAmount' | 'installmentAmount' | 'status'
>;

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const getPeriodIndex = (year: number, month: string) => year * 12 + months.indexOf(month);

function formatMonths(periods: Array<{ month: string; year: number }>) {
  const crossesYears = periods[0].year !== periods[periods.length - 1].year;
  return periods.map(({ month, year }) => {
    const monthIndex = months.indexOf(month);
    return `${shortMonths[monthIndex] || month}${crossesYears ? ` ${year}` : ''}`;
  }).join('-');
}

export function formatTxtBillingExport(
  billings: readonly TxtBilling[],
  getOutstandingAmount: (billing: TxtBilling) => number,
) {
  const customers = new Map<string, {
    customerName: string;
    address: string;
    outstandingAmount: number;
    latestPeriodIndex: number;
    periods: Array<{ month: string; year: number }>;
  }>();

  for (const billing of billings) {
    const customerId = billing.customerId.toString();
    const customer = customers.get(customerId) || {
      customerName: billing.customerName,
      address: billing.address,
      outstandingAmount: 0,
      latestPeriodIndex: -1,
      periods: [],
    };
    const currentPeriodIndex = getPeriodIndex(billing.year, billing.month);

    if (currentPeriodIndex >= customer.latestPeriodIndex) {
      customer.customerName = billing.customerName;
      customer.address = billing.address;
      customer.latestPeriodIndex = currentPeriodIndex;
    }

    const outstandingAmount = getOutstandingAmount(billing);
    customer.outstandingAmount += outstandingAmount;
    if (outstandingAmount > 0) {
      customer.periods.push({ month: billing.month, year: billing.year });
    }
    customers.set(customerId, customer);
  }

  return Array.from(customers.values())
    .filter((customer) => customer.periods.length > 0)
    .map((customer) => ({
      ...customer,
      periods: customer.periods.sort((a, b) => getPeriodIndex(a.year, a.month) - getPeriodIndex(b.year, b.month)),
    }))
    .sort((a, b) => a.customerName.localeCompare(b.customerName, 'id'))
    .map((customer, index) => {
      const customerDetails = [customer.customerName, customer.address]
        .map((value) => String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim())
        .filter(Boolean)
        .join(' ');
      const amountAndMonths = customer.periods.length > 1
        ? ` ${customer.outstandingAmount / 1000} (${formatMonths(customer.periods)})`
        : '';

      return `${index + 1}. ${customerDetails}${amountAndMonths}`;
    })
    .join('\n\n') || 'Tidak ada data yang sesuai dengan filter.';
}
