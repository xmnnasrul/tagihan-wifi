'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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

type Filter = 'all' | 'open' | 'done';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const prefersReducedMotion = useReducedMotion();

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
    if (!value) {
      toast.error('Catatan tidak boleh kosong.');
      return;
    }
    if (value.length > 500) {
      toast.error('Catatan maksimal 500 karakter.');
      return;
    }
    if (saving) return;
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
  const doneCount = notes.filter((note) => note.completed).length;
  const totalCount = notes.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const visibleNotes = useMemo(() => {
    if (filter === 'open') return notes.filter((note) => !note.completed);
    if (filter === 'done') return notes.filter((note) => note.completed);
    return notes;
  }, [notes, filter]);

  const filterOptions: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: 'Semua', count: totalCount },
    { key: 'open', label: 'Belum', count: openCount },
    { key: 'done', label: 'Selesai', count: doneCount },
  ];

  const motionTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' as const };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <motion.header
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionTransition}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Catatan</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pengingat operasional pelanggan, tersimpan untuk akun admin ini.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="tabular-nums">{doneCount}/{totalCount} selesai</span>
          </div>
        </div>
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Progres catatan selesai"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <motion.div
            className="h-full origin-left rounded-full bg-primary"
            initial={prefersReducedMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </motion.header>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut', delay: 0.05 }}
      >
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
                aria-describedby="note-text-counter"
                className="resize-none"
              />
              <div className="flex items-center justify-between gap-3">
                <span id="note-text-counter" className="text-xs text-muted-foreground tabular-nums">
                  {text.length}/500 karakter
                </span>
                <motion.div whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}>
                  <Button type="submit" disabled={!text.trim() || saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Tambah catatan
                  </Button>
                </motion.div>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <section aria-labelledby="notes-list-title">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 id="notes-list-title" className="text-base font-medium">Daftar catatan</h2>
          <div className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-muted/40 p-1" role="tablist" aria-label="Filter catatan">
            {filterOptions.map((option) => {
              const isActive = filter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFilter(option.key)}
                  className={`relative rounded-sm px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="notes-filter-pill"
                      className="absolute inset-0 rounded-[inherit] bg-primary"
                      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10">{option.label}</span>
                  <span className={`relative z-10 ml-1.5 tabular-nums ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground/70'}`}>
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat catatan…
          </div>
        ) : visibleNotes.length === 0 ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground"
          >
            {filter === 'all'
              ? 'Belum ada catatan. Tulis satu di atas untuk mulai.'
              : filter === 'open'
                ? 'Tidak ada catatan yang belum selesai. Bagus.'
                : 'Belum ada catatan yang selesai.'}
          </motion.div>
        ) : (
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {visibleNotes.map((note) => (
                <motion.li
                  key={note._id}
                  layout
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
                  className="flex items-start gap-3 py-4"
                >
                  <motion.div
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                    className="mt-0.5"
                  >
                    <Checkbox
                      id={`note-${note._id}`}
                      checked={note.completed}
                      onCheckedChange={(checked) => void toggleNote(note, checked === true)}
                      aria-label={`Tandai catatan ${note.completed ? 'belum selesai' : 'selesai'}`}
                    />
                  </motion.div>
                  <label
                    htmlFor={`note-${note._id}`}
                    className={`min-w-0 flex-1 cursor-pointer whitespace-pre-wrap break-words text-sm leading-6 transition-colors ${
                      note.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    {note.text}
                  </label>
                  {note.completed && (
                    <motion.span
                      initial={prefersReducedMotion ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 20 }}
                      className="mt-1 shrink-0"
                      aria-hidden="true"
                    >
                      <Check className="h-4 w-4 text-primary" />
                    </motion.span>
                  )}
                  <motion.div whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void deleteNote(note)}
                      aria-label="Hapus catatan"
                      className="-mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}