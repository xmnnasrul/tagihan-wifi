import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Pendaftaran akun tidak tersedia' }, { status: 403 });
}