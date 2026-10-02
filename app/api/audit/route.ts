import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AuditLog, { AuditEntityType } from '@/lib/models/AuditLog';
import { requireAdmin } from '@/lib/session';

const entityTypes: AuditEntityType[] = ['billing', 'customer', 'package', 'admin'];

export async function GET(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30));
    const filter: Record<string, unknown> = {};
    if (entityType && entityTypes.includes(entityType as AuditEntityType)) {
      filter.entityType = entityType;
    }

    const date = searchParams.get('date');
    if (date) {
      const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (!dateMatch) {
        return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 });
      }
      const [, yearValue, monthValue, dayValue] = dateMatch;
      const year = Number(yearValue);
      const month = Number(monthValue);
      const day = Number(dayValue);
      const calendarDate = new Date(Date.UTC(year, month - 1, day));
      if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
        return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 });
      }

      const timezoneOffset = Number(searchParams.get('timezoneOffset') || 0);
      if (!Number.isFinite(timezoneOffset) || Math.abs(timezoneOffset) > 840) {
        return NextResponse.json({ error: 'Zona waktu tidak valid' }, { status: 400 });
      }
      const startOfDay = new Date(Date.UTC(year, month - 1, day) + timezoneOffset * 60_000);
      const startOfNextDay = new Date(Date.UTC(year, month - 1, day + 1) + timezoneOffset * 60_000);
      filter.createdAt = { $gte: startOfDay, $lt: startOfNextDay };
    }
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return NextResponse.json({ items, page, hasMore: page * limit < total });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil log aktivitas' }, { status: 500 });
  }
}