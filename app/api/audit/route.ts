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
    const filter: { entityType?: AuditEntityType } = {};
    if (entityType && entityTypes.includes(entityType as AuditEntityType)) {
      filter.entityType = entityType as AuditEntityType;
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