'use client';

import { FormEvent, KeyboardEvent, TouchEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle, Check, EllipsisVertical, ImagePlus, Loader2, MessageCircle,
  Paperclip, Reply, Send, ShieldCheck, Trash2, Video, X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCurrentUser, useCurrentUserLoading } from '@/components/CurrentUserProvider';
import {
  decryptAdminChatAttachment, decryptAdminChatPayload, encryptAdminChatPayload,
  getOrCreateAdminChatIdentity, type AdminChatIdentity,
} from '@/lib/admin-chat-crypto';
import { ADMIN_CHAT_MAX_ATTACHMENT_SIZE, ADMIN_CHAT_UPLOAD_CHUNK_SIZE, isAdminChatMediaType } from '@/lib/admin-chat-constants';

interface Contact {
  id: string;
  username: string;
  profileImage: string;
  publicKey: string;
}

interface ReplyPreview {
  messageId: string;
  senderId: string;
  text: string;
}

interface ChatContent {
  text: string;
  replyTo: ReplyPreview | null;
  media: { fileName: string; contentType: string } | null;
}

interface ServerAttachment {
  uploadId: string;
  size: number;
  totalChunks: number;
  iv: string;
  url: string;
}

interface EncryptedMessage {
  id: string;
  senderId: string;
  recipientId: string;
  ciphertext: string;
  iv: string;
  wrappedKeys: { userId: string; encryptedKey: string }[];
  createdAt: string;
  expiresAt: string;
  attachment: ServerAttachment | null;
}

interface ChatMessage extends Omit<EncryptedMessage, 'attachment'>, ChatContent {
  encryptedAttachment: ServerAttachment | null;
  attachmentUrl: string | null;
  decryptionError: boolean;
}

const POLL_INTERVAL_MS = 3000;
const MAX_MESSAGE_LENGTH = 4000;

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminAvatar({ contact, size = 'h-10 w-10' }: { contact: Pick<Contact, 'username' | 'profileImage'>; size?: string }) {
  return contact.profileImage ? (
    <Image src={contact.profileImage} alt={`Foto profil ${contact.username}`} width={40} height={40} unoptimized className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary`} aria-hidden="true">
      {contact.username.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function AdminDirectChat() {
  const currentUser = useCurrentUser();
  const isUserLoading = useCurrentUserLoading();
  const isAdmin = currentUser?.roles.includes('admin') ?? false;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [identity, setIdentity] = useState<AdminChatIdentity | null>(null);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [actionMessageId, setActionMessageId] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [connectionError, setConnectionError] = useState('');
  const [sendError, setSendError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const holdTimer = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) || null;
  const selectedContactPublicKey = selectedContact?.publicKey || '';
  const canSend = Boolean(identity && currentUserId && selectedContact?.publicKey);
  const selectedMessages = messages.filter((message) => selectedMessageIds.includes(message.id));
  const allSelectedAreOwn = selectedMessages.length === selectedMessageIds.length
    && selectedMessages.every((message) => message.senderId === currentUserId);

  useEffect(() => {
    if (!isAdmin) {
      setIsLoadingContacts(false);
      setIsLoadingMessages(false);
      return;
    }

    let active = true;
    async function loadContactsAndIdentity() {
      try {
        const response = await fetch('/api/admin-chat/contacts', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat daftar admin');

        const userId = String(data.currentUser?.id || '');
        if (!userId) throw new Error('ID akun tidak tersedia untuk membuat kunci chat');
        const localIdentity = await getOrCreateAdminChatIdentity(userId, data.currentUser.publicKey || null);
        if (!data.currentUser.publicKey) {
          const keyResponse = await fetch('/api/admin-chat/identity', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicKey: localIdentity.publicKey }),
          });
          const keyData = await keyResponse.json();
          if (!keyResponse.ok) throw new Error(keyData.error || 'Gagal mendaftarkan kunci chat');
        }
        if (!active) return;

        const nextContacts = data.contacts as Contact[];
        setCurrentUserId(userId);
        setIdentity(localIdentity);
        setContacts(nextContacts);
        setSelectedContactId((selectedId) => nextContacts.some((contact) => contact.id === selectedId)
          ? selectedId
          : nextContacts[0]?.id || '');
        setConnectionError('');
      } catch (error) {
        if (active) setConnectionError(error instanceof Error ? error.message : 'Gagal memuat chat admin');
      } finally {
        if (active) setIsLoadingContacts(false);
      }
    }

    void loadContactsAndIdentity();
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !currentUserId) return;
    let active = true;
    const refreshContacts = async () => {
      try {
        const response = await fetch('/api/admin-chat/contacts', { cache: 'no-store' });
        const data = await response.json();
        if (active && response.ok && data.currentUser?.id === currentUserId) setContacts(data.contacts);
      } catch {
        // Keep the last known contact list while offline.
      }
    };
    const interval = window.setInterval(() => { void refreshContacts(); }, 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [currentUserId, isAdmin]);

  useEffect(() => {
    messagesRef.current.forEach((message) => {
      if (message.attachmentUrl) URL.revokeObjectURL(message.attachmentUrl);
    });
    messagesRef.current = [];
    setMessages([]);
    setReplyTo(null);
    setSelectedMessageIds([]);
    setIsSelecting(false);
    setActionMessageId('');

    if (!isAdmin || !identity || !selectedContactId || !currentUserId) {
      setIsLoadingMessages(false);
      return;
    }
    if (!selectedContactPublicKey) {
      setIsLoadingMessages(false);
      setIsConnected(true);
      return;
    }

    let active = true;
    let isFetching = false;
    async function decryptMessage(message: EncryptedMessage): Promise<ChatMessage> {
      const { content, messageKey } = await decryptAdminChatPayload<ChatContent>(message, currentUserId, identity!.privateKey);
      let attachmentUrl: string | null = null;
      if (message.attachment && content.media) {
        const mediaResponse = await fetch(message.attachment.url, { cache: 'no-store' });
        if (!mediaResponse.ok) throw new Error('Lampiran tidak dapat diambil');
        const encryptedBytes = await mediaResponse.arrayBuffer();
        const clearBytes = await decryptAdminChatAttachment(encryptedBytes, message.attachment.iv, messageKey);
        attachmentUrl = URL.createObjectURL(new Blob([clearBytes], { type: content.media.contentType }));
      }
      const { attachment, ...encryptedFields } = message;
      return { ...encryptedFields, ...content, encryptedAttachment: attachment, attachmentUrl, decryptionError: false };
    }

    async function loadMessages() {
      if (isFetching) return;
      isFetching = true;
      try {
        const response = await fetch(`/api/admin-chat/messages?with=${encodeURIComponent(selectedContactId)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.messages)) throw new Error(data.error || 'Gagal memuat percakapan');
        if (!active) return;

        const oldMessages = new Map(messagesRef.current.map((message) => [message.id, message]));
        const nextMessages = await Promise.all((data.messages as EncryptedMessage[]).map(async (message) => {
          const previous = oldMessages.get(message.id);
          if (previous) return previous;
          try {
            return await decryptMessage(message);
          } catch {
            const { attachment, ...encryptedFields } = message;
            return {
              ...encryptedFields,
              text: '',
              replyTo: null,
              media: null,
              encryptedAttachment: attachment,
              attachmentUrl: null,
              decryptionError: true,
            };
          }
        }));
        if (!active) {
          nextMessages.forEach((message) => {
            if (message.attachmentUrl && !oldMessages.has(message.id)) URL.revokeObjectURL(message.attachmentUrl);
          });
          return;
        }

        const nextIds = new Set(nextMessages.map((message) => message.id));
        messagesRef.current.forEach((message) => {
          if (!nextIds.has(message.id) && message.attachmentUrl) URL.revokeObjectURL(message.attachmentUrl);
        });
        messagesRef.current = nextMessages;
        setMessages(nextMessages);
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

    setIsLoadingMessages(true);
    void loadMessages();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadMessages();
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [currentUserId, identity, isAdmin, selectedContactId, selectedContactPublicKey]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    messagesRef.current.forEach((message) => {
      if (message.attachmentUrl) URL.revokeObjectURL(message.attachmentUrl);
    });
  }, []);

  const handleFileChange = (file: File | null) => {
    setSendError('');
    if (file && (!isAdminChatMediaType(file.type) || file.size === 0 || file.size > ADMIN_CHAT_MAX_ATTACHMENT_SIZE)) {
      setSendError('Pilih gambar/video yang didukung, berukuran maksimal 25 MB.');
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (isSending || (!text && !selectedFile) || !identity || !selectedContact?.publicKey) return;

    setIsSending(true);
    setSendError('');
    setUploadProgress(0);
    try {
      const attachmentBytes = selectedFile ? await selectedFile.arrayBuffer() : undefined;
      const replyText = replyTo?.text.slice(0, 240) || (replyTo?.media ? '[Lampiran]' : '');
      const content: ChatContent = {
        text,
        replyTo: replyTo ? { messageId: replyTo.id, senderId: replyTo.senderId, text: replyText } : null,
        media: selectedFile ? { fileName: selectedFile.name, contentType: selectedFile.type } : null,
      };
      const encrypted = await encryptAdminChatPayload(content, [
        { userId: currentUserId, publicKey: identity.publicKey },
        { userId: selectedContact.id, publicKey: selectedContact.publicKey },
      ], attachmentBytes);

      let attachment: Omit<ServerAttachment, 'url'> | null = null;
      if (selectedFile && encrypted.encryptedAttachment && encrypted.attachmentIv) {
        const uploadId = crypto.randomUUID();
        const encryptedFile = new Blob([encrypted.encryptedAttachment], { type: 'application/octet-stream' });
        const totalChunks = Math.ceil(encryptedFile.size / ADMIN_CHAT_UPLOAD_CHUNK_SIZE);
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
          const chunk = encryptedFile.slice(chunkIndex * ADMIN_CHAT_UPLOAD_CHUNK_SIZE, (chunkIndex + 1) * ADMIN_CHAT_UPLOAD_CHUNK_SIZE);
          const formData = new FormData();
          formData.append('uploadId', uploadId);
          formData.append('fileSize', String(encryptedFile.size));
          formData.append('totalChunks', String(totalChunks));
          formData.append('chunkIndex', String(chunkIndex));
          formData.append('chunk', chunk, 'encrypted.bin');
          const uploadResponse = await fetch('/api/admin-chat/uploads', { method: 'POST', body: formData });
          const uploadData = await uploadResponse.json();
          if (!uploadResponse.ok) throw new Error(uploadData.error || 'Gagal mengunggah media terenkripsi');
          setUploadProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
        }
        attachment = { uploadId, size: encryptedFile.size, totalChunks, iv: encrypted.attachmentIv };
      }

      const response = await fetch('/api/admin-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: selectedContact.id, ciphertext: encrypted.ciphertext, iv: encrypted.iv, wrappedKeys: encrypted.wrappedKeys, attachment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengirim pesan');

      const serverMessage = data.message as EncryptedMessage;
      const decrypted = await decryptAdminChatPayload<ChatContent>(serverMessage, currentUserId, identity.privateKey);
      let attachmentUrl: string | null = null;
      if (serverMessage.attachment && decrypted.content.media) {
        const mediaResponse = await fetch(serverMessage.attachment.url, { cache: 'no-store' });
        if (mediaResponse.ok) {
          const encryptedBytes = await mediaResponse.arrayBuffer();
          const clearBytes = await decryptAdminChatAttachment(encryptedBytes, serverMessage.attachment.iv, decrypted.messageKey);
          attachmentUrl = URL.createObjectURL(new Blob([clearBytes], { type: decrypted.content.media.contentType }));
        }
      }
      const { attachment: serverAttachment, ...encryptedFields } = serverMessage;
      const sentMessage: ChatMessage = {
        ...encryptedFields,
        ...decrypted.content,
        encryptedAttachment: serverAttachment,
        attachmentUrl,
        decryptionError: false,
      };
      const nextMessages = [...messagesRef.current, sentMessage].slice(-100);
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      setDraft('');
      setReplyTo(null);
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

  const selectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    setDraft('');
    setSelectedFile(null);
    setReplyTo(null);
    setActionMessageId('');
    setSelectedMessageIds([]);
    setIsSelecting(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const handleDelete = async (scope: 'me' | 'everyone', ids: string[]) => {
    if (!ids.length || ids.length > 100 || isDeleting) return;
    const description = scope === 'everyone' ? 'Hapus pesan terpilih untuk kedua admin?' : 'Hapus pesan terpilih dari chat Anda?';
    if (!window.confirm(description)) return;
    setIsDeleting(true);
    setSendError('');
    try {
      const response = await fetch('/api/admin-chat/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: ids, scope }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus pesan');
      const removed = new Set(ids);
      messagesRef.current.filter((message) => removed.has(message.id)).forEach((message) => {
        if (message.attachmentUrl) URL.revokeObjectURL(message.attachmentUrl);
      });
      const nextMessages = messagesRef.current.filter((message) => !removed.has(message.id));
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      setSelectedMessageIds([]);
      setIsSelecting(false);
      setActionMessageId('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Gagal menghapus pesan');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectReply = (message: ChatMessage) => {
    setReplyTo(message);
    setActionMessageId('');
    setIsSelecting(false);
    setSelectedMessageIds([]);
  };

  const handleTouchStart = (message: ChatMessage, event: TouchEvent<HTMLElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setActionMessageId(message.id), 550);
  };

  const handleTouchEnd = (message: ChatMessage, event: TouchEvent<HTMLElement>) => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    const endX = event.changedTouches[0]?.clientX;
    if (touchStartX.current !== null && endX !== undefined && Math.abs(endX - touchStartX.current) > 64) selectReply(message);
    touchStartX.current = null;
  };

  const toggleSelectedMessage = (messageId: string) => {
    setSelectedMessageIds((ids) => {
      if (ids.includes(messageId)) return ids.filter((id) => id !== messageId);
      if (ids.length >= 100) {
        setSendError('Pilih maksimal 100 pesan sekaligus.');
        return ids;
      }
      return [...ids, messageId];
    });
  };

  if (isUserLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Alert variant="destructive"><ShieldCheck className="h-4 w-4" /><AlertDescription>Fitur chat hanya dapat digunakan oleh akun dengan role Admin.</AlertDescription></Alert>;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Chat Admin</h1><p className="mt-1 text-sm text-muted-foreground">Percakapan pribadi dengan enkripsi end-to-end.</p></div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite"><span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />{isConnected ? 'Terhubung' : 'Menghubungkan...'}</div>
      </header>

      <p className="text-xs text-muted-foreground">Kunci privat chat tersimpan di browser ini. Jangan hapus data situs atau pindah browser jika ingin tetap membaca pesan lama.</p>

      {connectionError && !identity && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{connectionError}</AlertDescription></Alert>}

      <section className="grid h-[calc(100dvh-12rem)] min-h-[480px] max-h-[820px] grid-cols-1 overflow-hidden rounded-lg border border-border bg-card md:grid-cols-[230px_minmax(0,1fr)]" aria-label="Chat pribadi admin">
        <aside className="flex min-h-0 gap-2 overflow-x-auto border-b border-border p-2 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:border-b-0 md:border-r md:p-3" aria-label="Daftar admin">
          <p className="hidden px-2 py-1 text-xs font-semibold uppercase text-muted-foreground md:block">Admin</p>
          {isLoadingContacts ? <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat admin...</div> : contacts.length ? contacts.map((contact) => (
            <button key={contact.id} type="button" onClick={() => selectContact(contact.id)} className={`flex min-w-[170px] items-center gap-2 rounded-md px-2 py-2 text-left transition-colors md:min-w-0 ${selectedContactId === contact.id ? 'bg-primary/10 text-foreground' : 'hover:bg-muted'}`}>
              <AdminAvatar contact={contact} size="h-9 w-9" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{contact.username}</span>
              {!contact.publicKey && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Belum mengaktifkan chat" />}
            </button>
          )) : <p className="px-3 py-2 text-sm text-muted-foreground">Belum ada admin lain.</p>}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex min-h-[64px] items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-4">
            {selectedContact ? <div className="flex min-w-0 items-center gap-3"><AdminAvatar contact={selectedContact} /><div className="min-w-0"><p className="truncate text-sm font-semibold">{selectedContact.username}</p><p className="text-xs text-muted-foreground">{selectedContact.publicKey ? 'Terenkripsi end-to-end' : 'Menunggu admin membuka chat pertama kali'}</p></div></div> : <p className="text-sm text-muted-foreground">Pilih admin untuk memulai chat</p>}
            {selectedContact && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Menu chat" title="Menu chat"><EllipsisVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setIsSelecting(true); setSelectedMessageIds([]); }}>Pilih beberapa pesan</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
          </div>

          {isSelecting && <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2"><span className="mr-auto text-sm">{selectedMessageIds.length} dipilih</span><Button type="button" variant="ghost" size="sm" onClick={() => { setIsSelecting(false); setSelectedMessageIds([]); }}>Batal</Button><Button type="button" variant="outline" size="sm" disabled={!selectedMessageIds.length || isDeleting} onClick={() => void handleDelete('me', selectedMessageIds)}><Trash2 className="mr-2 h-4 w-4" /> Hapus untuk saya</Button>{selectedMessageIds.length > 0 && allSelectedAreOwn && <Button type="button" variant="destructive" size="sm" disabled={isDeleting} onClick={() => void handleDelete('everyone', selectedMessageIds)}><Trash2 className="mr-2 h-4 w-4" /> Hapus untuk semua</Button>}</div>}

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite" aria-relevant="additions">
            {!selectedContact ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><MessageCircle className="mr-2 h-4 w-4" /> Pilih admin untuk memulai percakapan.</div>
              : !selectedContact.publicKey ? <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><ShieldCheck className="h-8 w-8 text-primary" /><p>Admin ini perlu membuka halaman Chat Admin sekali untuk menyiapkan kunci enkripsi.</p></div>
                : isLoadingMessages ? <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat percakapan...</div>
                  : messages.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground"><MessageCircle className="h-8 w-8 opacity-40" /><p className="text-sm">Belum ada pesan. Mulai percakapan pribadi.</p></div>
                    : <div className="space-y-3">{messages.map((message) => {
                      const own = message.senderId === currentUserId;
                      const selected = selectedMessageIds.includes(message.id);
                      const replySender = message.replyTo?.senderId === currentUserId ? 'Anda' : selectedContact.username;
                      return <article key={message.id} className={`relative flex items-start gap-2 ${own ? 'justify-end' : 'justify-start'} ${selected ? 'rounded-md bg-primary/5 ring-1 ring-primary/30' : ''}`} onTouchStart={(event) => handleTouchStart(message, event)} onTouchEnd={(event) => handleTouchEnd(message, event)} onTouchMove={() => { if (holdTimer.current !== null) window.clearTimeout(holdTimer.current); }} onContextMenu={(event) => { event.preventDefault(); setActionMessageId(message.id); }}>
                        {isSelecting && <Checkbox checked={selected} onCheckedChange={() => toggleSelectedMessage(message.id)} aria-label={`Pilih pesan ${formatMessageTime(message.createdAt)}`} className="mt-3" />}
                        <div className={`flex min-w-0 max-w-[88%] flex-col ${own ? 'items-end' : 'items-start'} sm:max-w-[76%]`}>
                          <div className={`min-w-0 overflow-hidden rounded-lg border px-3 py-2 ${own ? 'border-primary/20 bg-primary text-primary-foreground' : 'border-border bg-muted text-foreground'}`}>
                            {message.replyTo && <div className={`mb-2 border-l-2 pl-2 text-xs ${own ? 'border-primary-foreground/60 text-primary-foreground/80' : 'border-primary text-muted-foreground'}`}><span className="font-semibold">{replySender}</span><p className="line-clamp-2 break-words">{message.replyTo.text || '[Lampiran]'}</p></div>}
                            {message.decryptionError ? <p className="text-sm italic opacity-80">Pesan tidak dapat didekripsi di browser ini.</p> : <>
                              {message.media && <div className="mb-2">{message.attachmentUrl && message.media.contentType.startsWith('image/') ? <a href={message.attachmentUrl} target="_blank" rel="noreferrer" aria-label={`Buka ${message.media.fileName}`}><Image src={message.attachmentUrl} alt={message.media.fileName} width={480} height={360} unoptimized className="max-h-[360px] max-w-full rounded-md object-contain" /></a> : message.attachmentUrl ? <video src={message.attachmentUrl} controls playsInline preload="metadata" className="max-h-[360px] max-w-full rounded-md" aria-label={message.media.fileName} /> : <p className="text-xs opacity-75">Lampiran tidak tersedia.</p>}<p className="mt-1 max-w-full truncate text-[11px] opacity-75">{message.media.fileName}{message.encryptedAttachment ? ` · ${formatFileSize(message.encryptedAttachment.size)}` : ''}</p></div>}
                              {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
                            </>}
                            <div className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${own ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}><time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>{own && <Check className="h-3 w-3" aria-label="Terkirim" />}</div>
                          </div>
                          {actionMessageId === message.id && !isSelecting && <div className="mt-1 flex flex-wrap gap-1 rounded-md border border-border bg-popover p-1 shadow-sm"><Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => selectReply(message)}><Reply className="mr-1.5 h-3.5 w-3.5" /> Balas</Button><Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => void handleDelete('me', [message.id])}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus untuk saya</Button>{own && <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => void handleDelete('everyone', [message.id])}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus untuk semua</Button>}<Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Tutup aksi pesan" onClick={() => setActionMessageId('')}><X className="h-4 w-4" /></Button></div>}
                        </div>
                      </article>;
                    })}<div ref={messagesEnd} /></div>}
          </div>

          {connectionError && <Alert variant="destructive" className="mx-3 mb-2 py-2"><AlertCircle className="h-4 w-4" /><AlertDescription>{connectionError}</AlertDescription></Alert>}
          {sendError && <Alert variant="destructive" className="mx-3 mb-2 py-2"><AlertCircle className="h-4 w-4" /><AlertDescription>{sendError}</AlertDescription></Alert>}
          {selectedContact && <div className="border-t border-border p-3 sm:p-4">
            {replyTo && <div className="mb-2 flex items-center gap-2 rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2 text-xs"><Reply className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-semibold">Membalas {replyTo.senderId === currentUserId ? 'pesan Anda' : selectedContact.username}</p><p className="truncate text-muted-foreground">{replyTo.text || (replyTo.media ? '[Lampiran]' : '')}</p></div><Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Batal membalas" onClick={() => setReplyTo(null)}><X className="h-4 w-4" /></Button></div>}
            {selectedFile && <div className="mb-2 flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{selectedFile.type.startsWith('video/') ? <Video className="h-4 w-4 shrink-0 text-primary" /> : <ImagePlus className="h-4 w-4 shrink-0 text-primary" />}<span className="min-w-0 flex-1 truncate">{selectedFile.name}</span><span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</span>{!isSending && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFileChange(null)} aria-label="Hapus lampiran"><X className="h-4 w-4" /></Button>}</div>}
            {isSending && selectedFile && <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-[width]" style={{ width: `${uploadProgress}%` }} /></div>}
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <input ref={fileInput} type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => handleFileChange(event.target.files?.[0] || null)} disabled={isSending || !canSend} aria-label="Pilih gambar atau video" />
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => fileInput.current?.click()} disabled={isSending || !canSend} aria-label="Lampirkan gambar atau video" title="Lampirkan gambar/video"><Paperclip className="h-4 w-4" /></Button>
              <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={canSend ? 'Tulis pesan terenkripsi...' : 'Menunggu kunci admin...'} maxLength={MAX_MESSAGE_LENGTH} rows={2} className="min-h-10 max-h-32 resize-y" disabled={isSending || !canSend} aria-label="Isi pesan" />
              <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={isSending || !canSend || (!draft.trim() && !selectedFile)} aria-label="Kirim pesan">{isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : uploadProgress === 100 ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}</Button>
            </form>
            <p className="mt-2 text-[11px] text-muted-foreground">Geser pesan untuk membalas · Tekan dan tahan untuk opsi · Pesan dan media terenkripsi di perangkat Anda</p>
          </div>}
        </div>
      </section>
    </div>
  );
}
