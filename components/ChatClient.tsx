'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowDown, CircleAlert, Loader2, Send, Settings, Trash2 } from 'lucide-react';
import ChatSettingsDialog from '@/components/chat/ChatSettingsDialog';
import {
  Message,
  attachChatTablePagination,
  appendChatWebSources,
  getChatWebImages,
  getChatWebSources,
  getResponseError,
  getStructuredChatReply,
  isChatAISettings,
  isMessage,
  readResponseData,
  renderChatMessage,
} from '@/components/chat/chat-message-content';
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
import { Textarea } from '@/components/ui/textarea';
import {
  AI_CONFIG_STORAGE_KEY,
  buildChatRequestBody,
  appendChatWebImageMetadata,
  ChatAIConfig,
  ChatAIProvider,
  ChatAISettings,
  ChatPendingLearning,
  ChatTablePageMetadata,
  DEFAULT_CHAT_AI_CONFIG,
  getCloudflareAccountIDFromBaseURL,
  getChatNewCustomerFollowUpQuestion,
  getChatBillingFollowUpQuestion,
  getChatContextFollowUpQuestion,
  getChatProviderBaseURL,
  getChatGreetingReply,
  isCloudflareAIModel,
  getChatContextTopics,
  getChatTablePageMetadata,
  getChatLearningAction,
  getPendingChatLearning,
  getChatResponseContent,
  isChatTablePageMetadata,
  isChatStreamingRejectionStatus,
  readChatCompletionStream,
  normalizeChatAIConfig,
  normalizeChatBaseURL,
  normalizeCloudflareWorkersAIBaseURL,
  normalizeChatModel,
} from '@/lib/chat-answer';
import { shouldSearchChatImages, shouldSearchChatWeb } from '@/lib/chat-web-search.mjs';

type ChatAIModelConfig = Pick<ChatAISettings, 'provider' | 'baseURL' | 'model'> & { apiKey?: string };

const ChatSignal = dynamic(() => import('@/components/ChatSignal'), {
  ssr: false,
  loading: () => (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-sm font-semibold text-primary">
      A
    </span>
  ),
});

function RexxaaMark({ className }: { className: string }) {
  return (
    <span
      className={`${className} inline-flex items-center justify-center font-bold leading-none text-primary`}
      aria-hidden="true"
    >
      A
    </span>
  );
}

export default function ChatClient({ canManageSettings }: { canManageSettings: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState(false);
  const [pageLoadingIndex, setPageLoadingIndex] = useState<number | null>(null);
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    if (selectedProvider === 'cloudflare' && !isCloudflareAIModel(normalizedModel)) {
      setSettingsError('ID model Cloudflare tidak valid. Gunakan format @cf/provider/model atau provider/model.');
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
      setSettingsOpen(false);
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
    if (historyLoading || sending || pageLoadingIndex !== null || clearingHistory) return;

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
      if (textareaRef.current) textareaRef.current.style.height = '40px';
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

  async function appendAssistantMessage(
    content: string,
    userHistorySaved: boolean,
    alreadyDisplayed = false,
    pendingLearning: ChatPendingLearning | null = null,
  ) {
    const assistantMessage: Message = { role: 'assistant', content };
    setMessages((current) => {
      if (!alreadyDisplayed) return [...current, assistantMessage];
      const lastIndex = current.length - 1;
      if (current[lastIndex]?.role !== 'assistant') return [...current, assistantMessage];
      return [...current.slice(0, lastIndex), assistantMessage];
    });
    if (!userHistorySaved) {
      setHistoryError('Jawaban diterima, tetapi riwayat chat tidak dapat disimpan.');
    } else {
      try {
        await saveHistory([assistantMessage]);
        setHistoryError('');
      } catch {
        setHistoryError('Jawaban diterima, tetapi riwayat chat tidak dapat disimpan.');
      }
    }

    const learningAction = getChatLearningAction(content);
    if (pendingLearning && learningAction?.action === 'learn') {
      try {
        const response = await fetch('/api/chat/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: learningAction.content }),
        });
        const data: unknown = await readResponseData(response);
        if (!response.ok) throw new Error(getResponseError(data, 'Pemahaman Rexxaa gagal disimpan.'));
      } catch (error) {
        setHistoryError(error instanceof TypeError
          ? 'Jawaban diterima, tetapi pemahaman Rexxaa belum tersimpan.'
          : error instanceof Error ? error.message : 'Pemahaman Rexxaa gagal disimpan.');
      }
    }
  }

  async function loadTablePage(
    messageIndex: number,
    pagination: ChatTablePageMetadata,
    page: number,
  ) {
    if (page < 1 || pageLoadingIndex !== null || sending) return;
    const originalContent = messages[messageIndex]?.content;
    if (!originalContent || messages[messageIndex]?.role !== 'assistant') return;

    setPageLoadingIndex(messageIndex);
    setChatError('');
    let hasStartedStreaming = false;
    let streamedAnswer = '';
    try {
      const contextResponse = await fetch(
        `/api/chat/context?question=${encodeURIComponent(pagination.question)}&source=${pagination.source}&page=${page}`,
        { cache: 'no-store' },
      );
      const pageContext: unknown = await readResponseData(contextResponse);
      if (!contextResponse.ok) throw new Error(getResponseError(pageContext, 'Halaman tabel gagal dimuat.'));
      if (
        typeof pageContext !== 'object' || pageContext === null || Array.isArray(pageContext)
        || !('data' in pageContext) || !('pagination' in pageContext)
        || !isChatTablePageMetadata(pageContext.pagination)
      ) throw new Error('Respons halaman tabel dari server tidak valid.');

      const pageMetadata = pageContext.pagination;
      const data = pageContext.data;
      let answer = getStructuredChatReply(pageContext);
      if (!answer) {
        if (!config) throw new Error('Pengaturan AI belum tersedia.');
        const activeConfig = config;
        const pageQuestion = [
          `Tampilkan hanya baris data pada halaman ${page} dari tabel untuk pertanyaan berikut.`,
          'Gunakan tabel Markdown dengan judul kolom yang sesuai, tampilkan setiap data yang diberikan tepat satu kali, dan jangan mengarang atau mengulang baris dari halaman lain.',
          `Pertanyaan awal: ${pagination.question}`,
        ].join('\n');
        const requestBody = buildChatRequestBody(
          activeConfig.model,
          pageQuestion,
          data,
          activeConfig.provider,
          messages.slice(0, messageIndex),
        );
        async function sendPageCompletion(streaming: boolean) {
          return fetch('/api/chat/completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              streaming,
              requestBody: {
                ...requestBody,
                ...(streaming && activeConfig.provider !== 'gemini' ? { stream: true } : {}),
              },
            }),
          });
        }

        let response = await sendPageCompletion(true);
        if (!response.ok) {
          const errorData = await readResponseData(response);
          if (!isChatStreamingRejectionStatus(response.status)) {
            throw new Error(getResponseError(errorData, 'Penyedia AI menolak permintaan.'));
          }
          response = await sendPageCompletion(false);
          if (!response.ok) {
            const errorData = await readResponseData(response);
            throw new Error(getResponseError(errorData, 'Penyedia AI menolak permintaan.'));
          }
        }

        if (response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
          answer = await readChatCompletionStream(response, activeConfig.provider, '', (delta) => {
            streamedAnswer += delta;
            hasStartedStreaming = true;
            setMessages((current) => current.map((message, index) =>
              index === messageIndex ? { ...message, content: streamedAnswer } : message));
          });
        } else {
          const responseData = await readResponseData(response);
          answer = getChatResponseContent(responseData, activeConfig.provider);
        }
      }

      if (!answer) throw new Error('Penyedia AI mengirim jawaban kosong atau tidak dikenal.');
      const answerWithPagination = attachChatTablePagination(answer, pageMetadata);
      setMessages((current) => current.map((message, index) =>
        index === messageIndex ? { ...message, content: answerWithPagination } : message));
    } catch (error) {
      if (hasStartedStreaming) {
        setMessages((current) => current.map((message, index) =>
          index === messageIndex ? { ...message, content: originalContent } : message));
      }
      setChatError(error instanceof TypeError
        ? 'Tidak dapat memuat halaman tabel. Periksa koneksi lalu coba lagi.'
        : error instanceof Error ? error.message : 'Halaman tabel gagal dimuat.');
    } finally {
      setPageLoadingIndex(null);
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
    if (!apiKey && !(config && config.provider === provider && config.hasApiKey && config.baseURL === normalizedBaseURL)) {
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
    if (!trimmed || sending || pageLoadingIndex !== null || historyLoading || !configLoaded || !config) return;
    const activeConfig = config;
    const lastMessage = messages.at(-1);
    const previousQuestion = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
    const newCustomerQuestion = getChatNewCustomerFollowUpQuestion(trimmed, previousQuestion);
    const questionForProcessing = getChatBillingFollowUpQuestion(newCustomerQuestion, previousQuestion);
    const contextQuestion = getChatContextFollowUpQuestion(trimmed, messages);
    const pendingLearning = lastMessage?.role === 'assistant'
      ? getPendingChatLearning(lastMessage.content, contextQuestion)
      : null;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '40px';
    setChatError('');
    setSending(true);
    setStreamingResponse(false);
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

      const greetingReply = getChatGreetingReply(trimmed);
      if (greetingReply) {
        await appendAssistantMessage(greetingReply, userHistorySaved);
        return;
      }

      const topics = pendingLearning ? [] : getChatContextTopics(contextQuestion);
      const searchTheWeb = shouldSearchChatWeb(trimmed, topics.length > 0, Boolean(pendingLearning));
      const searchImages = shouldSearchChatImages(trimmed, topics.length > 0, Boolean(pendingLearning));
      let context: unknown = null;
      let tablePagination: ChatTablePageMetadata | null = null;
      if (topics.length > 0) {
        const contextResponse = await fetch(`/api/chat/context?question=${encodeURIComponent(contextQuestion)}`, {
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
        if (
          typeof contextData === 'object' && contextData !== null && !Array.isArray(contextData)
          && 'pagination' in contextData && isChatTablePageMetadata(contextData.pagination)
        ) tablePagination = contextData.pagination;
        const structuredReply = getStructuredChatReply(contextData);
        if (structuredReply) {
          await appendAssistantMessage(
            attachChatTablePagination(structuredReply, tablePagination),
            userHistorySaved,
          );
          return;
        }
        context = typeof contextData === 'object' && contextData !== null && 'data' in contextData
          ? contextData.data
          : null;
      }

      requestingProvider = true;
      const baseRequestBody = buildChatRequestBody(
        activeConfig.model,
        questionForProcessing,
        context,
        activeConfig.provider,
        messages,
        pendingLearning,
      );
      async function sendCompletion(streaming: boolean) {
        const requestBody = {
          ...baseRequestBody,
          ...(streaming && activeConfig.provider !== 'gemini' ? { stream: true } : {}),
        };
        return fetch('/api/chat/completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streaming,
            requestBody,
            webSearch: searchTheWeb,
            imageSearch: searchImages,
          }),
        });
      }

      setSearchingWeb(searchTheWeb || searchImages);
      let response = await sendCompletion(true);
      setSearchingWeb(false);
      if (!response.ok) {
        const responseData = await readResponseData(response);
        if (!isChatStreamingRejectionStatus(response.status)) {
          throw new Error(getResponseError(responseData, 'Penyedia AI menolak permintaan.'));
        }

        setSearchingWeb(searchTheWeb || searchImages);
        response = await sendCompletion(false);
        setSearchingWeb(false);
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
          setStreamingResponse(true);
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
      const answerWithWebSources = appendChatWebSources(answer, getChatWebSources(response));
      const answerWithImages = appendChatWebImageMetadata(answerWithWebSources, getChatWebImages(response));
      await appendAssistantMessage(
        attachChatTablePagination(answerWithImages, tablePagination),
        userHistorySaved,
        streamedMessageVisible,
        pendingLearning,
      );
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
      setSearchingWeb(false);
      setStreamingResponse(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(input);
  }

  const canSend = Boolean(config) && configLoaded && !historyLoading
    && !sending && pageLoadingIndex === null && Boolean(input.trim());

  return (
    <main
      data-chat-page="true"
      className="app-page mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-4 overflow-hidden"
    >
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ChatSignal active={sending} className="size-10" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-6">Rexxaa</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 gap-2 sm:w-auto sm:px-3"
            aria-label="Hapus percakapan"
            title="Hapus percakapan"
            disabled={messages.length === 0 || historyLoading || sending || pageLoadingIndex !== null || clearingHistory}
            onClick={() => setClearHistoryOpen(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Hapus</span>
          </Button>
          {canManageSettings && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 gap-2 sm:w-auto sm:px-3"
              aria-label="Buka pengaturan AI"
              title="Pengaturan AI"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Pengaturan</span>
            </Button>
          )}
        </div>
      </header>
      {canManageSettings && (
        <ChatSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSubmit={saveSettings}
          selectedProvider={selectedProvider}
          chooseProvider={chooseProvider}
          cloudflareAccountID={cloudflareAccountID}
          setCloudflareAccountID={setCloudflareAccountID}
          baseURL={baseURL}
          setBaseURL={setBaseURL}
          apiKeyInput={apiKeyInput}
          setApiKeyInput={setApiKeyInput}
          availableModels={availableModels}
          setAvailableModels={setAvailableModels}
          loadingModels={loadingModels}
          loadModels={() => void loadModels()}
          modelsError={modelsError}
          setModelsError={setModelsError}
          model={model}
          setModel={setModel}
          settingsError={settingsError}
          settingsSaved={settingsSaved}
          setSettingsSaved={setSettingsSaved}
          config={config}
          clearSettings={() => void clearSettings()}
        />
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="relative flex min-h-0 flex-1">
          <section
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-7"
            aria-label="Percakapan"
            aria-live="polite"
          >
            <AnimatePresence initial={false}>
                  {messages.map((message, index) => (
                    <motion.article
                      key={`${index}-${message.role}`}
                      initial={prefersReducedMotion ? false : {
                        opacity: 0,
                        x: message.role === 'user' ? 8 : -8,
                        scale: 0.985,
                      }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' ? (
                    <>
                      <RexxaaMark className="mt-1 size-7 shrink-0 rounded-full border border-border text-xs" />
                      <div className="min-w-0 max-w-[min(90%,48rem)] space-y-1">
                        <p className="px-1 text-xs font-medium text-muted-foreground">Rexxaa</p>
                        <div className="min-w-0 rounded-md bg-muted px-4 py-3 text-sm leading-6 text-foreground">
                          {renderChatMessage(
                            message.content,
                            (page) => {
                              const pagination = getChatTablePageMetadata(message.content);
                              if (pagination) void loadTablePage(index, pagination, page);
                            },
                            pageLoadingIndex === index || sending,
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="max-w-[min(88%,42rem)] rounded-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  )}
                </motion.article>
              ))}
            </AnimatePresence>

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

            {sending && !streamingResponse && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
                <RexxaaMark className="size-7 shrink-0 rounded-full border border-border text-xs" />
                <span>{searchingWeb ? 'Mencari di internet…' : 'bentarrr yaaawww'}</span>
                <span className="flex items-center gap-1" aria-hidden="true">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="size-1 rounded-full bg-primary"
                      animate={prefersReducedMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.16 }}
                    />
                  ))}
                </span>
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
              className="absolute bottom-3 left-1/2 z-10 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-all duration-150 hover:bg-muted motion-safe:active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Gulir ke pesan terbaru"
              title="Gulir ke pesan terbaru"
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="shrink-0 border-t border-border bg-card p-3 sm:p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-md border border-input bg-background p-2 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                event.target.style.height = 'auto';
                event.target.style.height = `${Math.min(event.target.scrollHeight, 128)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submitQuestion(input);
                }
              }}
              aria-label="Tulis pertanyaan untuk Rexxaa"
              placeholder="Tulis pertanyaan…"
              rows={1}
              maxLength={500}
              required
              disabled={sending || historyLoading || !configLoaded || !config}
              className="min-w-0 max-h-32 min-h-10 flex-1 resize-none border-0 px-2 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Kirim pertanyaan"
              disabled={!canSend}
              className="size-10 shrink-0 bg-foreground text-background hover:bg-foreground/90"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between gap-3 px-1">
            <p className="text-xs leading-5 text-muted-foreground">
              Pertanyaan informasi umum otomatis dicari di internet dan disertai sumber.
            </p>
            {configLoaded && !config && (
              <p className="text-xs leading-5 text-muted-foreground">
                Pengaturan AI belum tersedia. Hubungi superadmin.
              </p>
            )}
          </div>
        </form>
      </section>
      <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <AlertDialogContent className="chat-clear-dialog rounded-2xl">
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
