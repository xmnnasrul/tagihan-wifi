import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing from '@/lib/models/Billing';
import * as XLSX from 'xlsx';
import { requireAuthenticatedUser } from '@/lib/session';
import { getBillingPaidAmount, getBillingTotalDue } from '@/lib/billing-amounts';

export async function GET(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';

    const query: Record<string, unknown> = {};
    if (month) query.month = month;
    if (year) query.year = Number(year);

    const billings = await Billing.find(query).sort({ customerName: 1 });

    const headers = [
      'Nama Pelanggan', 'Alamat', 'Paket', 'Harga Paket', 'Utang Terbawa', 'Total Tagihan',
      'Total Dibayar', 'Sisa Tagihan', 'Bulan', 'Tahun', 'Status', 'Jumlah Pembayaran',
      'Riwayat Pembayaran', 'Catatan Tagihan',
    ];
    const rows = billings.map((billing) => {
      const totalDue = getBillingTotalDue(billing);
      const paidAmount = getBillingPaidAmount(billing);
      const paymentHistory = (billing.paymentHistory || []).map((payment) => {
        const paidAt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(payment.addedAt));
        const note = payment.note ? `; catatan: ${payment.note}` : '';
        return `${paidAt} - Rp${new Intl.NumberFormat('id-ID').format(payment.amount)} oleh ${payment.addedBy || 'Admin'}${note}`;
      }).join(' | ');
      const text = (value: string) => /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;

      return [
        text(billing.customerName),
        text(billing.address),
        text(billing.packageName),
        billing.packagePrice,
        billing.carriedAmount || 0,
        totalDue,
        paidAmount,
        Math.max(0, totalDue - paidAmount),
        text(billing.month),
        billing.year,
        text(billing.status),
        (billing.paymentHistory || []).length,
        text(paymentHistory),
        text(billing.note || ''),
      ];
    });

    if (format === 'xlsx') {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tagihan');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const filename = `tagihan${month ? '_' + month : ''}${year ? '_' + year : ''}.xlsx`;

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const csvLines = [headers, ...rows].map((row) =>
      row.map((cell) => {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    );

    const csv = '\uFEFF' + csvLines.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tagihan${month ? '_' + month : ''}${year ? '_' + year : ''}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengekspor data' }, { status: 500 });
  }
}
