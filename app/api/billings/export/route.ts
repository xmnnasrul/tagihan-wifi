import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing from '@/lib/models/Billing';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';

    const query: Record<string, unknown> = {};
    if (month) query.month = month;
    if (year) query.year = Number(year);

    const billings = await Billing.find(query).sort({ customerName: 1 });

    const headers = ['Nama Pelanggan', 'Alamat', 'Paket', 'Harga Paket', 'Bulan', 'Tahun', 'Status', 'Nominal Cicilan', 'Catatan'];
    const rows = billings.map((b) => [
      b.customerName,
      b.address,
      b.packageName,
      b.packagePrice,
      b.month,
      b.year,
      b.status,
      b.installmentAmount,
      b.note,
    ]);

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
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
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
