'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, CircleAlert, Loader2, Send, ShieldCheck, UserRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AI_CONFIG_STORAGE_KEY,
  buildChatRequestBody,
  ChatAIConfig,
  ChatArrearsCustomer,
  DEFAULT_CHAT_AI_CONFIG,
  getChatAPIErrorMessage,
  getChatCompletionEndpoint,
  getChatModelsEndpoint,
  getChatModelIDs,
  getChatResponseContent,
  normalizeChatAIConfig,
  normalizeChatBaseURL,
  normalizeChatModel,
  parseChatArrearsCustomers,
} from '@/lib/chat-answer';

type Message = { role: 'user' | 'assistant'; content: string };

const suggestions = [
  'Siapa yang belum bayar?',
  'Berapa total tunggakan?',
  'Tampilkan tunggakan Siti',
];

export default function ChatClient({ canManageSettings }: { canManageSettings: boolean }) {
  const [customers, setCustomers] = useState<ChatArrearsCustomer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingArrears, setLoadingArrears] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendStage, setSendStage] = useState<'context' | 'answer'>('context');
  const [arrearsError, setArrearsError] = useState('');
  const [chatError, setChatError] = useState('');
  const [config, setConfig] = useState<ChatAIConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [baseURL, setBaseURL] = useState(DEFAULT_CHAT_AI_CONFIG.baseURL);
  const [model, setModel] = useState(DEFAULT_CHAT_AI_CONFIG.model);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const refreshArrears = useCallback(async () => {
    const response = await fetch('/api/chat/context', { cache: 'no-store' });
    const data: unknown = await response.json();
    const records = parseChatArrearsCustomers(data);
    if (!response.ok || !records) {
      const errorMessage = typeof data === 'object' && data !== null
        && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Data tunggakan gagal dimuat.';
      throw new Error(errorMessage);
    }

    setCustomers(records);
    setArrearsError('');
    return records;
  }, []);

  useEffect(() => {
    let active = true;
    void refreshArrears()
      .catch((error: unknown) => {
        if (active) {
          setArrearsError(error instanceof TypeError
            ? 'Laporan tunggakan tidak dapat dimuat. Periksa koneksi lalu coba lagi.'
            : error instanceof Error ? error.message : 'Data tunggakan gagal dimuat.');
        }
      })
      .finally(() => {
        if (active) setLoadingArrears(false);
      });
    return () => { active = false; };
  }, [refreshArrears]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
      if (stored) {
        const restoredConfig = normalizeChatAIConfig(JSON.parse(stored) as unknown);
        if (!restoredConfig) {
          setSettingsError('Konfigurasi tersimpan tidak valid. Periksa kembali lalu simpan ulang.');
        } else {
          setConfig(restoredConfig);
          setBaseURL(restoredConfig.baseURL);
          setModel(restoredConfig.model);
        }
      }
    } catch {
      setSettingsError('Konfigurasi AI tidak dapat dibaca dari penyimpanan browser.');
    } finally {
      setConfigLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (canManageSettings && configLoaded && !config) setSettingsOpen(true);
  }, [canManageSettings, configLoaded, config]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [messages, sending]);

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsError('');
    setSettingsSaved(false);

    const normalizedBaseURL = normalizeChatBaseURL(baseURL);
    if (!normalizedBaseURL) {
      setSettingsError('Base URL harus berupa alamat HTTPS yang valid (HTTP hanya di localhost).');
      return;
    }
    const normalizedModel = normalizeChatModel(model);
    if (!normalizedModel) {
      setSettingsError('Nama model wajib diisi dan maksimal 120 karakter.');
      return;
    }
    const nextConfig = normalizeChatAIConfig({
      baseURL: normalizedBaseURL,
      model: normalizedModel,
      apiKey: apiKeyInput.trim() || config?.apiKey,
    });
    if (!nextConfig) {
      setSettingsError('Masukkan API Key yang valid untuk menyimpan konfigurasi.');
      return;
    }

    try {
      window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      setConfig(nextConfig);
      setBaseURL(nextConfig.baseURL);
      setModel(nextConfig.model);
      setApiKeyInput('');
      setSettingsSaved(true);
      void loadModels(nextConfig);
    } catch {
      setSettingsError('Konfigurasi tidak dapat disimpan di penyimpanan browser.');
    }
  }

  async function loadModels(overrides?: ChatAIConfig) {
    const apiKey = overrides?.apiKey || apiKeyInput.trim() || config?.apiKey;
    const normalizedBaseURL = normalizeChatBaseURL(overrides?.baseURL || baseURL);
    setModelsError('');

    if (!normalizedBaseURL) {
      setModelsError('Base URL harus berupa alamat HTTPS yang valid (HTTP hanya di localhost).');
      return;
    }
    if (!apiKey) {
      setModelsError('Masukkan API Key terlebih dahulu.');
      return;
    }

    setLoadingModels(true);
    setAvailableModels([]);
    try {
      const response = await fetch(getChatModelsEndpoint(normalizedBaseURL), {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      let responseData: unknown;
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
      if (!response.ok) throw new Error(getChatAPIErrorMessage(response.status, responseData, apiKey));

      const modelIDs = getChatModelIDs(responseData);
      if (modelIDs.length === 0) {
        setModelsError('Penyedia AI tidak mengembalikan daftar model. Periksa API Key dan Base URL.');
        return;
      }
      const selectedModel = modelIDs.includes(overrides?.model || model) ? overrides?.model || model : modelIDs[0];
      setAvailableModels(modelIDs);
      setModel(selectedModel);
      if (overrides) {
        const selectedConfig = { ...overrides, model: selectedModel };
        window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(selectedConfig));
        setConfig(selectedConfig);
        setSettingsSaved(true);
      }
    } catch (error) {
      setModelsError(error instanceof TypeError
        ? 'Tidak dapat terhubung ke penyedia AI. Periksa koneksi dan Base URL.'
        : error instanceof Error ? error.message : 'Daftar model gagal dimuat.');
    } finally {
      setLoadingModels(false);
    }
  }

  function clearSettings() {
    try {
      window.localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
      setConfig(null);
      setApiKeyInput('');
      setBaseURL(DEFAULT_CHAT_AI_CONFIG.baseURL);
      setModel(DEFAULT_CHAT_AI_CONFIG.model);
      setAvailableModels([]);
      setModelsError('');
      setSettingsError('');
      setSettingsSaved(false);
    } catch {
      setSettingsError('Konfigurasi tidak dapat dihapus dari penyimpanan browser.');
    }
  }

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loadingArrears || sending || !configLoaded || !config) return;

    setInput('');
    setChatError('');
    setSending(true);
    setSendStage('context');
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    let requestingProvider = false;

    try {
      const latestCustomers = await refreshArrears();
      setSendStage('answer');

      requestingProvider = true;
      const response = await fetch(getChatCompletionEndpoint(config.baseURL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(buildChatRequestBody(config.model, trimmed, latestCustomers)),
      });
      let responseData: unknown;
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
      if (!response.ok) throw new Error(getChatAPIErrorMessage(response.status, responseData, config.apiKey));

      const answer = getChatResponseContent(responseData);
      if (!answer) throw new Error('Penyedia AI mengirim jawaban kosong atau tidak dikenal.');
      setMessages((current) => [...current, { role: 'assistant', content: answer }]);
    } catch (error) {
      if (error instanceof TypeError) {
        setChatError(requestingProvider
          ? 'Tidak dapat terhubung ke penyedia AI. Periksa koneksi, Base URL, dan dukungan CORS dari penyedia.'
          : 'Laporan tunggakan tidak dapat dimuat. Periksa koneksi lalu coba lagi.');
      } else {
        setChatError(error instanceof Error ? error.message : 'Chat AI gagal memproses pertanyaan.');
      }
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(input);
  }

  const canSend = Boolean(config) && configLoaded && !loadingArrears && !sending && Boolean(input.trim());

  return (
    <main className="app-page mx-auto flex min-h-[calc(100dvh-8rem)] max-w-5xl flex-col gap-4 pb-4 lg:min-h-[calc(100dvh-6rem)]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Asisten tagihan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tanyakan sisa tagihan berdasarkan catatan terbaru pelanggan.
          </p>
        </div>
        <Link href="/arrears" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Buka laporan tunggakan
        </Link>
      </header>

      {canManageSettings && (
        <section className="rounded-md border border-border bg-card shadow-none">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-4 px-4 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={settingsOpen}
            aria-controls="chat-ai-settings"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <span>Pengaturan koneksi AI</span>
            <span className="text-sm font-normal text-muted-foreground">
              {config ? 'Tersimpan di browser ini' : 'Belum dikonfigurasi'}
            </span>
          </button>
          {settingsOpen && (
            <div id="chat-ai-settings" className="border-t border-border px-4 py-4">
              <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
                Kunci API disimpan hanya di localStorage browser ini dan dikirim langsung ke penyedia AI.
                Kunci tidak dikirim ke server aplikasi. Catatan tunggakan yang diperlukan untuk menjawab juga dikirim ke penyedia tersebut.
              </p>
              <form onSubmit={saveSettings} className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="chat-ai-base-url">Base URL</Label>
                  <Input
                    id="chat-ai-base-url"
                    type="url"
                    value={baseURL}
                    onChange={(event) => {
                      setBaseURL(event.target.value);
                      setAvailableModels([]);
                      setModelsError('');
                      setSettingsSaved(false);
                    }}
                    autoComplete="url"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="chat-ai-model">Model AI</Label>
                  {availableModels.length > 0 && (
                    <select
                      aria-label="Pilih model yang tersedia"
                      value={availableModels.includes(model) ? model : ''}
                      onChange={(event) => {
                        if (event.target.value) {
                          setModel(event.target.value);
                          setSettingsSaved(false);
                        }
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Pilih dari {availableModels.length} model Vikey</option>
                      {availableModels.map((modelID) => <option key={modelID} value={modelID}>{modelID}</option>)}
                    </select>
                  )}
                  <Input
                    id="chat-ai-model"
                    value={model}
                    onChange={(event) => {
                      setModel(event.target.value);
                      setSettingsSaved(false);
                    }}
                    maxLength={120}
                    required
                    aria-describedby="chat-ai-model-hint"
                  />
                  <p id="chat-ai-model-hint" className="text-xs text-muted-foreground">
                    Pilih dari daftar Vikey atau masukkan ID model secara manual.
                  </p>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="chat-ai-api-key">API Key</Label>
                  <Input
                    id="chat-ai-api-key"
                    type="password"
                    value={apiKeyInput}
                    onChange={(event) => {
                      setApiKeyInput(event.target.value);
                      setAvailableModels([]);
                      setModelsError('');
                      setSettingsSaved(false);
                    }}
                    autoComplete="new-password"
                    placeholder={config ? 'Tersimpan; kosongkan untuk mempertahankan kunci saat ini' : 'Masukkan API Key'}
                    maxLength={500}
                    aria-describedby="chat-ai-key-hint"
                  />
                  <p id="chat-ai-key-hint" className="text-xs text-muted-foreground">
                    Konfigurasi ini berlaku untuk browser dan profil pengguna yang sama.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" onClick={() => void loadModels()} disabled={loadingModels}>
                      {loadingModels && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {loadingModels ? 'Memuat model…' : 'Tampilkan model Vikey'}
                    </Button>
                    {availableModels.length > 0 && (
                      <span className="text-sm text-muted-foreground" role="status">
                        {availableModels.length} model tersedia
                      </span>
                    )}
                  </div>
                  {modelsError && <p className="text-sm text-destructive" role="alert">{modelsError}</p>}
                </div>
                {settingsError && (
                  <p className="text-sm text-destructive md:col-span-2" role="alert">{settingsError}</p>
                )}
                {settingsSaved && (
                  <p className="text-sm text-muted-foreground md:col-span-2" role="status">Pengaturan AI tersimpan.</p>
                )}
                <div className="flex flex-col-reverse gap-2 md:col-span-2 sm:flex-row sm:justify-end">
                  {config && (
                    <Button type="button" variant="outline" onClick={clearSettings}>
                      Hapus konfigurasi
                    </Button>
                  )}
                  <Button type="submit">Simpan pengaturan</Button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      <Card className="flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-md border-border shadow-none">
        <div className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-3">
          <Bot className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Catatan tunggakan</p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {loadingArrears ? 'Memuat data…' : arrearsError ? 'Data belum tersedia' : `${customers.length} pelanggan dengan sisa tagihan`}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Konteks internal
          </span>
        </div>

        <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6" aria-label="Percakapan" aria-live="polite">
          {messages.length === 0 && !loadingArrears && !arrearsError && (
            <div className="mx-auto my-auto flex w-full max-w-xl flex-col items-center py-8 text-center">
              <h2 className="text-lg font-semibold">Apa yang ingin Anda ketahui?</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Jawaban AI memakai catatan tunggakan sebagai konteks. Periksa kembali sebelum mengambil tindakan.
              </p>
              {!loadingArrears && !arrearsError && config && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => void submitQuestion(suggestion)}
                      disabled={sending}
                      className="min-h-10 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loadingArrears && messages.length === 0 && (
            <div className="mx-auto my-auto flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Memuat laporan tunggakan…
            </div>
          )}

          {arrearsError && (
            <Alert variant="destructive">
              <CircleAlert className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{arrearsError}</span>
                <button type="button" className="underline underline-offset-4" onClick={() => {
                  setLoadingArrears(true);
                  void refreshArrears()
                    .catch((error: unknown) => setArrearsError(error instanceof TypeError
                      ? 'Laporan tunggakan tidak dapat dimuat. Periksa koneksi lalu coba lagi.'
                      : error instanceof Error ? error.message : 'Data tunggakan gagal dimuat.'))
                    .finally(() => setLoadingArrears(false));
                }}>
                  Muat ulang
                </button>
              </AlertDescription>
            </Alert>
          )}

          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && <Bot className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              <div className={`max-w-[min(88%,38rem)] whitespace-pre-wrap rounded-md px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {message.content}
              </div>
              {message.role === 'user' && <UserRound className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {sendStage === 'context' ? 'Memeriksa catatan terbaru…' : 'Mengetik…'}
            </div>
          )}
          {chatError && (
            <Alert variant="destructive" role="alert">
              <CircleAlert className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{chatError}</AlertDescription>
            </Alert>
          )}
          <div ref={endRef} />
        </section>

        <form onSubmit={handleSubmit} className="border-t border-border p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-md border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submitQuestion(input);
                }
              }}
              aria-label="Tulis pertanyaan tentang tunggakan"
              placeholder="Tulis pertanyaan tentang tunggakan…"
              rows={1}
              maxLength={500}
              disabled={loadingArrears || sending || !configLoaded || !config}
              className="max-h-32 min-h-10 resize-y border-0 px-2 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button type="submit" size="icon" aria-label="Kirim pertanyaan" disabled={!canSend}>
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            {configLoaded && !config
              ? 'Pengaturan AI belum tersedia di browser ini. Hubungi superadmin.'
              : 'Jawaban AI menggunakan catatan tunggakan sebagai konteks, tetapi tetap perlu diperiksa. Jangan masukkan informasi sensitif.'}
          </p>
        </form>
      </Card>
    </main>
  );
}
