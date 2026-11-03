import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Billing, { IBilling } from '@/lib/models/Billing';
import ExcelJS from 'exceljs';
import { requireAuthenticatedUser } from '@/lib/session';
import Customer from '@/lib/models/Customer';
import { getDataOwnerScope, getOwnerFilter } from '@/lib/data-ownership';
import { formatTxtBillingExport } from '@/lib/billing-export';
import { getBillingOutstandingAmount } from '@/lib/billing-amounts';

const exportColumns = {
  customerName: {
    label: 'Nama Pelanggan',
    value: (billing: IBilling) => billing.customerName,
  },
  address: {
    label: 'Alamat',
    value: (billing: IBilling) => billing.address,
  },
} as const;

type ExportColumnKey = keyof typeof exportColumns;

export async function GET(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const ownerScope = await getDataOwnerScope();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const customerName = searchParams.get('customerName')?.trim();
    const requestedFormat = searchParams.get('format') || 'csv';
    if (!['csv', 'xlsx', 'txt'].includes(requestedFormat)) {
      return NextResponse.json({ error: 'Format ekspor tidak didukung' }, { status: 400 });
    }
    const format = requestedFormat as 'csv' | 'xlsx' | 'txt';
    const requestedColumns = searchParams.get('columns');
    const rawColumns = requestedColumns ? requestedColumns.split(',') : Object.keys(exportColumns);
    const validColumns = Object.keys(exportColumns) as ExportColumnKey[];
    const columns = rawColumns.filter((column): column is ExportColumnKey => validColumns.includes(column as ExportColumnKey));
    if (format !== 'txt' && (!columns.length || columns.length !== rawColumns.length || new Set(columns).size !== columns.length)) {
      return NextResponse.json({ error: 'Pilih minimal satu kolom ekspor yang valid' }, { status: 400 });
    }

    const query: Record<string, unknown> = {};
    const validMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    if (month && !validMonths.includes(month)) {
      return NextResponse.json({ error: 'Bulan tagihan tidak valid' }, { status: 400 });
    }
    if (year && !/^\d{4}$/.test(year)) {
      return NextResponse.json({ error: 'Tahun tagihan tidak valid' }, { status: 400 });
    }
    if (status && !['Belum Bayar', 'Nyicil', 'Cash', 'TF', 'Lunas'].includes(status)) {
      return NextResponse.json({ error: 'Status pembayaran tidak valid' }, { status: 400 });
    }
    if (month && format === 'txt') {
      const monthIndex = validMonths.indexOf(month);
      const monthsThroughSelected = validMonths.slice(0, monthIndex + 1);
      const cutoffYear = year ? Number(year) : new Date().getFullYear();
      query.$or = [
        { year: { $lt: cutoffYear } },
        { year: cutoffYear, month: { $in: monthsThroughSelected } },
      ];
    } else {
      if (month) query.month = month;
      if (year) query.year = Number(year);
    }
    if (status) {
      query.status = status;
    }
    if (customerName) {
      const escapedName = customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.customerName = { $regex: escapedName, $options: 'i' };
    }
    query.customerId = {
      $in: await Customer.distinct('_id', {
        status: { $ne: 'inactive' },
        ...getOwnerFilter(ownerScope),
      }),
    };

    const billings = await Billing.find(query).sort({ customerName: 1 });

    const headers = columns.map((column) => exportColumns[column].label);
    const rows = billings.map((billing) => columns.map((column) => exportColumns[column].value(billing)));
    const safeCell = (value: string | number) => {
      const text = String(value ?? '');
      return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
    };
    const filename = `tagihan${month && /^[\p{L}]+$/u.test(month) ? `_${month}` : ''}${year && /^\d{4}$/.test(year) ? `_${year}` : ''}`;

    if (format === 'txt') {
      const txt = formatTxtBillingExport(billings, getBillingOutstandingAmount);

      return new NextResponse(`\uFEFF${txt}`, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.txt"`,
        },
      });
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Tagihan');
      worksheet.addRows([headers, ...rows.map((row) => row.map((cell) => (
        typeof cell === 'number' ? cell : safeCell(cell)
      )))]);
      const buffer = await workbook.xlsx.writeBuffer();

      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    const csvLines = [headers, ...rows].map((row) =>
      row.map((cell) => {
        const str = safeCell(cell);
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
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengekspor data' }, { status: 500 });
  }
}
