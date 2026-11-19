import type { ChatAIProvider } from './providers.ts';

export const MAX_CHAT_KNOWLEDGE_SUMMARY_LENGTH = 80_000;

function getChatKnowledgeEntries(contents: readonly string[]): string[] {
  return contents
    .flatMap((content) => content.split(/\r?\n/u))
    .map((entry) => entry.trim().replace(/^[-*]\s*/u, ''))
    .filter(Boolean);
}

function getChatKnowledgeEntryKey(entry: string): string | null {
  const separator = entry.indexOf(':');
  if (separator <= 0 || separator > 80) return null;
  const key = entry.slice(0, separator).trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
  return key || null;
}

function getChatKnowledgeEntryIdentity(entry: string): string {
  const key = getChatKnowledgeEntryKey(entry);
  return key ? `key:${key}` : `entry:${entry.toLocaleLowerCase()}`;
}

export function mergeChatKnowledgeSummary(
  existingContents: readonly string[],
  newEntry: string,
  maxCharacters = MAX_CHAT_KNOWLEDGE_SUMMARY_LENGTH,
): string | null {
  const entries: string[] = [];
  const entryIndexes = new Map<string, number>();
  for (const entry of getChatKnowledgeEntries(existingContents)) {
    const identity = getChatKnowledgeEntryIdentity(entry);
    const existingIndex = entryIndexes.get(identity);
    if (existingIndex === undefined) {
      entryIndexes.set(identity, entries.length);
      entries.push(entry);
    } else {
      entries[existingIndex] = entry;
    }
  }

  const normalizedEntry = newEntry.trim()
    .replace(/\s+/gu, ' ')
    .replace(/^([^:]+)\s*:\s*/u, (_match, key: string) => `${key.trim()}: `);
  if (!normalizedEntry) return null;

  const identity = getChatKnowledgeEntryIdentity(normalizedEntry);
  const existingIndex = entryIndexes.get(identity);
  if (existingIndex !== undefined) entries[existingIndex] = normalizedEntry;
  else entries.push(normalizedEntry);

  const summary = entries.join('\n');
  return summary.length <= maxCharacters ? summary : null;
}

export function getChatPromptFromRequestBody(
  provider: ChatAIProvider,
  body: Record<string, unknown>,
): string {
  let prompt = '';
  if (provider === 'codex') {
    prompt = typeof body.input === 'string' ? body.input : '';
  } else if (provider === 'gemini') {
    if (Array.isArray(body.contents)) {
      for (const content of body.contents) {
        if (
          typeof content !== 'object' || content === null || Array.isArray(content)
          || !('role' in content) || content.role !== 'user'
          || !('parts' in content) || !Array.isArray(content.parts)
        ) continue;
        const textParts: string[] = [];
        for (const part of content.parts as unknown[]) {
          if (
            typeof part === 'object' && part !== null && !Array.isArray(part)
            && 'text' in part && typeof part.text === 'string'
          ) textParts.push(part.text);
        }
        prompt = textParts.join('\n');
      }
    }
  } else if (Array.isArray(body.messages)) {
    for (const message of body.messages) {
      if (
        typeof message === 'object' && message !== null && !Array.isArray(message)
        && 'role' in message && message.role === 'user'
        && 'content' in message && typeof message.content === 'string'
      ) prompt = message.content;
    }
  }

  const questionMatch = prompt.match(/(?:^|\n)Pertanyaan admin:\n([\s\S]*)$/u);
  const clarificationTermMatch = prompt.match(/KONTEKS KLARIFIKASI INTERNAL:[\s\S]*?tentang "([^"]+)"/u);
  return [questionMatch?.[1] || prompt, clarificationTermMatch?.[1] || ''].join(' ');
}

const chatKnowledgeStopWords = new Set([
  'agar', 'aja', 'akan', 'atau', 'bagaimana', 'baik', 'bisa', 'buat', 'dan', 'dari',
  'dengan', 'di', 'dong', 'gimana', 'ini', 'itu', 'jadi', 'jangan', 'juga', 'kalau',
  'karena', 'ke', 'kita', 'kok', 'lagi', 'lebih', 'mau', 'memang', 'mohon', 'nya',
  'oleh', 'pada', 'pakai', 'saat', 'saja', 'saya', 'sebagai', 'sekarang', 'serta',
  'sih', 'sudah', 'tadi', 'tentang', 'tersebut', 'tidak', 'untuk', 'yang', 'the',
  'with', 'from', 'this', 'that', 'what', 'when', 'where', 'which', 'your', 'please',
]);

function getChatKnowledgeTerms(value: string): Set<string> {
  return new Set(
    value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter((term) => !chatKnowledgeStopWords.has(term)) || [],
  );
}

export function selectRelevantChatKnowledge(
  prompt: string,
  knowledge: readonly string[],
  maxItems = 4,
  minRelevance = 0.25,
): string[] {
  const promptTerms = getChatKnowledgeTerms(prompt);
  if (promptTerms.size === 0) return [];

  return getChatKnowledgeEntries(knowledge)
    .map((content, index) => {
      const knowledgeTerms = getChatKnowledgeTerms(content);
      let overlap = 0;
      for (const term of promptTerms) {
        if (knowledgeTerms.has(term)) overlap += 1;
      }
      return {
        content,
        index,
        score: overlap / Math.min(promptTerms.size, knowledgeTerms.size || 1),
      };
    })
    .filter(({ score }) => score >= minRelevance)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, maxItems)
    .map(({ content }) => content);
}
