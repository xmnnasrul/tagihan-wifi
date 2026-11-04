import ChatClient from '@/components/ChatClient';
import { getAIChatPageAccess } from '@/lib/session';

export default async function ChatPage() {
  const { allowed, canManageSettings } = await getAIChatPageAccess();

  if (!allowed) {
    return (
      <main className="app-page mx-auto max-w-3xl space-y-3" role="alert">
        <h1>403 Forbidden</h1>
        <p className="text-sm text-muted-foreground">
          Akses Chat AI ditolak. Minta superadmin mengaktifkan izin Chat AI untuk akun Anda.
        </p>
      </main>
    );
  }

  return <ChatClient canManageSettings={canManageSettings} />;
}
