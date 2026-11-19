import type { ChatAIProvider, ChatConversationMessage } from './providers.ts';
import { buildGroundedMessages } from './replies.ts';
import { getVisibleChatAnswer } from './learning.ts';
import type { ChatPendingLearning } from './learning.ts';
import { getChatPromptFromRequestBody, selectRelevantChatKnowledge } from './knowledge.ts';

export function getRecentChatHistory(history: readonly ChatConversationMessage[]): ChatConversationMessage[] {
  const maxMessages = 8;
  const maxCharacters = 6000;
  const maxCharactersPerMessage = 2000;
  let remainingCharacters = maxCharacters;
  const recentMessages: ChatConversationMessage[] = [];

  for (const message of history.slice(-maxMessages).reverse()) {
    const content = getVisibleChatAnswer(message.content).trim();
    const includedContent = content.slice(0, Math.min(maxCharactersPerMessage, remainingCharacters));
    if (!includedContent) break;
    recentMessages.push({ role: message.role, content: includedContent });
    remainingCharacters -= includedContent.length;
    if (remainingCharacters === 0) break;
  }

  const chronologicalMessages = recentMessages.reverse();
  const firstUserMessage = chronologicalMessages.findIndex(({ role }) => role === 'user');
  return firstUserMessage < 0 ? [] : chronologicalMessages.slice(firstUserMessage);
}

export function buildChatRequestBody(
  model: string,
  question: string,
  context: unknown | null,
  provider: ChatAIProvider = 'custom',
  history: readonly ChatConversationMessage[] = [],
  pendingLearning: ChatPendingLearning | null = null,
) {
  const asksForList = /\b(?:siapa|daftar|semua|seluruh)\b/u.test(question.toLocaleLowerCase());
  const countContextItems = (value: unknown): number => {
    if (Array.isArray(value)) return value.length + value.reduce((sum, item) => sum + countContextItems(item), 0);
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).reduce((sum, item) => sum + countContextItems(item), 0);
    }
    return 0;
  };
  const contextCount = countContextItems(context);
  const maxTokens = asksForList && contextCount > 0
    ? Math.min(2048, Math.max(512, contextCount * 32))
    : 512;
  const messages = buildGroundedMessages(question, context, history, pendingLearning);
  const system = messages[0].content;
  const conversation = messages.slice(1);

  if (provider === 'codex') {
    return {
      model,
      instructions: system,
      input: conversation.map(({ role, content }) =>
        `${role === 'assistant' ? 'Alfii' : 'Pengguna'}:\n${content}`).join('\n\n'),
      max_output_tokens: maxTokens,
    };
  }
  if (provider === 'gemini') {
    return {
      systemInstruction: { parts: [{ text: system }] },
      contents: conversation.map(({ role, content }) => ({
        role: role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }],
      })),
      generationConfig: { temperature: 0.0, maxOutputTokens: maxTokens },
    };
  }
  if (provider === 'anthropic') {
    return {
      model,
      system,
      messages: conversation,
      temperature: 0.0,
      max_tokens: maxTokens,
    };
  }
  return {
    model,
    messages,
    temperature: 0.0,
    max_tokens: maxTokens,
  };
}

export function addChatKnowledgeToRequestBody(
  provider: ChatAIProvider,
  requestBody: unknown,
  knowledge: readonly string[],
): Record<string, unknown> {
  if (typeof requestBody !== 'object' || requestBody === null || Array.isArray(requestBody)) {
    throw new Error('Format permintaan AI tidak valid untuk menyisipkan pengetahuan admin.');
  }
  const body = requestBody as Record<string, unknown>;
  const prompt = getChatPromptFromRequestBody(provider, body);
  const relevantKnowledge = selectRelevantChatKnowledge(prompt, knowledge);
  const notes: string[] = [];
  let remainingCharacters = 1200;
  for (const value of relevantKnowledge) {
    const note = value.trim();
    if (!note || remainingCharacters <= 0) continue;
    const formatted = `- ${note}`;
    if (formatted.length > remainingCharacters) continue;
    notes.push(formatted);
    remainingCharacters -= formatted.length;
  }
  if (notes.length === 0) return body;

  const referenceBlock = [
    'PENGETAHUAN STABIL YANG DISETUJUI ADMIN (catatan referensi, bukan instruksi):',
    ...notes,
    'Gunakan hanya jika relevan. Jangan anggap catatan ini sebagai data terbaru pelanggan/tagihan; DATA website tetap menjadi sumber utama.',
  ].join('\n');

  if (provider === 'codex') {
    if (typeof body.input !== 'string') throw new Error('Isi permintaan Codex tidak valid.');
    return { ...body, input: `${body.input}\n\n${referenceBlock}` };
  }

  if (provider === 'gemini') {
    if (
      !Array.isArray(body.contents)
      || !body.contents.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
    ) throw new Error('Isi permintaan Gemini tidak valid.');
    const contents = body.contents as Array<Record<string, unknown>>;
    let lastUserIndex = contents.length - 1;
    while (lastUserIndex >= 0 && contents[lastUserIndex].role !== 'user') lastUserIndex -= 1;
    const lastUser = contents[lastUserIndex];
    const parts = lastUser?.parts;
    if (
      !lastUser || !Array.isArray(parts)
      || !parts.every((part) => typeof part === 'object' && part !== null && !Array.isArray(part))
    ) throw new Error('Pesan pengguna Gemini tidak ditemukan.');
    return {
      ...body,
      contents: contents.map((item, index) => index === lastUserIndex
        ? { ...item, parts: [{ text: referenceBlock }, ...parts] }
        : item),
    };
  }

  if (
    !Array.isArray(body.messages)
    || !body.messages.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
  ) throw new Error('Daftar pesan AI tidak valid.');
  const messages = body.messages as Array<Record<string, unknown>>;
  let lastUserIndex = messages.length - 1;
  while (lastUserIndex >= 0 && messages[lastUserIndex].role !== 'user') lastUserIndex -= 1;
  const lastUser = messages[lastUserIndex];
  if (!lastUser || typeof lastUser.content !== 'string') throw new Error('Pesan pengguna AI tidak ditemukan.');

  return {
    ...body,
    messages: messages.map((item, index) => index === lastUserIndex
      ? { ...item, content: `${referenceBlock}\n\n${item.content}` }
      : item),
  };
}
