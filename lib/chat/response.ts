import { CHAT_AI_PROVIDERS } from './providers.ts';
import type { ChatAIProvider } from './providers.ts';

function getChatProviderName(provider: ChatAIProvider): string {
  return CHAT_AI_PROVIDERS.find(({ id }) => id === provider)?.label || 'penyedia AI';
}

export function getChatAPIErrorMessage(
  status: number,
  responseBody?: unknown,
  apiKey?: string,
  provider: ChatAIProvider = 'custom',
): string {
  const providerName = getChatProviderName(provider);
  const body = typeof responseBody === 'object' && responseBody !== null && !Array.isArray(responseBody)
    ? responseBody as Record<string, unknown>
    : null;
  const providerError = body?.error;
  const errorList = body?.errors;
  const providerErrors = Array.isArray(errorList)
    ? errorList.flatMap((error) => {
        if (typeof error === 'string') return [error];
        if (
          typeof error === 'object' && error !== null && !Array.isArray(error)
          && 'message' in error && typeof error.message === 'string'
        ) return [error.message];
        return [];
      }).join('; ')
    : null;
  const providerMessage = typeof providerError === 'object' && providerError !== null
    && !Array.isArray(providerError) && 'message' in providerError
    && typeof providerError.message === 'string'
    ? providerError.message
    : providerErrors
      ? providerErrors
    : typeof body?.message === 'string'
      ? body.message
      : typeof body?.detail === 'string'
        ? body.detail
        : typeof body?.error_description === 'string'
          ? body.error_description
          : typeof providerError === 'string'
            ? providerError
            : typeof responseBody === 'string' ? responseBody : null;
  const isCapacityError = Boolean(providerMessage && /all replicas at capacity|at capacity|overloaded/iu.test(providerMessage));
  const isPlanRestrictedModel = Boolean(
    providerMessage && /not available on the Workers Free plan|upgrade to access this model/iu.test(providerMessage),
  );
  let summary: string;
  if (isPlanRestrictedModel) {
    summary = 'Model ini tidak tersedia pada Workers Free plan. Pilih model yang tersedia di paket gratis atau upgrade paket Cloudflare.';
  } else if (isCapacityError) {
    summary = 'Endpoint AI sedang sibuk karena semua replika model penuh. Coba lagi nanti atau pilih model lain.';
  } else if (status === 401 || status === 403) {
    summary = `API Key${provider === 'custom' ? '' : ` ${providerName}`} ditolak atau tidak memiliki izin. Periksa API Key dan akses akun.`;
  } else if (status === 402) {
    summary = `Permintaan ${providerName} memerlukan billing atau pembayaran aktif. Periksa billing, saldo/batas penggunaan, dan akses model pada akun yang terhubung.`;
  } else if (status === 429) {
    summary = `Kuota atau batas permintaan ${providerName} tercapai. Periksa saldo dan pemakaian akun.`;
  } else if (status === 400) {
    summary = 'Penyedia AI menolak format permintaan. Periksa model dan parameter yang didukung.';
  } else if (status === 404) {
    summary = 'Model atau alamat API tidak ditemukan. Periksa Base URL dan model yang dipilih.';
  } else if (status >= 500) {
    summary = `${providerName} sedang bermasalah. Coba lagi beberapa saat.`;
  } else {
    summary = `Permintaan ke ${providerName} gagal (HTTP ${status}).`;
  }

  if (!providerMessage) return summary;

  const safeMessage = providerMessage
    .replace(/\s+/g, ' ')
    .slice(0, 300)
    .split(apiKey || '\u0000')
    .join('[API Key disamarkan]');
  const requestID = typeof body?.request_id === 'string'
    ? body.request_id
    : typeof body?.requestId === 'string' ? body.requestId : null;
  const safeRequestID = requestID
    ? requestID.replace(/\s+/g, ' ').slice(0, 100).split(apiKey || '\u0000').join('[API Key disamarkan]')
    : null;
  return `${summary} Detail: ${safeMessage}${safeRequestID ? ` (request ID: ${safeRequestID})` : ''}`;
}

export function removeChatEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0E\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/gu, '')
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/[ \t]+([,.;!?])/gu, '$1');
}

function extractChatResponseContent(value: unknown, provider: ChatAIProvider): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  if (provider === 'codex') {
    if ('output_text' in value && typeof value.output_text === 'string' && value.output_text.trim()) {
      return value.output_text.trim();
    }
    if (!('output' in value) || !Array.isArray(value.output)) return null;
    const text = value.output.flatMap((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item) || !('content' in item) || !Array.isArray(item.content)) {
        return [];
      }
      return item.content.flatMap((part: unknown) =>
        typeof part === 'object' && part !== null && !Array.isArray(part)
        && 'text' in part && typeof part.text === 'string' ? [part.text] : []);
    }).join('').trim();
    return text || null;
  }
  if (provider === 'gemini') {
    if (!('candidates' in value) || !Array.isArray(value.candidates)) return null;
    const candidate: unknown = value.candidates[0];
    if (typeof candidate !== 'object' || candidate === null || !('content' in candidate)) return null;
    const content: unknown = candidate.content;
    if (typeof content !== 'object' || content === null || !('parts' in content) || !Array.isArray(content.parts)) return null;
    const text = content.parts.flatMap((part) =>
      typeof part === 'object' && part !== null && !Array.isArray(part)
      && 'text' in part && typeof part.text === 'string' ? [part.text] : []).join('').trim();
    return text || null;
  }
  if (provider === 'anthropic') {
    if (!('content' in value) || !Array.isArray(value.content)) return null;
    const text = value.content.flatMap((part) =>
      typeof part === 'object' && part !== null && !Array.isArray(part)
      && part.type === 'text' && 'text' in part && typeof part.text === 'string' ? [part.text] : []).join('').trim();
    return text || null;
  }
  if (typeof value !== 'object' || value === null || !('choices' in value) || !Array.isArray(value.choices)) return null;
  const firstChoice: unknown = value.choices[0];
  if (typeof firstChoice !== 'object' || firstChoice === null || !('message' in firstChoice)) return null;
  const message: unknown = firstChoice.message;
  if (typeof message !== 'object' || message === null || !('content' in message)) return null;
  const content = message.content;
  return typeof content === 'string' && content.trim() ? content.trim() : null;
}

export function getChatResponseContent(value: unknown, provider: ChatAIProvider = 'custom'): string | null {
  const content = extractChatResponseContent(value, provider);
  if (!content) return null;
  const cleanContent = removeChatEmoji(content).trim();
  return cleanContent || null;
}

function getStreamingTextDelta(value: unknown, provider: ChatAIProvider): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const candidate = value as Record<string, unknown>;

  if (provider === 'codex') {
    return candidate.type === 'response.output_text.delta' && typeof candidate.delta === 'string'
      ? candidate.delta
      : '';
  }

  if (provider === 'anthropic') {
    if (candidate.type !== 'content_block_delta' || typeof candidate.delta !== 'object' || candidate.delta === null) {
      return '';
    }
    const delta = candidate.delta as Record<string, unknown>;
    return delta.type === 'text_delta' && typeof delta.text === 'string' ? delta.text : '';
  }

  if (provider === 'gemini') {
    if (!Array.isArray(candidate.candidates)) return '';
    const firstCandidate = candidate.candidates[0];
    if (typeof firstCandidate !== 'object' || firstCandidate === null || Array.isArray(firstCandidate)) return '';
    const content = (firstCandidate as Record<string, unknown>).content;
    if (typeof content !== 'object' || content === null || Array.isArray(content)) return '';
    const parts = (content as Record<string, unknown>).parts;
    if (!Array.isArray(parts)) return '';
    return parts.flatMap((part) => {
      if (typeof part !== 'object' || part === null || Array.isArray(part)) return [];
      const text = (part as Record<string, unknown>).text;
      return typeof text === 'string' ? [text] : [];
    }).join('');
  }

  if (!Array.isArray(candidate.choices)) return '';
  const firstChoice = candidate.choices[0];
  if (typeof firstChoice !== 'object' || firstChoice === null || Array.isArray(firstChoice)) return '';
  const delta = (firstChoice as Record<string, unknown>).delta;
  if (typeof delta !== 'object' || delta === null || Array.isArray(delta)) return '';
  const content = (delta as Record<string, unknown>).content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.flatMap((part) => {
    if (typeof part !== 'object' || part === null || Array.isArray(part)) return [];
    const text = (part as Record<string, unknown>).text;
    return typeof text === 'string' ? [text] : [];
  }).join('');
}

export async function readChatCompletionStream(
  response: Response,
  provider: ChatAIProvider,
  apiKey: string,
  onText: (text: string) => void,
): Promise<string> {
  if (!response.body) throw new Error('Penyedia AI tidak mengirim aliran jawaban.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let finished = false;

  const processEvent = (event: string) => {
    const data = event.split(/\r?\n/u)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /u, ''))
      .join('\n');
    if (!data) return;
    if (data === '[DONE]') {
      finished = true;
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      throw new Error('Format aliran jawaban dari penyedia AI tidak valid.');
    }
    if (typeof payload === 'object' && payload !== null && 'error' in payload) {
      throw new Error(getChatAPIErrorMessage(response.status, payload, apiKey, provider));
    }

    const delta = getStreamingTextDelta(payload, provider);
    if (delta) {
      const cleanDelta = removeChatEmoji(delta);
      if (cleanDelta) {
        answer += cleanDelta;
        onText(cleanDelta);
      }
    }
  };

  try {
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.match(/\r?\n\r?\n/u);
      while (separator?.index !== undefined) {
        processEvent(buffer.slice(0, separator.index));
        buffer = buffer.slice(separator.index + separator[0].length);
        separator = buffer.match(/\r?\n\r?\n/u);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) processEvent(buffer);
  } finally {
    reader.releaseLock();
  }

  return answer.trim();
}
