'use client';

import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, CircleAlert, Loader2, Send, Settings, Trash2, UserRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AI_CONFIG_STORAGE_KEY,
  buildChatRequestBody,
  CHAT_AI_PROVIDERS,
  ChatAIConfig,
  ChatAIProvider,
  ChatAISettings,
  DEFAULT_CHAT_AI_CONFIG,
  getCloudflareAccountIDFromBaseURL,
  getCloudflareWorkersAIBaseURL,
  getChatNewCustomerFollowUpQuestion,
  getChatBillingFollowUpQuestion,
  getChatProviderBaseURL,
  isCloudflareWorkersAIModel,
  getChatCustomerDataReply,
  getChatUnpaidBillingReply,
  getChatVisitedCustomerReply,
  getChatContextTopics,
  getChatNoDataReply,
  getChatResponseContent,
  isChatStreamingRejectionStatus,
  readChatCompletionStream,
  isChatAIProvider,
  normalizeChatAIConfig,
  normalizeChatBaseURL,
  normalizeCloudflareAccountID,
  normalizeCloudflareWorkersAIBaseURL,
  normalizeChatModel,
} from '@/lib/chat-answer';

type Message = { role: 'user' | 'assistant'; content: string };
type ChatAIModelConfig = Pick<ChatAISettings, 'provider' | 'baseURL' | 'model'> & { apiKey?: string };

function RexxaaMark({ className }: { className: string }) {
  return (
    <span
      className={`${className} inline-flex items-center justify-center font-bold leading-none text-primary`}
      aria-hidden="true"
    >
      R
    </span>
  );
}

function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return 'role' in value
    && (value.role === 'user' || value.role === 'assistant')
    && 'content' in value
    && typeof value.content === 'string';
}

function isChatAISettings(value: unknown): value is ChatAISettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return 'provider' in value
    && isChatAIProvider(value.provider)
    && 'baseURL' in value && typeof value.baseURL === 'string'
    && 'model' in value && typeof value.model === 'string'
    && 'hasApiKey' in value && typeof value.hasApiKey === 'boolean';
}

async function readResponseData(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim().replace(/^\|/u, '').replace(/\|$/u, '');
  if (!trimmed.includes('|')) return null;
  return trimmed.split('|').map((cell) => cell.trim().replace(/\\\|/gu, '|'));
}

function getResponseError(value: unknown, fallback: string): string {
  return typeof value === 'object' && value !== null
    && 'error' in value && typeof value.error === 'string'
    ? value.error
    : fallback;
}

function renderChatMessage(content: string): ReactNode {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let textLines: string[] = [];
  let blockIndex = 0;

  function flushText() {
    if (textLines.length === 0) return;
    const text = textLines.join('\n').trim();
    if (text) {
      blocks.push(<p key={`text-${blockIndex++}`} className="whitespace-pre-wrap">{text}</p>);
    }
    textLines = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const headers = parseMarkdownTableRow(lines[index]);
    const separators = index + 1 < lines.length ? parseMarkdownTableRow(lines[index + 1]) : null;
    if (
      !headers || !separators || headers.length !== separators.length
      || !separators.every((cell) => /^:?-{3,}:?$/u.test(cell))
    ) {
      textLines.push(lines[index]);
      continue;
    }

    flushText();
    const rows: string[][] = [];
    index += 2;
    while (index < lines.length) {
      const row = parseMarkdownTableRow(lines[index]);
      if (!row || row.length !== headers.length) break;
      rows.push(row);
      index += 1;
    }
    index -= 1;
    const isFirstBlock = blocks.length === 0;
    const isLastBlock = !lines.slice(index + 1).some((line) => line.trim());
    const headerPadding = `${isFirstBlock ? 'pt-0' : 'pt-2'} ${
      isLastBlock && rows.length === 0 ? 'pb-0' : 'pb-2'
    }`;

    blocks.push(
      <div
        key={`table-${blockIndex++}`}
        className="max-w-full overflow-x-auto"
        role="region"
        aria-label="Tabel jawaban yang dapat digulir"
        tabIndex={0}
      >
        <table className="min-w-max w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {headers.map((header, columnIndex) => (
                <th
                  key={`${header}-${columnIndex}`}
                  scope="col"
                  className={`border-b border-border/70 px-3 ${headerPadding} font-medium text-muted-foreground first:pl-0 last:pr-0 ${
                    /(?:tagihan|jumlah|total|harga|saldo|nominal|bayar|setoran)/iu.test(header)
                      ? 'text-right tabular-nums'
                      : 'text-left'
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, columnIndex) => (
                  <td
                    key={`${columnIndex}-${cell}`}
                    className={`border-b border-border/40 px-3 ${
                      isLastBlock && rowIndex === rows.length - 1 ? 'pb-0 pt-2' : 'py-2'
                    } align-top whitespace-nowrap first:pl-0 last:pr-0 ${
                      /(?:tagihan|jumlah|total|harga|saldo|nominal|bayar|setoran)/iu.test(headers[columnIndex])
                        ? 'text-right tabular-nums'
                        : 'text-left'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  flushText();
  return <div className="space-y-3">{blocks}</div>;
}

export default function ChatClient({ canManageSettings }: { canManageSettings: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStage, setSendStage] = useState<'context' | 'answer'>('context');
  const [chatError, setChatError] = useState('');
  const [config, setConfig] = useState<ChatAISettings | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ChatAIProvider>(DEFAULT_CHAT_AI_CONFIG.provider);
  const [baseURL, setBaseURL] = useState(DEFAULT_CHAT_AI_CONFIG.baseURL);
  const [cloudflareAccountID, setCloudflareAccountID] = useState('');
  const [model, setModel] = useState(DEFAULT_CHAT_AI_CONFIG.model);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const messagesContainerRef = useRef<HTMLElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/chat/history', { cache: 'no-store' })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!response.ok) {
          throw new Error(typeof data === 'object' && data !== null
            && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Riwayat chat gagal dimuat.');
        }
        if (
          typeof data !== 'object' || data === null || !('messages' in data)
          || !Array.isArray(data.messages) || !data.messages.every(isMessage)
        ) {
          throw new Error('Format riwayat chat tidak valid.');
        }
        if (active) setMessages(data.messages);
      })
      .catch((error: unknown) => {
        if (active) setHistoryError(error instanceof TypeError
          ? 'Riwayat chat tidak dapat dimuat. Periksa koneksi lalu coba lagi.'
          : error instanceof Error ? error.message : 'Riwayat chat gagal dimuat.');
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      let legacyConfig: ChatAIConfig | null = null;
      let resolvedConfig: ChatAISettings | null = null;
      try {
        const stored = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
        if (stored) legacyConfig = normalizeChatAIConfig(JSON.parse(stored) as unknown);
        window.localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
      } catch {
        setSettingsError('Konfigurasi AI lama tidak dapat dibaca atau dihapus dari browser.');
      }

      try {
        const response = await fetch('/api/chat/settings', { cache: 'no-store' });
        const data: unknown = await response.json();
        if (!response.ok) throw new Error(getResponseError(data, 'Pengaturan AI gagal dimuat.'));
        const serverConfig = typeof data === 'object' && data !== null && 'config' in data
          && isChatAISettings(data.config) ? data.config : null;
        if (serverConfig) {
          resolvedConfig = serverConfig;
        } else if (legacyConfig && canManageSettings) {
          const migrationResponse = await fetch('/api/chat/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(legacyConfig),
          });
          const migrationData: unknown = await migrationResponse.json();
          if (!migrationResponse.ok) {
            throw new Error(getResponseError(migrationData, 'Konfigurasi AI lama gagal dipindahkan ke server.'));
          }
          const migratedConfig = typeof migrationData === 'object' && migrationData !== null
            && 'config' in migrationData ? migrationData.config : null;
          if (!isChatAISettings(migratedConfig)) throw new Error('Respons pengaturan AI dari server tidak valid.');
          resolvedConfig = migratedConfig;
        } else if (legacyConfig && !canManageSettings) {
          if (active) setSettingsError('Konfigurasi AI lama telah dihapus dari browser. Minta superadmin menyimpan konfigurasi AI di server.');
        }

        if (active && resolvedConfig) {
          setConfig(resolvedConfig);
          setSelectedProvider(resolvedConfig.provider);
          setBaseURL(resolvedConfig.baseURL);
          if (resolvedConfig.provider === 'cloudflare') {
            setCloudflareAccountID(getCloudflareAccountIDFromBaseURL(resolvedConfig.baseURL) || '');
          }
          setModel(resolvedConfig.model);
        }
      } catch (error) {
        if (active) {
          if (legacyConfig && canManageSettings) {
            setSelectedProvider(legacyConfig.provider);
            setBaseURL(legacyConfig.baseURL);
            if (legacyConfig.provider === 'cloudflare') {
              setCloudflareAccountID(getCloudflareAccountIDFromBaseURL(legacyConfig.baseURL) || '');
            }
            setModel(legacyConfig.model);
            setApiKeyInput(legacyConfig.apiKey);
            setSettingsOpen(true);
          }
          setSettingsError(error instanceof Error ? error.message : 'Pengaturan AI gagal dimuat.');
        }
      } finally {
        if (active) setConfigLoaded(true);
      }
    }

    void loadSettings();
    return () => { active = false; };
  }, [canManageSettings]);

  useEffect(() => {
    if (canManageSettings && configLoaded && !config) setSettingsOpen(true);
  }, [canManageSettings, configLoaded, config]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (shouldAutoScrollRef.current) {
      container.scrollTop = container.scrollHeight;
      setShowScrollDown(false);
      return;
    }

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollDown(distanceToBottom > 48);
  }, [messages, sending]);

  function handleMessagesScroll() {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearLatest = distanceToBottom <= 48;
    shouldAutoScrollRef.current = isNearLatest;
    setShowScrollDown(!isNearLatest && container.scrollHeight > container.clientHeight);
  }

  function scrollToLatest() {
    const container = messagesContainerRef.current;
    if (!container) return;
    shouldAutoScrollRef.current = true;
    setShowScrollDown(false);
    container.scrollTo({
      top: container.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }

  function chooseProvider(provider: ChatAIProvider) {
    if (provider === selectedProvider) return;
    setSelectedProvider(provider);
    setBaseURL(getChatProviderBaseURL(provider));
    setCloudflareAccountID('');
    setApiKeyInput('');
    setModel('');
    setAvailableModels([]);
    setModelsError('');
    setSettingsError('');
    setSettingsSaved(false);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsError('');
    setSettingsSaved(false);
    if (!canManageSettings) {
      setSettingsError('Hanya superadmin yang dapat mengubah pengaturan AI.');
      return;
    }

    const normalizedBaseURL = selectedProvider === 'custom'
      ? normalizeChatBaseURL(baseURL)
      : selectedProvider === 'cloudflare'
        ? normalizeCloudflareWorkersAIBaseURL(baseURL)
        : getChatProviderBaseURL(selectedProvider);
    if (!normalizedBaseURL) {
      setSettingsError(selectedProvider === 'cloudflare'
        ? 'Masukkan Account ID Cloudflare yang valid.'
        : 'Base URL harus berupa alamat HTTPS yang valid (HTTP hanya di localhost).');
      return;
    }
    const normalizedModel = normalizeChatModel(model);
    if (!normalizedModel) {
      setSettingsError('Nama model wajib diisi dan maksimal 120 karakter.');
      return;
    }
    if (selectedProvider === 'cloudflare' && !isCloudflareWorkersAIModel(normalizedModel)) {
      setSettingsError('Model Workers AI harus berupa ID @cf/provider/model yang valid.');
      return;
    }
    if (selectedProvider !== 'cloudflare' && !availableModels.includes(normalizedModel)) {
      setSettingsError('Pilih model AI dari daftar yang tersedia terlebih dahulu.');
      return;
    }
    if (!apiKeyInput.trim() && !(config?.provider === selectedProvider && config.hasApiKey)) {
      setSettingsError('Masukkan API Key yang valid untuk menyimpan konfigurasi.');
      return;
    }

    try {
      const response = await fetch('/api/chat/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          baseURL: normalizedBaseURL,
          model: normalizedModel,
          ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : {}),
        }),
      });
      const data: unknown = await readResponseData(response);
      if (!response.ok) throw new Error(getResponseError(data, 'Konfigurasi AI gagal disimpan.'));
      const savedConfig = typeof data === 'object' && data !== null && 'config' in data ? data.config : null;
      if (!isChatAISettings(savedConfig)) throw new Error('Respons pengaturan AI dari server tidak valid.');

      setConfig(savedConfig);
      setSelectedProvider(savedConfig.provider);
      setBaseURL(savedConfig.baseURL);
      if (savedConfig.provider === 'cloudflare') {
        setCloudflareAccountID(getCloudflareAccountIDFromBaseURL(savedConfig.baseURL) || '');
      }
      setModel(savedConfig.model);
      setApiKeyInput('');
      setSettingsSaved(true);
      if (savedConfig.provider !== 'cloudflare') {
        void loadModels({
          provider: savedConfig.provider,
          baseURL: savedConfig.baseURL,
          model: savedConfig.model,
          ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : {}),
        });
      }
    } catch (error) {
      setSettingsError(error instanceof TypeError
        ? 'Pengaturan AI tidak dapat disimpan ke server.'
        : error instanceof Error ? error.message : 'Pengaturan AI gagal disimpan.');
    }
  }

  async function saveHistory(messagesToSave: Message[]) {
    const response = await fetch('/api/chat/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messagesToSave }),
    });
    if (!response.ok) throw new Error('Riwayat chat gagal disimpan.');
  }

  async function clearChatHistory() {
    if (historyLoading || sending || clearingHistory) return;

    setClearingHistory(true);
    setHistoryError('');
    try {
      const response = await fetch('/api/chat/history', { method: 'DELETE' });
      if (!response.ok) {
        const data = await readResponseData(response);
        const message = typeof data === 'object' && data !== null
          && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Riwayat chat gagal dihapus.';
        throw new Error(message);
      }

      setMessages([]);
      setInput('');
      setChatError('');
      setHistoryError('');
      shouldAutoScrollRef.current = true;
      setShowScrollDown(false);
      setClearHistoryOpen(false);
    } catch (error) {
      setHistoryError(error instanceof TypeError
        ? 'Riwayat chat tidak dapat dihapus. Periksa koneksi lalu coba lagi.'
        : error instanceof Error ? error.message : 'Riwayat chat gagal dihapus.');
    } finally {
      setClearingHistory(false);
    }
  }

  async function appendAssistantMessage(content: string, userHistorySaved: boolean, alreadyDisplayed = false) {
    const assistantMessage: Message = { role: 'assistant', content };
    if (!alreadyDisplayed) setMessages((current) => [...current, assistantMessage]);
    if (!userHistorySaved) {
      setHistoryError('Jawaban diterima, tetapi riwayat chat tidak dapat disimpan.');
      return;
    }

    try {
      await saveHistory([assistantMessage]);
      setHistoryError('');
    } catch {
      setHistoryError('Jawaban diterima, tetapi riwayat chat tidak dapat disimpan.');
    }
  }

  async function loadModels(overrides?: ChatAIModelConfig) {
    if (!canManageSettings) {
      setSettingsError('Hanya superadmin yang dapat mengubah pengaturan AI.');
      return;
    }

    const provider = overrides?.provider || selectedProvider;
    const apiKey = overrides?.apiKey || apiKeyInput.trim();
    const providerBaseURL = overrides?.baseURL || baseURL;
    const normalizedBaseURL = provider === 'custom'
      ? normalizeChatBaseURL(providerBaseURL)
      : provider === 'cloudflare'
        ? normalizeCloudflareWorkersAIBaseURL(providerBaseURL)
        : getChatProviderBaseURL(provider);
    setModelsError('');

    if (!normalizedBaseURL) {
      setModelsError('Base URL harus berupa alamat HTTPS yang valid (HTTP hanya di localhost).');
      return;
    }
    if (!apiKey && !(config?.provider === provider && config.hasApiKey && config.baseURL === normalizedBaseURL)) {
      setModelsError('Masukkan API Key terlebih dahulu.');
      return;
    }

    setLoadingModels(true);
    setAvailableModels([]);
    try {
      const response = await fetch('/api/chat/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          baseURL: normalizedBaseURL,
          ...(apiKey ? { apiKey } : {}),
        }),
      });
      const responseData = await readResponseData(response);
      if (!response.ok) {
        throw new Error(getResponseError(responseData, 'Daftar model gagal dimuat.'));
      }

      const modelIDs = typeof responseData === 'object' && responseData !== null
        && 'models' in responseData && Array.isArray(responseData.models)
        ? responseData.models.filter((modelID): modelID is string => typeof modelID === 'string')
        : [];
      if (modelIDs.length === 0) {
        setModelsError(provider === 'codex'
          ? 'Tidak ada model Codex yang tersedia untuk API Key ini.'
          : 'Penyedia AI tidak mengembalikan daftar model. Periksa API Key dan Base URL.');
        return;
      }
      const selectedModel = modelIDs.includes(overrides?.model || model) ? overrides?.model || model : modelIDs[0];
      setAvailableModels(modelIDs);
      setModel(selectedModel);
    } catch (error) {
      setModelsError(error instanceof TypeError
        ? 'Tidak dapat terhubung ke server aplikasi.'
        : error instanceof Error ? error.message : 'Daftar model gagal dimuat.');
    } finally {
      setLoadingModels(false);
    }
  }

  async function clearSettings() {
    if (!canManageSettings) {
      setSettingsError('Hanya superadmin yang dapat mengubah pengaturan AI.');
      return;
    }

    try {
      const response = await fetch('/api/chat/settings', { method: 'DELETE' });
      const data: unknown = await readResponseData(response);
      if (!response.ok) throw new Error(getResponseError(data, 'Pengaturan AI gagal dihapus.'));
      setConfig(null);
      setSelectedProvider(DEFAULT_CHAT_AI_CONFIG.provider);
      setApiKeyInput('');
      setBaseURL(DEFAULT_CHAT_AI_CONFIG.baseURL);
      setCloudflareAccountID('');
      setModel(DEFAULT_CHAT_AI_CONFIG.model);
      setAvailableModels([]);
      setModelsError('');
      setSettingsError('');
      setSettingsSaved(false);
    } catch (error) {
      setSettingsError(error instanceof TypeError
        ? 'Pengaturan AI tidak dapat dihapus dari server.'
        : error instanceof Error ? error.message : 'Pengaturan AI gagal dihapus.');
    }
  }

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || sending || historyLoading || !configLoaded || !config) return;
    const activeConfig = config;
    const previousQuestion = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
    const newCustomerQuestion = getChatNewCustomerFollowUpQuestion(trimmed, previousQuestion);
    const questionForProcessing = getChatBillingFollowUpQuestion(newCustomerQuestion, previousQuestion);

    setInput('');
    setChatError('');
    setSending(true);
    setSendStage('context');
    const userMessage: Message = { role: 'user', content: trimmed };
    setMessages((current) => [...current, userMessage]);
    let requestingProvider = false;
    let userHistorySaved = false;

    try {
      try {
        await saveHistory([userMessage]);
        userHistorySaved = true;
        setHistoryError('');
      } catch {
        setHistoryError('Pesan terkirim, tetapi riwayat chat tidak dapat disimpan.');
      }

      const topics = getChatContextTopics(questionForProcessing);
      let context: unknown = null;
      if (topics.length > 0) {
        const contextResponse = await fetch(`/api/chat/context?question=${encodeURIComponent(questionForProcessing)}`, {
          cache: 'no-store',
        });
        const contextData: unknown = await contextResponse.json();
        if (!contextResponse.ok) {
          const errorMessage = typeof contextData === 'object' && contextData !== null
            && 'error' in contextData && typeof contextData.error === 'string'
            ? contextData.error
            : 'Data website gagal dimuat.';
          throw new Error(errorMessage);
        }
        const noDataReply = getChatNoDataReply(contextData);
        if (noDataReply) {
          await appendAssistantMessage(noDataReply, userHistorySaved);
          return;
        }
        const unpaidBillingReply = getChatUnpaidBillingReply(contextData);
        if (unpaidBillingReply) {
          await appendAssistantMessage(unpaidBillingReply, userHistorySaved);
          return;
        }
        const visitedCustomerReply = getChatVisitedCustomerReply(contextData);
        if (visitedCustomerReply) {
          await appendAssistantMessage(visitedCustomerReply, userHistorySaved);
          return;
        }
        const customerDataReply = getChatCustomerDataReply(contextData);
        if (customerDataReply) {
          await appendAssistantMessage(customerDataReply, userHistorySaved);
          return;
        }
        context = typeof contextData === 'object' && contextData !== null && 'data' in contextData
          ? contextData.data
          : null;
      }
      setSendStage('answer');

      requestingProvider = true;
      const baseRequestBody = buildChatRequestBody(
        activeConfig.model,
        questionForProcessing,
        context,
        activeConfig.provider,
        messages,
      );
      async function sendCompletion(streaming: boolean) {
        const requestBody = {
          ...baseRequestBody,
          ...(streaming && activeConfig.provider !== 'gemini' ? { stream: true } : {}),
        };
        return fetch('/api/chat/completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ streaming, requestBody }),
        });
      }

      let response = await sendCompletion(true);
      if (!response.ok) {
        const responseData = await readResponseData(response);
        if (!isChatStreamingRejectionStatus(response.status)) {
          throw new Error(getResponseError(responseData, 'Penyedia AI menolak permintaan.'));
        }

        response = await sendCompletion(false);
        if (!response.ok) {
          const fallbackError = await readResponseData(response);
          throw new Error(getResponseError(fallbackError, 'Penyedia AI menolak permintaan.'));
        }
      }

      let answer: string | null;
      let streamedMessageVisible = false;
      if (response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
        let streamedAnswer = '';
        answer = await readChatCompletionStream(response, activeConfig.provider, '', (delta) => {
          streamedAnswer += delta;
          const updateVisibleStream = streamedMessageVisible;
          streamedMessageVisible = true;
          setMessages((current) => {
            const lastIndex = current.length - 1;
            if (updateVisibleStream && current[lastIndex]?.role === 'assistant') {
              return [...current.slice(0, lastIndex), { role: 'assistant', content: streamedAnswer }];
            }
            return [...current, { role: 'assistant', content: streamedAnswer }];
          });
        });
      } else {
        const responseData = await readResponseData(response);
        answer = getChatResponseContent(responseData, activeConfig.provider);
      }
      if (!answer) throw new Error('Penyedia AI mengirim jawaban kosong atau tidak dikenal.');
      await appendAssistantMessage(answer, userHistorySaved, streamedMessageVisible);
    } catch (error) {
      if (error instanceof TypeError) {
        setChatError(requestingProvider
          ? 'Tidak dapat terhubung ke server aplikasi untuk meneruskan permintaan AI.'
          : 'Data website tidak dapat dimuat. Periksa koneksi lalu coba lagi.');
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

  const canSend = Boolean(config) && configLoaded && !historyLoading && !sending && Boolean(input.trim());

  return (
    <main
      data-chat-page="true"
      className="app-page mx-auto flex h-full min-h-0 max-w-5xl flex-col gap-4 overflow-hidden"
    >
      {canManageSettings && (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-h-[min(85dvh,52rem)] gap-5 overflow-y-auto rounded-2xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Pengaturan koneksi AI</DialogTitle>
              <DialogDescription>
                Atur penyedia, API key, dan model untuk chat ini.
              </DialogDescription>
            </DialogHeader>
              <form onSubmit={saveSettings} className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <p className="text-sm font-medium leading-none">Penyedia AI</p>
                  <div className="-mx-1 overflow-x-auto px-1 scrollbar-hidden">
                    <div className="flex min-w-max border-b border-border" role="group" aria-label="Pilih penyedia AI">
                      {CHAT_AI_PROVIDERS.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          aria-pressed={selectedProvider === provider.id}
                          onClick={() => chooseProvider(provider.id)}
                          className={`min-h-10 shrink-0 border-b-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selectedProvider === provider.id
                              ? 'border-foreground font-medium text-foreground'
                              : 'border-transparent text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {provider.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {selectedProvider === 'cloudflare' && (
                  <div className="grid gap-2">
                    <Label htmlFor="chat-ai-cloudflare-account-id">Cloudflare Account ID</Label>
                    <Input
                      id="chat-ai-cloudflare-account-id"
                      type="text"
                      value={cloudflareAccountID}
                      onChange={(event) => {
                        const nextAccountID = event.target.value;
                        const normalizedAccountID = normalizeCloudflareAccountID(nextAccountID);
                        setCloudflareAccountID(nextAccountID);
                        setBaseURL(normalizedAccountID ? getCloudflareWorkersAIBaseURL(normalizedAccountID) || '' : '');
                        setModelsError('');
                        setSettingsSaved(false);
                      }}
                      autoComplete="off"
                      maxLength={32}
                      aria-describedby="chat-ai-cloudflare-account-hint"
                      required
                    />
                    <p id="chat-ai-cloudflare-account-hint" className="text-xs text-muted-foreground">
                      Salin Account ID 32 karakter dari dashboard Cloudflare. Endpoint akan terisi otomatis.
                    </p>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="chat-ai-base-url">Base URL</Label>
                  <Input
                    id="chat-ai-base-url"
                    type="url"
                    value={baseURL}
                    onChange={(event) => {
                      if (selectedProvider !== 'custom') return;
                      setBaseURL(event.target.value);
                      setAvailableModels([]);
                      setModelsError('');
                      setSettingsSaved(false);
                    }}
                    readOnly={selectedProvider !== 'custom'}
                    autoComplete="url"
                    required={selectedProvider !== 'cloudflare'}
                  />
                  {selectedProvider === 'custom' && (
                    <p className="text-xs text-muted-foreground">
                      Custom API harus memakai HTTPS.
                    </p>
                  )}
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="chat-ai-api-key">
                    {selectedProvider === 'cloudflare' ? 'Cloudflare API Token' : 'API Key'}
                  </Label>
                  <Input
                    id="chat-ai-api-key"
                    type="password"
                    value={apiKeyInput}
                    onBlur={(event) => {
                      const nextTarget = event.relatedTarget;
                      if (
                        apiKeyInput.trim()
                        && !(nextTarget instanceof HTMLButtonElement)
                        && selectedProvider !== 'cloudflare'
                        && !loadingModels
                        && availableModels.length === 0
                      ) {
                        void loadModels();
                      }
                    }}
                    onChange={(event) => {
                      setApiKeyInput(event.target.value);
                      setAvailableModels([]);
                      setModelsError('');
                      setSettingsSaved(false);
                    }}
                    autoComplete="new-password"
                    maxLength={500}
                    aria-describedby={selectedProvider === 'cloudflare' ? 'chat-ai-key-hint' : undefined}
                  />
                  {selectedProvider === 'cloudflare' && (
                    <p id="chat-ai-key-hint" className="text-xs text-muted-foreground">
                      Gunakan token dengan izin Workers AI Read serta AI Gateway Read/Edit.
                    </p>
                  )}
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="chat-ai-model">Model AI</Label>
                  {selectedProvider === 'cloudflare' ? (
                    <Input
                      id="chat-ai-model"
                      type="text"
                      value={model}
                      onChange={(event) => {
                        setModel(event.target.value);
                        setSettingsSaved(false);
                      }}
                      maxLength={120}
                      autoComplete="off"
                      required
                      aria-describedby="chat-ai-model-hint"
                    />
                  ) : (
                    <select
                      id="chat-ai-model"
                      value={availableModels.includes(model) ? model : ''}
                      onFocus={() => {
                        if (
                          !apiKeyInput.trim() && config?.provider === selectedProvider
                          && config.hasApiKey && !loadingModels && availableModels.length === 0
                        ) {
                          void loadModels();
                        }
                      }}
                      onChange={(event) => {
                        setModel(event.target.value);
                        setSettingsSaved(false);
                      }}
                      required
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="" disabled>
                        {loadingModels
                          ? 'Memuat daftar model…'
                          : availableModels.length > 0
                            ? 'Pilih model AI'
                            : apiKeyInput.trim() || config?.hasApiKey
                              ? 'Pilih model AI'
                              : 'Isi API Key dulu'}
                      </option>
                      {availableModels.map((modelID) => <option key={modelID} value={modelID}>{modelID}</option>)}
                    </select>
                  )}
                  {selectedProvider === 'cloudflare' && (
                    <p id="chat-ai-model-hint" className="text-xs text-muted-foreground">
                      Masukkan ID model dari katalog Workers AI, contohnya @cf/meta/llama-3.1-8b-instruct.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {loadingModels && (
                      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Memuat model…
                      </span>
                    )}
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
                <div className="flex items-center justify-end gap-2 md:col-span-2">
                  {config && (
                    <Button
                      type="button"
                      variant="outline"
                      className="mr-auto px-2 text-xs sm:px-4 sm:text-sm"
                      onClick={clearSettings}
                    >
                      Hapus konfigurasi
                    </Button>
                  )}
                  <Button type="submit" className="px-2 text-xs sm:px-4 sm:text-sm">
                    Simpan pengaturan
                  </Button>
                </div>
              </form>
          </DialogContent>
        </Dialog>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border-border shadow-none">
        <div className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-3">
          <RexxaaMark className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Rexxaa</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Hapus percakapan"
            title="Hapus percakapan"
            disabled={messages.length === 0 || historyLoading || sending || clearingHistory}
            onClick={() => setClearHistoryOpen(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          {canManageSettings && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Buka pengaturan AI"
              title="Pengaturan AI"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        <div className="relative flex min-h-0 flex-1">
        <section
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-4 pb-16 sm:p-6 sm:pb-20"
          aria-label="Percakapan"
          aria-live="polite"
        >
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && <RexxaaMark className="mt-1 h-4 w-4 shrink-0 text-primary" />}
              <div className={`max-w-[min(88%,38rem)] whitespace-pre-wrap rounded-md px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {message.role === 'assistant' ? renderChatMessage(message.content) : message.content}
              </div>
              {message.role === 'user' && <UserRound className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            </div>
          ))}
          {historyLoading && messages.length === 0 && (
            <div className="mx-auto my-auto flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Memuat riwayat chat…
            </div>
          )}

          {historyError && (
            <Alert variant="destructive" role="alert">
              <CircleAlert className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{historyError}</AlertDescription>
            </Alert>
          )}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {sendStage === 'context' ? 'Memeriksa catatan terbaru…' : 'Bentarrr yaaawww'}
            </div>
          )}
          {chatError && (
            <Alert variant="destructive" role="alert">
              <CircleAlert className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{chatError}</AlertDescription>
            </Alert>
          )}
        </section>
        {showScrollDown && (
          <button
            type="button"
            onClick={scrollToLatest}
            className="absolute bottom-3 right-3 z-10 flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Gulir ke pesan terbaru"
            title="Gulir ke pesan terbaru"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        </div>

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
              aria-label="Tulis pertanyaan untuk asisten AI"
              rows={1}
              maxLength={500}
              disabled={sending || historyLoading || !configLoaded || !config}
              className="max-h-32 min-h-10 resize-none border-0 px-2 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button type="submit" size="icon" aria-label="Kirim pertanyaan" disabled={!canSend}>
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {configLoaded && !config && (
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              Pengaturan AI belum tersedia di browser ini. Hubungi superadmin.
            </p>
          )}
        </form>
      </Card>
      <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus percakapan?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua riwayat chat di akun ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {historyError && <p className="text-sm text-destructive" role="alert">{historyError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingHistory}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearingHistory || sending || historyLoading}
              onClick={(event) => {
                event.preventDefault();
                void clearChatHistory();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearingHistory && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Hapus chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
