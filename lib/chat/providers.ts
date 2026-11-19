export interface ChatOutstandingPeriod {
  month: string;
  year: number;
  outstandingAmount: number;
  status: 'Belum Bayar' | 'Nyicil';
}

export interface ChatArrearsCustomer {
  customerName: string;
  totalOutstanding: number;
  outstandingPeriods: ChatOutstandingPeriod[];
}

export interface ChatAIConfig {
  provider: ChatAIProvider;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ChatAISettings {
  provider: ChatAIProvider;
  baseURL: string;
  model: string;
  hasApiKey: boolean;
}

export interface ChatConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatAIProvider = 'custom' | 'openai' | 'codex' | 'openrouter' | 'gemini' | 'anthropic' | 'cloudflare';

export const CHAT_AI_PROVIDERS: Array<{ id: ChatAIProvider; label: string }> = [
  { id: 'custom', label: 'Custom API' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'codex', label: 'Codex' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'cloudflare', label: 'Cloudflare AI' },
];

const providerBaseURLs: Record<ChatAIProvider, string> = {
  custom: '',
  openai: 'https://api.openai.com/v1',
  codex: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  anthropic: 'https://api.anthropic.com/v1',
  cloudflare: '',
};

export function isChatAIProvider(value: unknown): value is ChatAIProvider {
  return CHAT_AI_PROVIDERS.some((provider) => provider.id === value);
}

export function getChatProviderBaseURL(provider: ChatAIProvider): string {
  return providerBaseURLs[provider];
}

export function normalizeCloudflareAccountID(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const accountID = value.trim();
  return /^[a-f0-9]{32}$/iu.test(accountID) ? accountID.toLowerCase() : null;
}

export function getCloudflareWorkersAIBaseURL(accountID: unknown): string | null {
  const normalizedAccountID = normalizeCloudflareAccountID(accountID);
  return normalizedAccountID
    ? `https://api.cloudflare.com/client/v4/accounts/${normalizedAccountID}/ai/v1`
    : null;
}

export function getCloudflareAccountIDFromBaseURL(baseURL: unknown): string | null {
  if (typeof baseURL !== 'string') return null;
  const match = baseURL.match(/^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/([a-f0-9]{32})\/ai\/v1\/?$/iu);
  return match ? normalizeCloudflareAccountID(match[1]) : null;
}

export function normalizeCloudflareWorkersAIBaseURL(value: unknown): string | null {
  const accountID = getCloudflareAccountIDFromBaseURL(value);
  return accountID ? getCloudflareWorkersAIBaseURL(accountID) : null;
}

export function isCloudflareWorkersAIModel(value: unknown): value is string {
  return typeof value === 'string' && /^@cf\/[a-z0-9._-]+\/[a-z0-9._/-]+$/iu.test(value.trim());
}

export function isCloudflareAIModel(value: unknown): value is string {
  return isCloudflareWorkersAIModel(value)
    || (typeof value === 'string' && /^[a-z0-9._-]+\/[a-z0-9._-]+(?:\/[a-z0-9._-]+)*$/iu.test(value.trim()));
}

export function parseChatArrearsCustomers(value: unknown): ChatArrearsCustomer[] | null {
  if (!Array.isArray(value)) return null;

  const isPeriod = (period: unknown): period is ChatOutstandingPeriod => {
    if (typeof period !== 'object' || period === null || Array.isArray(period)) return false;
    const candidate = period as Record<string, unknown>;
    return typeof candidate.month === 'string'
      && typeof candidate.year === 'number' && Number.isInteger(candidate.year)
      && typeof candidate.outstandingAmount === 'number' && Number.isFinite(candidate.outstandingAmount)
      && candidate.outstandingAmount >= 0
      && (candidate.status === 'Belum Bayar' || candidate.status === 'Nyicil');
  };
  const isCustomer = (customer: unknown): customer is ChatArrearsCustomer => {
    if (typeof customer !== 'object' || customer === null || Array.isArray(customer)) return false;
    const candidate = customer as Record<string, unknown>;
    return typeof candidate.customerName === 'string'
      && typeof candidate.totalOutstanding === 'number' && Number.isFinite(candidate.totalOutstanding)
      && candidate.totalOutstanding >= 0
      && Array.isArray(candidate.outstandingPeriods)
      && candidate.outstandingPeriods.every(isPeriod);
  };

  if (!value.every(isCustomer)) return null;

  return value.map(({ customerName, totalOutstanding, outstandingPeriods }) => ({
    customerName,
    totalOutstanding,
    outstandingPeriods: outstandingPeriods.map(({ month, year, outstandingAmount, status }) => ({
      month,
      year,
      outstandingAmount,
      status,
    })),
  }));
}

export const AI_CONFIG_STORAGE_KEY = 'tagihan-wifi.chat-ai-config';

export const DEFAULT_CHAT_AI_CONFIG = {
  provider: 'custom' as const,
  baseURL: '',
  model: 'openai/gpt-6-luna',
};

export function normalizeChatBaseURL(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;

  try {
    const parsed = new URL(value.trim());
    const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
    const isHTTPS = parsed.protocol === 'https:';
    const isLocalHTTP = parsed.protocol === 'http:' && localHosts.has(parsed.hostname);
    if ((!isHTTPS && !isLocalHTTP) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;

    const path = parsed.pathname.replace(/\/+$/, '');
    const normalized = `${parsed.origin}${path}`;
    return normalized === 'https://vikey.ai/v1' ? 'https://api.vikey.ai/v1' : normalized;
  } catch {
    return null;
  }
}

export function normalizeChatModel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const model = value.trim();
  return model.length > 0 && model.length <= 120 ? model : null;
}

export function normalizeChatAIConfig(value: unknown): ChatAIConfig | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  const provider = candidate.provider === undefined
    ? 'custom'
    : isChatAIProvider(candidate.provider) ? candidate.provider : null;
  if (!provider) return null;
  const baseURL = provider === 'custom'
    ? normalizeChatBaseURL(candidate.baseURL)
    : provider === 'cloudflare'
      ? normalizeCloudflareWorkersAIBaseURL(candidate.baseURL)
    : getChatProviderBaseURL(provider);
  const apiKey = typeof candidate.apiKey === 'string' ? candidate.apiKey.trim() : '';
  const model = normalizeChatModel(candidate.model);
  if (
    !baseURL || !apiKey || apiKey.length > 500 || !model
    || (provider === 'cloudflare' && !isCloudflareAIModel(model))
  ) return null;

  return { provider, baseURL, apiKey, model };
}

function getProviderURL(baseURL: string, provider: ChatAIProvider) {
  const normalized = provider === 'custom'
    ? normalizeChatBaseURL(baseURL)
    : provider === 'cloudflare'
      ? normalizeCloudflareWorkersAIBaseURL(baseURL)
    : getChatProviderBaseURL(provider);
  if (!normalized) throw new Error('Base URL penyedia AI tidak valid.');
  return normalized;
}

export function getChatCompletionEndpoint(
  baseURL: string,
  provider: ChatAIProvider = 'custom',
  model?: string,
): string {
  const normalized = getProviderURL(baseURL, provider);
  if (provider === 'codex') return `${normalized}/responses`;
  if (provider === 'gemini') {
    if (!model) throw new Error('Model Gemini wajib dipilih.');
    return `${normalized}/models/${encodeURIComponent(model)}:generateContent`;
  }
  if (provider === 'anthropic') return `${normalized}/messages`;
  return `${normalized}/chat/completions`;
}

export function getChatStreamingEndpoint(
  baseURL: string,
  provider: ChatAIProvider = 'custom',
  model?: string,
): string {
  if (provider === 'gemini') {
    const normalized = getProviderURL(baseURL, provider);
    if (!model) throw new Error('Model Gemini wajib dipilih.');
    return `${normalized}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  }
  return getChatCompletionEndpoint(baseURL, provider, model);
}

export function isChatStreamingRejectionStatus(status: number): boolean {
  return [400, 404, 405, 422, 501].includes(status);
}

export function getChatModelsEndpoint(baseURL: string, provider: ChatAIProvider = 'custom'): string {
  return `${getProviderURL(baseURL, provider)}/models`;
}

export function getChatRequestHeaders(
  provider: ChatAIProvider,
  apiKey: string,
  model?: string,
): Record<string, string> {
  if (provider === 'gemini') return { 'x-goog-api-key': apiKey };
  if (provider === 'anthropic') {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  }
  if (provider === 'cloudflare') return {
    Authorization: `Bearer ${apiKey}`,
    ...(isCloudflareWorkersAIModel(model) ? { 'cf-aig-gateway-id': 'default' } : {}),
  };
  return { Authorization: `Bearer ${apiKey}` };
}

export function getChatModelIDs(value: unknown, provider: ChatAIProvider = 'custom'): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  const source = provider === 'gemini'
    ? 'models' in value && Array.isArray(value.models) ? value.models : []
    : 'data' in value && Array.isArray(value.data) ? value.data : [];
  const modelIDs = source.flatMap((model) => {
    if (typeof model !== 'object' || model === null || Array.isArray(model) || !('id' in model)) return [];
    return typeof model.id === 'string' && model.id.trim() ? [model.id.trim()] : [];
  });
  const geminiModelIDs = provider === 'gemini'
    ? source.flatMap((model) => {
        if (
          typeof model !== 'object' || model === null || Array.isArray(model)
          || !('name' in model) || typeof model.name !== 'string'
        ) return [];
        if (
          'supportedGenerationMethods' in model
          && Array.isArray(model.supportedGenerationMethods)
          && !model.supportedGenerationMethods.includes('generateContent')
        ) return [];
        return [model.name.replace(/^models\//u, '')];
      })
    : modelIDs;
  const compatibleModelIDs = provider === 'codex'
    ? geminiModelIDs.filter((modelID) => modelID.toLocaleLowerCase().includes('codex'))
    : geminiModelIDs;
  return [...new Set(compatibleModelIDs)];
}
