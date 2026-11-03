'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

interface Note {
  _id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const response = await fetch('/api/notes');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat catatan');
      setNotes(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat catatan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  const addNote = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value }),
      });
      const note = await response.json();
      if (!response.ok) throw new Error(note.error || 'Gagal menyimpan catatan');
      setNotes((current) => [note, ...current]);
      setText('');
      toast.success('Catatan ditambahkan');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan catatan');
    } finally {
      setSaving(false);
    }
  };

  const toggleNote = async (note: Note, completed: boolean) => {
    setNotes((current) => current.map((item) => item._id === note._id ? { ...item, completed } : item));
    try {
      const response = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note._id, completed }),
      });
      if (!response.ok) throw new Error('Gagal memperbarui checklist');
      setNotes((current) => current
        .slice()
        .sort((a, b) => Number(a.completed) - Number(b.completed) || Date.parse(b.createdAt) - Date.parse(a.createdAt)));
    } catch {
      setNotes((current) => current.map((item) => item._id === note._id ? { ...item, completed: note.completed } : item));
      toast.error('Gagal memperbarui checklist');
    }
  };

  const deleteNote = async (note: Note) => {
    try {
      const response = await fetch(`/api/notes?id=${encodeURIComponent(note._id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus catatan');
      setNotes((current) => current.filter((item) => item._id !== note._id));
      toast.success('Catatan dihapus');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus catatan');
    }
  };

  const openCount = notes.filter((note) => !note.completed).length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Catatan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pengingat operasional pelanggan, tersimpan untuk akun admin ini.</p>
      </header>

      <Card className="border-border/70">
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={addNote} className="space-y-3">
            <label htmlFor="note-text" className="text-sm font-medium">Tulis catatan</label>
            <Textarea
              id="note-text"
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              required
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{text.length}/500</span>
              <Button type="submit" disabled={!text.trim() || saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Tambah catatan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="notes-list-title">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="notes-list-title" className="text-base font-medium">Daftar catatan</h2>
          <span className="text-sm text-muted-foreground">{openCount} belum selesai</span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat catatan…</div>
        ) : notes.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Belum ada catatan.</div>
        ) : (
          <ul className="divide-y divide-border">
            {notes.map((note) => (
              <li key={note._id} className="flex items-start gap-3 py-4">
                <Checkbox
                  id={`note-${note._id}`}
                  checked={note.completed}
                  onCheckedChange={(checked) => void toggleNote(note, checked === true)}
                  aria-label={`Tandai catatan ${note.completed ? 'belum selesai' : 'selesai'}`}
                  className="mt-0.5"
                />
                <label
                  htmlFor={`note-${note._id}`}
                  className={`min-w-0 flex-1 cursor-pointer whitespace-pre-wrap break-words text-sm leading-6 ${note.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                >
                  {note.text}
                </label>
                {note.completed && <Check className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                <Button type="button" variant="ghost" size="icon" onClick={() => void deleteNote(note)} aria-label="Hapus catatan" className="-mt-1 shrink-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}