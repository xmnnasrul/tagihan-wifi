import { NextResponse } from 'next/server';
import { getArrearsReport } from '@/lib/arrears-report';
import { getAIChatPageAccess, requireAuthenticatedUser } from '@/lib/session';

export async function GET() {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  try {
    const access = await getAIChatPageAccess();
    if (!access.allowed) {
      return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403 });
    }

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
  } catch (error) {
    console.error('GET /api/chat/context failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil konteks tunggakan untuk Chat AI' }, { status: 500 });
  }
}
