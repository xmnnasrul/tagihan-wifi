import { normalizeChatSearchText } from './customer-matching.ts';
import { getChatContextTopics } from './replies.ts';

export interface ChatPendingLearning {
  term: string;
  question: string;
}

export type ChatLearningAction =
  | { action: 'clarify'; term: string; question: string }
  | { action: 'learn'; content: string };

const CHAT_LEARNING_MARKER_START = '<!--REXXAA_MEMORY:';
const CHAT_LEARNING_MARKER_PATTERN = /<!--REXXAA_MEMORY:(\{[\s\S]*?\})-->/gu;

export function getChatLearningAction(content: string): ChatLearningAction | null {
  const markers = [...content.matchAll(CHAT_LEARNING_MARKER_PATTERN)];
  const marker = markers.at(-1)?.[1];
  if (!marker) return null;

  try {
    const value: unknown = JSON.parse(marker);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    if (
      'action' in value && value.action === 'clarify'
      && 'term' in value && typeof value.term === 'string'
      && 'question' in value && typeof value.question === 'string'
    ) {
      const term = value.term.trim();
      const question = value.question.trim();
      return term.length > 0 && term.length <= 120 && question.length > 0 && question.length <= 300
        ? { action: 'clarify', term, question }
        : null;
    }
    if ('action' in value && value.action === 'learn' && 'content' in value && typeof value.content === 'string') {
      const learnedContent = value.content.trim();
      return learnedContent.length > 0 && learnedContent.length <= 1500
        ? { action: 'learn', content: learnedContent }
        : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function getPendingChatLearning(content: string, question: string): ChatPendingLearning | null {
  const action = getChatLearningAction(content);
  const asksForWebsiteData = getChatContextTopics(question).length > 0
    && /\b(?:siapa|daftar|semua|seluruh|tampilkan|lihat|cari|cek|periksa|detail|berapa|jumlah|total)\b/iu
      .test(normalizeChatSearchText(question));
  if (action?.action !== 'clarify' || asksForWebsiteData) return null;
  return { term: action.term, question: action.question };
}

export function getVisibleChatAnswer(content: string): string {
  const markerIndex = content.indexOf(CHAT_LEARNING_MARKER_START);
  const visible = markerIndex >= 0
    ? content.slice(0, markerIndex)
    : content;
  return visible
    .replace(/\s*<!--CHAT_TABLE_PAGE:[^>]+-->/gu, '')
    .replace(/\s*<!--CHAT_WEB_IMAGES:[^>]+-->/gu, '')
    .trimEnd();
}
