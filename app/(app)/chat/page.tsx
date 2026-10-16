'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Clock3, ImagePlus, Loader2, MessageCircle, Paperclip, Send, ShieldCheck, Video, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser, useCurrentUserLoading } from '@/components/CurrentUserProvider';
import { ADMIN_CHAT_UPLOAD_CHUNK_SIZE, isAdminChatMediaType } from '@/lib/admin-chat-constants';

interface ChatAttachment {
  uploadId: string;
  fileName: string;
  contentType: string;
  size: number;
  totalChunks: number;
  url: string;
}

interface ChatMessage {
  id: string;
  senderUsername: string;
  text: string;
  createdAt: string;
  expiresAt: string;
  attachment: ChatAttachment | null;
}

const POLL_INTERVAL_MS = 3000;

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function AdminChatPage() {
  const currentUser = useCurrentUser();
  const isUserLoading = useCurrentUserLoading();
  const isAdmin = currentUser?.roles.includes('admin') ?? false;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [connectionError, setConnectionError] = useState('');
  const [sendError, setSendError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const latestMessageTime = useRef<number | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdmin) {
      setIsLoadingMessages(false);
      return;
    }

    let active = true;
    let isFetching = false;

    async function loadMessages(initialLoad: boolean) {
      if (isFetching) return;
      isFetching = true;

      const params = new URLSearchParams();
      if (!initialLoad && latestMessageTime.current !== null) {
        params.set('after', new Date(latestMessageTime.current).toISOString());
      }

      try {
        const response = await fetch(`/api/admin-chat/messages${params.size ? `?${params}` : ''}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.messages)) {
          throw new Error(data.error || 'Gagal memuat pesan chat');
        }
        if (!active) return;

        const incoming = data.messages as ChatMessage[];
        setMessages((current) => {
          const knownIds = new Set(current.map((message) => message.id));
          return [...current, ...incoming.filter((message) => !knownIds.has(message.id))].slice(-100);
        });
        if (incoming.length) {
          latestMessageTime.current = Math.max(
            latestMessageTime.current ?? 0,
            ...incoming.map((message) => new Date(message.createdAt).getTime())
          );
        }
        setConnectionError('');
        setIsConnected(true);
      } catch (error) {
        if (active) {
          setConnectionError(error instanceof Error ? error.message : 'Koneksi chat terputus');
          setIsConnected(false);
        }
      } finally {
        isFetching = false;
        if (active) setIsLoadingMessages(false);
      }
    }

    void loadMessages(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadMessages(false);
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isAdmin]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const handleFileChange = (file: File | null) => {
    setSendError('');
    if (file && !isAdminChatMediaType(file.type)) {
      setSendError('Pilih file gambar atau video yang didukung browser.');
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (isSending || (!text && !selectedFile)) return;

    setIsSending(true);
    setSendError('');
    setUploadProgress(0);

    try {
      let attachment: Omit<ChatAttachment, 'url'> | null = null;
      if (selectedFile) {
        if (!isAdminChatMediaType(selectedFile.type) || selectedFile.size === 0) {
          throw new Error('File gambar/video tidak valid atau kosong.');
        }

        const uploadId = crypto.randomUUID();
        const totalChunks = Math.ceil(selectedFile.size / ADMIN_CHAT_UPLOAD_CHUNK_SIZE);
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
          const start = chunkIndex * ADMIN_CHAT_UPLOAD_CHUNK_SIZE;
          const chunk = selectedFile.slice(start, Math.min(start + ADMIN_CHAT_UPLOAD_CHUNK_SIZE, selectedFile.size));
          const formData = new FormData();
          formData.append('uploadId', uploadId);
          formData.append('fileName', selectedFile.name);
          formData.append('contentType', selectedFile.type);
          formData.append('fileSize', String(selectedFile.size));
          formData.append('totalChunks', String(totalChunks));
          formData.append('chunkIndex', String(chunkIndex));
          formData.append('chunk', chunk, selectedFile.name);

          const response = await fetch('/api/admin-chat/uploads', { method: 'POST', body: formData });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Gagal mengunggah media');
          setUploadProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
        }

        attachment = {
          uploadId,
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          size: selectedFile.size,
          totalChunks,
        };
      }

      const response = await fetch('/api/admin-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, attachment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengirim pesan');

      const sentMessage = data.message as ChatMessage;
      setMessages((current) => [...current, sentMessage].slice(-100));
      latestMessageTime.current = Math.max(
        latestMessageTime.current ?? 0,
        new Date(sentMessage.createdAt).getTime()
      );
      setDraft('');
      setSelectedFile(null);
      setUploadProgress(0);
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Gagal mengirim pesan');
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  if (isUserLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>Fitur chat hanya dapat digunakan oleh akun dengan role Admin.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Chat Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ruang percakapan bersama administrator.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {isConnected ? 'Terhubung' : 'Menghubungkan...'}
        </div>
      </header>

      <section className="flex h-[calc(100dvh-13rem)] min-h-[420px] max-h-[780px] flex-col overflow-hidden rounded-lg border border-border bg-card" aria-label="Ruang chat admin">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">Semua Admin</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" /> Pesan tersimpan 15 hari
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite" aria-relevant="additions">
          {isLoadingMessages ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat percakapan...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 opacity-40" />
              <p className="text-sm">Belum ada pesan. Mulai percakapan admin.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const isOwnMessage = message.senderUsername === currentUser?.username;
                return (
                  <article key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] min-w-0 sm:max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className="flex items-baseline gap-2 px-1 text-xs">
                        <span className="font-semibold text-foreground">{isOwnMessage ? 'Anda' : message.senderUsername}</span>
                        <time className="text-muted-foreground" dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                      </div>
                      <div className={`min-w-0 overflow-hidden rounded-lg border px-3 py-2.5 ${isOwnMessage ? 'border-primary/20 bg-primary text-primary-foreground' : 'border-border bg-muted text-foreground'}`}>
                        {message.attachment && (
                          <div className="mb-2">
                            {message.attachment.contentType?.startsWith('image/') ? (
                              <a href={message.attachment.url} target="_blank" rel="noreferrer" aria-label={`Buka ${message.attachment.fileName}`}>
                                <img
                                  src={message.attachment.url}
                                  alt={message.attachment.fileName}
                                  className="max-h-[420px] max-w-full rounded-md object-contain"
                                />
                              </a>
                            ) : message.attachment.contentType?.startsWith('video/') ? (
                              <video
                                src={message.attachment.url}
                                controls
                                playsInline
                                preload="metadata"
                                className="max-h-[420px] max-w-full rounded-md"
                                aria-label={message.attachment.fileName}
                              />
                            ) : (
                              <a href={message.attachment.url} className="text-sm underline" target="_blank" rel="noreferrer">
                                Buka lampiran: {message.attachment.fileName}
                              </a>
                            )}
                            <p className="mt-1 max-w-full truncate text-[11px] opacity-75" title={message.attachment.fileName}>
                              {message.attachment.fileName} · {formatFileSize(message.attachment.size)}
                            </p>
                          </div>
                        )}
                        {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
                      </div>
                    </div>
                  </article>
                );
              })}
              <div ref={messagesEnd} />
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 sm:p-4">
          {(connectionError || sendError) && (
            <Alert variant="destructive" className="mb-3 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{sendError || connectionError}</AlertDescription>
            </Alert>
          )}

          {selectedFile && (
            <div className="mb-3 flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {selectedFile.type.startsWith('video/') ? <Video className="h-4 w-4 shrink-0 text-primary" /> : <ImagePlus className="h-4 w-4 shrink-0 text-primary" />}
              <span className="min-w-0 flex-1 truncate" title={selectedFile.name}>{selectedFile.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</span>
              {!isSending && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleFileChange(null)} aria-label="Hapus lampiran">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {isSending && selectedFile && (
            <div className="mb-3 flex items-center gap-2" aria-live="polite">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-label="Progres unggah media"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
              >
                <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{uploadProgress}%</span>
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-end gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
              disabled={isSending}
              aria-label="Pilih gambar atau video"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => fileInput.current?.click()}
              disabled={isSending}
              aria-label="Lampirkan gambar atau video"
              title="Lampirkan gambar/video"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Tulis pesan..."
              maxLength={4000}
              rows={2}
              className="min-h-10 max-h-32 resize-y"
              disabled={isSending}
              aria-label="Isi pesan"
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={isSending || (!draft.trim() && !selectedFile)} aria-label="Kirim pesan">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : uploadProgress === 100 ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">Enter untuk kirim · Shift+Enter untuk baris baru · media disimpan tanpa kompresi</p>
        </div>
      </section>
    </div>
  );
}