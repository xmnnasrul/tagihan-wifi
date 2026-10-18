'use client';

import { FormEvent, KeyboardEvent, TouchEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle, ArrowLeft, Check, EllipsisVertical, ImagePlus, Loader2, LockKeyhole,
  KeyRound, MessageCircle, Paperclip, Reply, Send, ShieldCheck, Trash2, Video, X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCurrentUser, useCurrentUserLoading } from '@/components/CurrentUserProvider';
import {
  clearAdminChatMigrationSource, createAdminChatRecoveryIdentity, decryptAdminChatAttachment, decryptAdminChatPayload, encryptAdminChatPayload,
  getOrCreateAdminChatIdentity, getStoredAdminChatIdentity, restoreAdminChatRecoveryIdentity,
  rewrapAdminChatMessageKey, type AdminChatIdentity,
} from '@/lib/admin-chat-crypto';
import { ADMIN_CHAT_MAX_ATTACHMENT_SIZE, ADMIN_CHAT_UPLOAD_CHUNK_SIZE, isAdminChatMediaType } from '@/lib/admin-chat-constants';

interface Contact {
  id: string;
  username: string;
  profileImage: string;
  publicKey: string;
  recoveryPublicKey: string;
  recoveryKeyId: string;
  recoveryStatus: 'none' | 'migrating' | 'ready';
}

interface RecoveryInfo {
  publicKey: string;
  recoveryKeyId: string;
  ciphertext: string;
  salt: string;
  iv: string;
  status: 'migrating' | 'ready';
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
  wrappedKeys: { userId: string; keyId?: 'primary' | 'recovery'; encryptedKey: string }[];
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
  const [identityUsername, setIdentityUsername] = useState('');
  const [accountPublicKey, setAccountPublicKey] = useState('');
  const [accountRecoveryPublicKey, setAccountRecoveryPublicKey] = useState('');
  const [accountRecoveryKeyId, setAccountRecoveryKeyId] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<'none' | 'migrating' | 'ready'>('none');
  const [recoveryBackup, setRecoveryBackup] = useState<RecoveryInfo | null>(null);
  const [recoveryMode, setRecoveryMode] = useState<'setup' | 'restore' | 'rotate' | null>(null);
  const [cancelPendingRotationOnRestore, setCancelPendingRotationOnRestore] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [showEndToEndWarning, setShowEndToEndWarning] = useState(false);
  const recoverySetupPromptKey = 'tagihan-admin-chat-recovery-popup-shown';
  const [recoveryProgress, setRecoveryProgress] = useState('');
  const [isRecoveryBusy, setIsRecoveryBusy] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [isMobileConversationOpen, setIsMobileConversationOpen] = useState(false);
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
  const messageBubblesRef = useRef(new Map<string, HTMLDivElement>());
  const recoveryMigrationActive = useRef(false);

  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) || null;
  const selectedContactPublicKey = selectedContact?.publicKey || '';
  const identityReady = Boolean(identity && identityUsername === currentUser?.username && currentUserId);
  const canSend = Boolean(identityReady && (identity?.privateKey || identity?.recoveryPrivateKey)
    && recoveryStatus === 'ready' && accountPublicKey && selectedContact?.publicKey
    && selectedContact.recoveryStatus !== 'migrating');
  const selectedMessages = messages.filter((message) => selectedMessageIds.includes(message.id));

  useEffect(() => {
    if (!isAdmin || !currentUserId || recoveryMode || recoveryStatus === 'ready' || recoveryStatus === 'migrating') {
      return;
    }

    if (typeof window === 'undefined') return;
    const hasSeenRecoverySetupPrompt = window.localStorage.getItem(recoverySetupPromptKey) === 'true';
    if (!hasSeenRecoverySetupPrompt) {
      window.localStorage.setItem(recoverySetupPromptKey, 'true');
      setRecoveryMode('setup');
    }
  }, [currentUserId, isAdmin, recoveryMode, recoveryStatus, recoverySetupPromptKey]);
  const allSelectedAreOwn = selectedMessages.length === selectedMessageIds.length
    && selectedMessages.every((message) => message.senderId === currentUserId);

  const migrateRecoveryHistory = async (userId: string, currentIdentity: AdminChatIdentity) => {
    if ((!currentIdentity.privateKey && !currentIdentity.recoveryPrivateKey && !currentIdentity.migrationSourceRecoveryPrivateKey)
      || !currentIdentity.recoveryPublicKey) {
      throw new Error('Migrasi riwayat harus dilanjutkan di browser tempat kunci chat lama tersedia.');
    }
    if (recoveryMigrationActive.current) return;
    recoveryMigrationActive.current = true;
    setIsRecoveryBusy(true);
    setRecoveryError('');
    setRecoveryProgress('Menyiapkan migrasi pesan lama...');
    try {
      let cursor = '';
      let migrated = 0;
      while (true) {
        const query = `?userId=${encodeURIComponent(userId)}${cursor ? `&after=${encodeURIComponent(cursor)}` : ''}`;
        const response = await fetch(`/api/admin-chat/identity/recovery${query}`, { cache: 'no-store' });
        const page = await response.json();
        if (!response.ok) throw new Error(page.error || 'Gagal membaca batch migrasi.');
        if (page.status === 'ready') break;

        const keys = await Promise.all((page.messages as { id: string; wrappedKeys: { userId: string; keyId: 'primary' | 'recovery'; encryptedKey: string }[] }[]).map(async (message) => ({
          id: message.id,
          encryptedKey: await rewrapAdminChatMessageKey(
            message.wrappedKeys,
            userId,
            currentIdentity,
            currentIdentity.recoveryPublicKey!,
          ),
        })));
        if (keys.length) {
          const batchResponse = await fetch('/api/admin-chat/identity/recovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'batch', accountId: userId, keys }),
          });
          const batchData = await batchResponse.json();
          if (!batchResponse.ok) throw new Error(batchData.error || 'Gagal memigrasikan batch pesan.');
          migrated += keys.length;
          setRecoveryProgress(`Pesan lama dimigrasikan: ${migrated}`);
        }
        if (!page.nextAfter) break;
        cursor = page.nextAfter;
      }

      const completeResponse = await fetch('/api/admin-chat/identity/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', accountId: userId }),
      });
      const completeData = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completeData.error || 'Migrasi belum selesai.');
      setRecoveryStatus('ready');
      setRecoveryBackup((backup) => backup ? { ...backup, status: 'ready' } : backup);
      setRecoveryMode(null);
      setRecoveryPassword('');
      setRecoveryConfirmPassword('');
      setRecoveryProgress('Backup pemulihan siap digunakan di perangkat baru.');
      await clearAdminChatMigrationSource(userId);
      const refreshedIdentity = await getStoredAdminChatIdentity(userId);
      if (refreshedIdentity) setIdentity(refreshedIdentity);
    } finally {
      recoveryMigrationActive.current = false;
      setIsRecoveryBusy(false);
    }
  };

  const handleRecoverySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRecoveryBusy || !currentUserId) return;
    setRecoveryError('');
    setIsRecoveryBusy(true);
    try {
      if ((recoveryMode === 'setup' || recoveryMode === 'rotate') && recoveryStatus === 'migrating') {
        if (!identity?.recoveryPublicKey || !identity.recoveryBackup) {
          throw new Error('Lanjutkan migrasi dari browser yang memiliki kunci lama.');
        }
        const beginResponse = await fetch('/api/admin-chat/identity/recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'begin', accountId: currentUserId, rotate: true, ...identity.recoveryBackup }),
        });
        const beginData = await beginResponse.json();
        if (!beginResponse.ok) throw new Error(beginData.error || 'Gagal melanjutkan backup kunci.');
        await migrateRecoveryHistory(currentUserId, identity);
        return;
      }
      if (recoveryMode === 'restore') {
        if (!recoveryBackup) throw new Error('Backup pemulihan tidak tersedia.');
        const restoredIdentity = await restoreAdminChatRecoveryIdentity(
          currentUserId,
          { version: 1, recoveryPublicKey: recoveryBackup.publicKey, recoveryKeyId: recoveryBackup.recoveryKeyId, ciphertext: recoveryBackup.ciphertext, salt: recoveryBackup.salt, iv: recoveryBackup.iv },
          recoveryPassword,
          accountPublicKey,
        );
        if (cancelPendingRotationOnRestore) {
          const cancelResponse = await fetch('/api/admin-chat/identity/recovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel', accountId: currentUserId }),
          });
          const cancelData = await cancelResponse.json();
          if (!cancelResponse.ok) throw new Error(cancelData.error || 'Gagal membatalkan migrasi recovery.');
        }
        setIdentity(restoredIdentity);
        setIdentityUsername(currentUser?.username || '');
        setRecoveryStatus('ready');
        setRecoveryMode(null);
        setCancelPendingRotationOnRestore(false);
        setRecoveryPassword('');
        setAccountRecoveryPublicKey(recoveryBackup.publicKey);
        setAccountRecoveryKeyId(recoveryBackup.recoveryKeyId);
        return;
      }

      if (!identity?.privateKey && !identity?.recoveryPrivateKey) throw new Error('Kunci lama tidak tersedia untuk menyiapkan backup.');
      if (recoveryPassword !== recoveryConfirmPassword) throw new Error('Konfirmasi sandi Chat tidak cocok.');
      const { identity: recoveryIdentity, backup } = await createAdminChatRecoveryIdentity(currentUserId, recoveryPassword);
      setIdentity(recoveryIdentity);
      setAccountRecoveryPublicKey(backup.recoveryPublicKey);
      setAccountRecoveryKeyId(backup.recoveryKeyId);
      setRecoveryBackup({ publicKey: backup.recoveryPublicKey, recoveryKeyId: backup.recoveryKeyId, ciphertext: backup.ciphertext, salt: backup.salt, iv: backup.iv, status: 'migrating' });
      setRecoveryStatus('migrating');

      const beginResponse = await fetch('/api/admin-chat/identity/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'begin', accountId: currentUserId, rotate: recoveryMode === 'rotate', ...backup }),
      });
      const beginData = await beginResponse.json();
      if (!beginResponse.ok) throw new Error(beginData.error || 'Gagal menyimpan backup kunci.');
      await migrateRecoveryHistory(currentUserId, recoveryIdentity);
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : 'Gagal menyiapkan pemulihan chat.');
    } finally {
      setIsRecoveryBusy(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || !currentUser?.username) {
      setIsLoadingContacts(false);
      setIsLoadingMessages(false);
      setIsConnected(false);
      setContacts([]);
      setCurrentUserId('');
      setIdentity(null);
      setIdentityUsername('');
      setAccountPublicKey('');
      setAccountRecoveryPublicKey('');
      setAccountRecoveryKeyId('');
      setRecoveryStatus('none');
      setRecoveryBackup(null);
      setRecoveryMode(null);
      setCancelPendingRotationOnRestore(false);
      setSelectedContactId('');
      setIsMobileConversationOpen(false);
      return;
    }

    const accountUsername = currentUser.username;
    let active = true;
    setIsLoadingContacts(true);
    setIsLoadingMessages(true);
    setConnectionError('');
    setIsConnected(false);
    setContacts([]);
    setCurrentUserId('');
    setIdentity(null);
    setIdentityUsername('');
    setAccountPublicKey('');
    setAccountRecoveryPublicKey('');
    setAccountRecoveryKeyId('');
    setRecoveryStatus('none');
    setRecoveryBackup(null);
    setRecoveryMode(null);
    setCancelPendingRotationOnRestore(false);
    setSelectedContactId('');
    setIsMobileConversationOpen(false);
    async function loadContactsAndIdentity() {
      try {
        const response = await fetch('/api/admin-chat/contacts', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat daftar admin');

        const userId = String(data.currentUser?.id || '');
        if (!userId) throw new Error('ID akun tidak tersedia untuk membuat kunci chat');
        const nextContacts = data.contacts as Contact[];
        if (!active) return;
        setCurrentUserId(userId);
        setContacts(nextContacts);
        const publicKey = String(data.currentUser.publicKey || '');
        const activeRecovery = data.currentUser.recovery as RecoveryInfo | null;
        const pendingRecovery = data.currentUser.pendingRecovery as RecoveryInfo | null;
        const serverRecovery = pendingRecovery || activeRecovery;
        setAccountPublicKey(publicKey);
        setAccountRecoveryPublicKey(serverRecovery?.publicKey || '');
        setAccountRecoveryKeyId(serverRecovery?.recoveryKeyId || '');
        setRecoveryStatus(pendingRecovery ? 'migrating' : serverRecovery?.status || 'none');
        setRecoveryBackup(serverRecovery || null);

        const storedIdentity = await getStoredAdminChatIdentity(userId);
        const storedPrimaryMatches = Boolean(storedIdentity?.privateKey
          && (!publicKey || storedIdentity.publicKey === publicKey));
        const pendingRecoveryBackup = Boolean(storedIdentity?.recoveryBackup
          && storedIdentity.recoveryPublicKey
          && storedIdentity.recoveryKeyId
          && storedIdentity.recoveryKeyId !== serverRecovery?.recoveryKeyId);
        const storedRecoveryMatches = Boolean(storedIdentity?.recoveryPrivateKey
          && serverRecovery?.publicKey
          && storedIdentity.recoveryPublicKey === serverRecovery.publicKey
          && storedIdentity.recoveryKeyId === serverRecovery.recoveryKeyId);
        let localIdentity: AdminChatIdentity | null = null;

        if (pendingRecovery && activeRecovery && !storedRecoveryMatches) {
          setAccountRecoveryPublicKey(activeRecovery.publicKey);
          setAccountRecoveryKeyId(activeRecovery.recoveryKeyId);
          setRecoveryBackup(activeRecovery);
          setRecoveryStatus('migrating');
          setCancelPendingRotationOnRestore(true);
          setRecoveryMode('restore');
          return;
        }

        if (pendingRecoveryBackup && storedIdentity
          && !pendingRecovery
          && (storedPrimaryMatches || storedIdentity.recoveryPrivateKey || storedIdentity.migrationSourceRecoveryPrivateKey)) {
          localIdentity = {
            ...storedIdentity,
            publicKey: publicKey || storedIdentity.publicKey,
            privateKey: storedPrimaryMatches ? storedIdentity.privateKey : undefined,
          };
          setIdentity(localIdentity);
          setIdentityUsername(accountUsername);
          setAccountRecoveryPublicKey(storedIdentity.recoveryPublicKey || '');
          setAccountRecoveryKeyId(storedIdentity.recoveryKeyId || '');
          setRecoveryBackup({
            publicKey: storedIdentity.recoveryBackup!.recoveryPublicKey,
            recoveryKeyId: storedIdentity.recoveryBackup!.recoveryKeyId,
            ciphertext: storedIdentity.recoveryBackup!.ciphertext,
            salt: storedIdentity.recoveryBackup!.salt,
            iv: storedIdentity.recoveryBackup!.iv,
            status: 'migrating',
          });
          setRecoveryStatus('migrating');
          setRecoveryProgress('Backup lokal belum tersimpan atau rotasi sebelumnya dibatalkan. Lanjutkan saat siap.');
          setRecoveryMode('rotate');
          return;
        }

        if (storedRecoveryMatches && storedIdentity) {
          localIdentity = {
            ...storedIdentity,
            publicKey: publicKey || storedIdentity.publicKey,
            privateKey: storedPrimaryMatches ? storedIdentity.privateKey : undefined,
          };
        } else if (storedPrimaryMatches && storedIdentity) {
          localIdentity = storedIdentity;
        } else if (serverRecovery?.status === 'ready') {
          setRecoveryMode('restore');
          return;
        } else if (serverRecovery?.status === 'migrating') {
          throw new Error('Backup masih dimigrasikan. Kembali ke browser asal sampai proses selesai.');
        } else if (publicKey) {
          throw new Error('Private key akun ini tidak ada di browser ini dan belum memiliki backup pemulihan.');
        } else {
          localIdentity = await getOrCreateAdminChatIdentity(userId, null);
        }

        if (!localIdentity) throw new Error('Kunci chat tidak dapat dimuat.');
        if (!publicKey) {
          const keyResponse = await fetch('/api/admin-chat/identity', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicKey: localIdentity.publicKey }),
          });
          const keyData = await keyResponse.json();
          if (!keyResponse.ok) throw new Error(keyData.error || 'Gagal mendaftarkan kunci chat');
          setAccountPublicKey(localIdentity.publicKey);
        }
        if (!active) return;

        setIdentity(localIdentity);
        setIdentityUsername(accountUsername);
        setConnectionError('');
        if (serverRecovery?.status === 'migrating') {
          if (storedRecoveryMatches && (localIdentity.privateKey || localIdentity.migrationSourceRecoveryPrivateKey)) {
            void migrateRecoveryHistory(userId, localIdentity).catch((error) => {
              setRecoveryError(error instanceof Error ? error.message : 'Migrasi pemulihan terhenti.');
            });
          } else {
            throw new Error('Migrasi kunci perlu dilanjutkan di browser yang memulai prosesnya.');
          }
        } else if (!serverRecovery && localIdentity.privateKey) {
          setRecoveryMode('setup');
        }
      } catch (error) {
        if (active) setConnectionError(error instanceof Error ? error.message : 'Gagal memuat chat admin');
      } finally {
        if (active) setIsLoadingContacts(false);
      }
    }

    void loadContactsAndIdentity();
    return () => { active = false; };
  }, [currentUser?.username, isAdmin]);

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

    if (!isAdmin || !identityReady || !identity || !selectedContactId || !currentUserId) {
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
      const { content, messageKey } = await decryptAdminChatPayload<ChatContent>(message, currentUserId, identity!);
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
  }, [currentUser?.username, currentUserId, identity, identityReady, isAdmin, selectedContactId, selectedContactPublicKey]);

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
    if (isSending || (!text && !selectedFile) || !identity || !accountPublicKey || !selectedContact?.publicKey) return;

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
        { userId: currentUserId, publicKey: accountPublicKey, recoveryPublicKey: accountRecoveryPublicKey || undefined, recoveryKeyId: accountRecoveryKeyId || undefined },
        { userId: selectedContact.id, publicKey: selectedContact.publicKey, recoveryPublicKey: selectedContact.recoveryPublicKey || undefined, recoveryKeyId: selectedContact.recoveryKeyId || undefined },
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
      const decrypted = await decryptAdminChatPayload<ChatContent>(serverMessage, currentUserId, identity);
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
    setIsMobileConversationOpen(true);
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
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      messageBubblesRef.current.get(message.id)?.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(70px)', offset: 0.45 },
          { transform: 'translateX(0)' },
        ],
        { duration: 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
    }
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
    <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-2 border-b border-border pb-3 sm:pb-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Komunikasi internal</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Chat Admin</h1>
          <p className="text-center text-sm text-muted-foreground sm:text-left">
            Percakapan pribadi di
            <button type="button" onClick={() => setShowEndToEndWarning((current) => !current)} className="mx-1 font-medium text-primary underline-offset-4 hover:underline">
              enkripsi end-to-end
            </button>
            .
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isConnected ? 'Terhubung' : 'Menghubungkan...'}
          </div>
          <div className="flex items-center gap-2">
            {!recoveryMode && recoveryStatus !== 'ready' && <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => { setRecoveryError(''); setRecoveryMode('setup'); }}>
              {recoveryStatus === 'migrating' ? 'Lanjutkan migrasi' : 'Atur sandi Chat'}
            </Button>}
            {!recoveryMode && recoveryStatus === 'ready' && identityReady && <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => { setRecoveryError(''); setRecoveryMode('rotate'); }}>
              Ganti sandi Chat
            </Button>}
            {!recoveryMode && recoveryStatus === 'ready' && !identityReady && <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => { setRecoveryError(''); setRecoveryMode('restore'); }}>
              Pulihkan chat
            </Button>}
          </div>
        </div>
      </header>

      {showEndToEndWarning && (
        <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-muted-foreground sm:items-center sm:px-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:mt-0" />
          <p className="min-w-0 leading-relaxed">
            Enkripsi end-to-end berarti pesan dienkripsi di perangkat pengirim dan hanya bisa dibuka oleh perangkat penerima yang memiliki kunci yang sesuai. Bahkan server pun tidak dapat membaca isi chat secara langsung.
          </p>
        </div>
      )}

      {recoveryError && <Alert variant="destructive"><AlertDescription>{recoveryError}</AlertDescription></Alert>}

      <Dialog open={Boolean(recoveryMode)} onOpenChange={(open) => {
        if (!open && !isRecoveryBusy) setRecoveryMode(null);
      }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{recoveryMode === 'restore' ? 'Pulihkan Chat' : recoveryMode === 'rotate' ? 'Ganti Sandi Chat' : 'Buat Sandi Chat'}</DialogTitle>
            <DialogDescription>
              {recoveryMode === 'restore'
                ? 'Masukkan sandi Chat untuk membuka backup di perangkat ini. Sandi diproses hanya di browser.'
                : recoveryMode === 'rotate'
                  ? 'Private key lokal akan membuat backup baru dan memigrasikan pembungkus riwayat tanpa menghapus akses lama.'
                : recoveryStatus === 'migrating'
                  ? 'Lanjutkan pemindahan kunci pesan lama. Riwayat tetap dapat dibaca selama proses berlangsung.'
                  : 'Sandi ini mengenkripsi backup kunci. Gunakan minimal 10 karakter dan simpan agar dapat membuka chat di perangkat baru.'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Fungsi sandi Chat</p>
            <p className="mt-1 leading-relaxed">Sandi ini dipakai untuk mengenkripsi backup kunci chat agar Anda tetap bisa membuka riwayat pesan di perangkat baru atau saat browser lama hilang.</p>
          </div>
          <form onSubmit={(event) => void handleRecoverySubmit(event)} className="space-y-4">
            {!((recoveryMode === 'setup' || recoveryMode === 'rotate') && recoveryStatus === 'migrating') && <div className="space-y-2">
              <Label htmlFor="admin-chat-recovery-password">Sandi Chat</Label>
              <Input id="admin-chat-recovery-password" type="password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} minLength={10} maxLength={128} autoComplete={recoveryMode === 'restore' ? 'current-password' : 'new-password'} required />
            </div>}
            {(recoveryMode === 'setup' || recoveryMode === 'rotate') && recoveryStatus !== 'migrating' && <div className="space-y-2">
              <Label htmlFor="admin-chat-recovery-confirm">Konfirmasi sandi Chat</Label>
              <Input id="admin-chat-recovery-confirm" type="password" value={recoveryConfirmPassword} onChange={(event) => setRecoveryConfirmPassword(event.target.value)} minLength={10} maxLength={128} autoComplete="new-password" required />
            </div>}
            {recoveryError && <Alert variant="destructive"><AlertDescription>{recoveryError}</AlertDescription></Alert>}
            {recoveryStatus === 'migrating' && recoveryProgress && <p className="text-xs text-muted-foreground">{recoveryProgress}</p>}
            <DialogFooter>
              <Button type="submit" disabled={isRecoveryBusy || ((recoveryMode === 'setup' || recoveryMode === 'rotate') && recoveryStatus !== 'migrating' && recoveryPassword !== recoveryConfirmPassword)}>
                {isRecoveryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                {recoveryMode === 'restore' ? 'Pulihkan kunci' : recoveryStatus === 'migrating' ? 'Lanjutkan migrasi' : recoveryMode === 'rotate' ? 'Ganti sandi dan migrasikan' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {connectionError && !identity && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{connectionError}</AlertDescription></Alert>}

      <section className="grid h-[calc(100dvh-17rem)] min-h-[440px] max-h-[900px] grid-cols-1 overflow-hidden rounded-md border border-border bg-card shadow-sm sm:min-h-[480px] md:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]" aria-label="Chat pribadi admin">
        <aside className={`${isMobileConversationOpen ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col border-b border-border bg-muted/20 md:flex md:border-b-0 md:border-r`} aria-label="Daftar admin">
          <div className="flex items-center justify-between px-3 pb-1 pt-3 sm:px-4 sm:pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Percakapan</p>
            <span className="text-xs tabular-nums text-muted-foreground">{contacts.length} admin</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 sm:p-3 md:p-2">
          {isLoadingContacts ? <div className="flex min-h-12 items-center gap-2 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat admin...</div> : contacts.length ? contacts.map((contact) => (
            <button key={contact.id} type="button" onClick={() => selectContact(contact.id)} className={`flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${selectedContactId === contact.id ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-transparent bg-card/70 hover:border-border hover:bg-card'}`}>
              <AdminAvatar contact={contact} size="h-9 w-9" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{contact.username}</span>
              {!contact.publicKey && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Belum mengaktifkan chat" />}
            </button>
          )) : <p className="px-3 py-2 text-sm text-muted-foreground">Belum ada admin lain.</p>}
          </div>
        </aside>

        <div className={`${isMobileConversationOpen ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col bg-background/50 md:flex`}>
          <div className="flex min-h-[72px] items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 sm:gap-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {selectedContact && <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setIsMobileConversationOpen(false)} aria-label="Kembali ke daftar admin"><ArrowLeft className="h-4 w-4" /></Button>}
              {selectedContact ? <><AdminAvatar contact={selectedContact} /><div className="min-w-0"><p className="truncate text-sm font-semibold">{selectedContact.username}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{selectedContact.publicKey ? 'Percakapan terenkripsi' : 'Menunggu admin menyiapkan kunci chat'}</p></div></> : <div className="hidden min-w-0 md:block"><p className="text-sm font-semibold">Belum ada percakapan dipilih</p><p className="mt-0.5 text-xs text-muted-foreground">Pilih admin untuk membuka chat.</p></div>}
            </div>
            {selectedContact && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Menu chat" title="Menu chat"><EllipsisVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setIsSelecting(true); setSelectedMessageIds([]); }}>Pilih beberapa pesan</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
          </div>

          {isSelecting && <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2.5 sm:px-5"><span className="mr-auto text-sm font-medium">{selectedMessageIds.length} dipilih</span><Button type="button" variant="ghost" size="sm" onClick={() => { setIsSelecting(false); setSelectedMessageIds([]); }}>Batal</Button><Button type="button" variant="outline" size="sm" disabled={!selectedMessageIds.length || isDeleting} onClick={() => void handleDelete('me', selectedMessageIds)}><Trash2 className="mr-2 h-4 w-4" /> Hapus untuk saya</Button>{selectedMessageIds.length > 0 && allSelectedAreOwn && <Button type="button" variant="destructive" size="sm" disabled={isDeleting} onClick={() => void handleDelete('everyone', selectedMessageIds)}><Trash2 className="mr-2 h-4 w-4" /> Hapus untuk semua</Button>}</div>}

          {selectedContact && currentUser?.username && <div className="flex items-start gap-2 border-b border-border bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground sm:px-5"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><p className="min-w-0 leading-relaxed">Chat ini hanya bisa dilihat oleh <span className="font-semibold text-foreground">{currentUser.username}</span> dan <span className="font-semibold text-foreground">{selectedContact.username}</span>.</p></div>}

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6" aria-live="polite" aria-relevant="additions">
            {!selectedContact ? <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"><span className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card"><MessageCircle className="h-5 w-5 text-primary" /></span><p>Pilih admin untuk memulai chat.</p></div>
              : !selectedContact.publicKey ? <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground"><span className="flex h-12 w-12 items-center justify-center rounded-md border border-primary/20 bg-primary/5"><ShieldCheck className="h-5 w-5 text-primary" /></span><p className="max-w-sm leading-relaxed">Admin ini perlu membuka halaman Chat Admin sekali untuk menyiapkan kunci enkripsi.</p></div>
                : !identityReady ? <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground"><span className="flex h-12 w-12 items-center justify-center rounded-md border border-destructive/20 bg-destructive/5"><AlertCircle className="h-5 w-5 text-destructive" /></span><p className="max-w-sm leading-relaxed">Kunci privat chat untuk akun {currentUser?.username} tidak cocok atau tidak tersedia di browser ini. Pesan terenkripsi hanya dapat dibaca dengan kunci asli akun tersebut.</p></div>
                : isLoadingMessages ? <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat percakapan...</div>
                  : messages.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground"><span className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card"><MessageCircle className="h-5 w-5 text-primary" /></span><p className="text-sm">Belum ada pesan. Mulai percakapan pribadi.</p></div>
                    : <div className="space-y-3">{messages.map((message) => {
                      const own = message.senderId === currentUserId;
                      const selected = selectedMessageIds.includes(message.id);
                      const replySender = message.replyTo?.senderId === currentUserId ? 'Anda' : selectedContact.username;
                      return <article key={message.id} className={`relative flex items-start gap-2 ${own ? 'justify-end' : 'justify-start'} ${selected ? 'rounded-md bg-primary/5 ring-1 ring-primary/30' : ''}`} onTouchStart={(event) => handleTouchStart(message, event)} onTouchEnd={(event) => handleTouchEnd(message, event)} onTouchMove={() => { if (holdTimer.current !== null) window.clearTimeout(holdTimer.current); }} onContextMenu={(event) => { event.preventDefault(); setActionMessageId(message.id); }}>
                        {isSelecting && <Checkbox checked={selected} onCheckedChange={() => toggleSelectedMessage(message.id)} aria-label={`Pilih pesan ${formatMessageTime(message.createdAt)}`} className="mt-3" />}
                        <div className={`flex min-w-0 max-w-[90%] flex-col ${own ? 'items-end' : 'items-start'} sm:max-w-[76%]`}>
                          <p className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">{own ? currentUser?.username : selectedContact.username}</p>
                          <div ref={(element) => {
                            if (element) messageBubblesRef.current.set(message.id, element);
                            else messageBubblesRef.current.delete(message.id);
                          }} className={`min-w-0 overflow-hidden rounded-md border px-[11.5px] pt-2.5 pb-5 shadow-sm ${own ? 'border-primary/20 bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}>
                            {message.replyTo && <div className={`mb-2 border-l-2 pl-2 text-xs ${own ? 'border-primary-foreground/60 text-primary-foreground/80' : 'border-primary text-muted-foreground'}`}><span className="font-semibold">{replySender}</span><p className="line-clamp-2 break-words">{message.replyTo.text || '[Lampiran]'}</p></div>}
                            {message.decryptionError ? <p className="text-sm italic opacity-80">Pesan tidak dapat didekripsi di browser ini.</p> : <>
                              {message.media && <div className="mb-2">{message.attachmentUrl && message.media.contentType.startsWith('image/') ? <a href={message.attachmentUrl} target="_blank" rel="noreferrer" aria-label={`Buka ${message.media.fileName}`}><Image src={message.attachmentUrl} alt={message.media.fileName} width={480} height={360} unoptimized className="max-h-[360px] max-w-full rounded-md object-contain" /></a> : message.attachmentUrl ? <video src={message.attachmentUrl} controls playsInline preload="metadata" className="max-h-[360px] max-w-full rounded-md" aria-label={message.media.fileName} /> : <p className="text-xs opacity-75">Lampiran tidak tersedia.</p>}<p className="mt-1 max-w-full truncate text-[11px] opacity-75">{message.media.fileName}{message.encryptedAttachment ? ` · ${formatFileSize(message.encryptedAttachment.size)}` : ''}</p></div>}
                              {message.text && <div className="flex min-w-0 items-end gap-2">
                                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{message.text}</p>
                                <div className={`flex shrink-0 translate-y-2.5 items-center gap-1.5 text-[10px] ${own ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                  <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                                  {own && <Check className="h-3 w-3" aria-label="Terkirim" />}
                                </div>
                              </div>}
                            </>}
                            {!message.text && <div className={`mt-1 flex translate-y-2.5 items-center justify-end gap-1.5 text-[10px] ${own ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}><time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>{own && <Check className="h-3 w-3" aria-label="Terkirim" />}</div>}
                          </div>
                          {actionMessageId === message.id && !isSelecting && <div className="mt-1 flex flex-wrap gap-1 rounded-md border border-border bg-popover p-1 shadow-sm"><Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => selectReply(message)}><Reply className="mr-1.5 h-3.5 w-3.5" /> Balas</Button><Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => void handleDelete('me', [message.id])}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus untuk saya</Button>{own && <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => void handleDelete('everyone', [message.id])}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus untuk semua</Button>}<Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Tutup aksi pesan" onClick={() => setActionMessageId('')}><X className="h-4 w-4" /></Button></div>}
                        </div>
                      </article>;
                    })}<div ref={messagesEnd} /></div>}
          </div>

          {connectionError && <Alert variant="destructive" className="mx-3 mb-2 py-2 sm:mx-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{connectionError}</AlertDescription></Alert>}
          {sendError && <Alert variant="destructive" className="mx-3 mb-2 py-2 sm:mx-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{sendError}</AlertDescription></Alert>}
          {selectedContact && <div className="border-t border-border bg-card p-3 sm:p-4">
            {replyTo && <div className="mb-2 flex items-center gap-2 rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2 text-xs"><Reply className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-semibold">Membalas {replyTo.senderId === currentUserId ? 'pesan Anda' : selectedContact.username}</p><p className="truncate text-muted-foreground">{replyTo.text || (replyTo.media ? '[Lampiran]' : '')}</p></div><Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Batal membalas" onClick={() => setReplyTo(null)}><X className="h-4 w-4" /></Button></div>}
            {selectedFile && <div className="mb-2 flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{selectedFile.type.startsWith('video/') ? <Video className="h-4 w-4 shrink-0 text-primary" /> : <ImagePlus className="h-4 w-4 shrink-0 text-primary" />}<span className="min-w-0 flex-1 truncate">{selectedFile.name}</span><span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</span>{!isSending && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFileChange(null)} aria-label="Hapus lampiran"><X className="h-4 w-4" /></Button>}</div>}
            {isSending && selectedFile && <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-[width]" style={{ width: `${uploadProgress}%` }} /></div>}
            <form onSubmit={handleSend} className="flex items-end gap-2 sm:gap-3">
              <input ref={fileInput} type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => handleFileChange(event.target.files?.[0] || null)} disabled={isSending || !canSend} aria-label="Pilih gambar atau video" />
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => fileInput.current?.click()} disabled={isSending || !canSend} aria-label="Lampirkan gambar atau video" title="Lampirkan gambar/video"><Paperclip className="h-4 w-4" /></Button>
              <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={canSend ? 'Tulis pesan terenkripsi...' : selectedContact.recoveryStatus === 'migrating' || recoveryStatus === 'migrating' ? 'Pengiriman dijeda selama migrasi kunci...' : 'Menunggu kunci admin...'} maxLength={MAX_MESSAGE_LENGTH} rows={2} className="min-h-10 max-h-32 resize-y" disabled={isSending || !canSend} aria-label="Isi pesan" />
              <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={isSending || !canSend || (!draft.trim() && !selectedFile)} aria-label="Kirim pesan">{isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : uploadProgress === 100 ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}</Button>
            </form>
          </div>}
        </div>
      </section>
    </div>
  );
}
