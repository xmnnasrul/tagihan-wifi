import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/session';
import { getArrearsReport } from '@/lib/arrears-report';

export async function GET() {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    return NextResponse.json(await getArrearsReport());
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil laporan tunggakan' }, { status: 500 });
  }
}