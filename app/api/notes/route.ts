import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Note from '@/lib/models/Note';
import { getDataOwnerScope } from '@/lib/data-ownership';
import { requireAdmin } from '@/lib/session';

export async function GET() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const { ownerId } = await getDataOwnerScope();
    const notes = await Note.find({ ownerId }).sort({ completed: 1, createdAt: -1 }).lean();
    return NextResponse.json(notes.map(({ _id, text, completed, createdAt }) => ({
      _id: _id.toString(), text, completed, createdAt,
    })));
  } catch (error) {
    console.error('GET /api/notes failed:', error);
    return NextResponse.json({ error: 'Gagal memuat catatan' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 500) {
      return NextResponse.json({ error: 'Catatan wajib diisi dan maksimal 500 karakter' }, { status: 400 });
    }

    await connectDB();
    const { ownerId } = await getDataOwnerScope();
    const note = await Note.create({ ownerId, text });
    return NextResponse.json({ _id: note._id.toString(), text: note.text, completed: note.completed, createdAt: note.createdAt }, { status: 201 });
  } catch (error) {
    console.error('POST /api/notes failed:', error);
    return NextResponse.json({ error: 'Gagal menyimpan catatan' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!Types.ObjectId.isValid(id) || typeof body.completed !== 'boolean') {
      return NextResponse.json({ error: 'Data checklist tidak valid' }, { status: 400 });
    }

    await connectDB();
    const { ownerId } = await getDataOwnerScope();
    const note = await Note.findOneAndUpdate({ _id: id, ownerId }, { completed: body.completed }, { new: true }).lean();
    if (!note) return NextResponse.json({ error: 'Catatan tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ _id: note._id.toString(), text: note.text, completed: note.completed, createdAt: note.createdAt });
  } catch (error) {
    console.error('PATCH /api/notes failed:', error);
    return NextResponse.json({ error: 'Gagal memperbarui checklist' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const id = new URL(request.url).searchParams.get('id') || '';
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'ID catatan tidak valid' }, { status: 400 });

    await connectDB();
    const { ownerId } = await getDataOwnerScope();
    const result = await Note.deleteOne({ _id: id, ownerId });
    if (!result.deletedCount) return NextResponse.json({ error: 'Catatan tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ message: 'Catatan dihapus' });
  } catch (error) {
    console.error('DELETE /api/notes failed:', error);
    return NextResponse.json({ error: 'Gagal menghapus catatan' }, { status: 500 });
  }
}