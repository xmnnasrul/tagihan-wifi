import { getOwnerFilter, type OwnerScope } from './owner-filter.ts';
import { escapeRegex } from './regex.ts';

export interface BillingFilterParams {
  month?: string | null;
  year?: string | null;
  customerName?: string | null;
  status?: string | null;
}

export interface VisibleCustomerOptions {
  customerId?: string | null;
  includeArchived?: boolean;
}

/** Filter daftar tagihan dari query string. Nilai kosong dan status "all" diabaikan. */
export function buildBillingFilter(params: BillingFilterParams): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (params.month) query.month = params.month;
  if (params.year) query.year = Number(params.year);
  if (params.customerName) {
    query.customerName = { $regex: escapeRegex(params.customerName), $options: 'i' };
  }
  if (params.status && params.status !== 'all') query.status = params.status;

  return query;
}

/**
 * Filter pelanggan yang boleh muncul di daftar tagihan.
 * Pelanggan arsip hanya ikut jika diminta eksplisit beserta customerId-nya.
 */
export function getVisibleCustomerFilter(
  ownerScope: OwnerScope,
  options: VisibleCustomerOptions = {},
): Record<string, unknown> {
  const includeArchivedCustomer = Boolean(options.includeArchived) && Boolean(options.customerId);

  if (includeArchivedCustomer) {
    return { ...getOwnerFilter(ownerScope), _id: options.customerId, status: 'inactive' };
  }

  return {
    ...getOwnerFilter(ownerScope),
    ...(options.customerId ? { _id: options.customerId } : {}),
    status: { $ne: 'inactive' },
  };
}
