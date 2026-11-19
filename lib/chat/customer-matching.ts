import { MONTHS } from '../months.ts';
import type { ChatConversationMessage } from './providers.ts';
import { getChatContextTopics } from './replies.ts';

export const CHAT_MONTHS = MONTHS;
export type ChatNewCustomerPeriod = 'current' | 'previous' | { month: typeof CHAT_MONTHS[number]; year?: number };

export const customerLookupFillerWords = new Set([
  'cari', 'carikan', 'cariin', 'carikn', 'nyari', 'temukan', 'cek', 'periksa', 'lihat', 'liatin', 'lihatin', 'tampilkan',
  'data', 'info', 'informasi', 'profil', 'detail', 'nama',
  'pelanggan', 'customer', 'tolong', 'bisa', 'coba', 'saya', 'dong', 'daftar', 'semua', 'seluruh', 'kalau',
  'siapa', 'aja', 'saja', 'mana', 'ada', 'yang', 'yg', 'di', 'pada', 'untuk', 'tentang', 'alamat',
  'berapa', 'jumlah', 'total', 'bulan', 'periode', 'tahun', 'hari', 'ini', 'apa', 'bagaimana', 'gimana',
  'belum', 'sudah', 'masih', 'tagihan', 'tunggakan', 'nunggak', 'utang',
  'bayar', 'membayar', 'dibayar', 'pembayaran', 'transfer', 'lunas',
  'melunasi', 'dilunasi', 'cicil', 'cicilan', 'nyicil', 'piutang', 'invoice', 'billing',
  'laporan', 'statistik', 'ringkasan', 'pendapatan', 'pemasukan', 'uang', 'masuk',
  'terkumpul', 'omzet', 'dashboard', 'rekap', 'history', 'arsip', 'diarsip', 'berhenti', 'baru', 'new',
  'lebih', 'dari',
  'lalu', 'kemarin', 'sebelumnya',
  'stop', 'langganan', 'putus', 'nonaktif', 'tidak', 'aktif', 'dipulihkan',
  'pulihkan', 'kembali', 'riwayat', 'kolektor', 'penagihan', 'kunjungan',
  'dikunjungi', 'ditagih', 'menagih', 'nagih', 'didatangi', 'setoran',
  'penagih', 'petugas', 'paket', 'internet', 'kecepatan', 'harga', 'status',
  'januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus',
  'september', 'oktober', 'november', 'desember',
]);

export function normalizeChatSearchText(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function getChatGreetingReply(question: string): string | null {
  const normalized = normalizeChatSearchText(question).replace(/(.)\1{2,}/gu, '$1$1');
  if (!/^(?:hai+|halo+|helo+|hello+|hi+)(?: rexxaa??)?$/u.test(normalized)) return null;
  return 'Haloo juga!';
}

export function getChatNewCustomerPeriod(question: string): ChatNewCustomerPeriod | null {
  const normalized = normalizeChatSearchText(question);
  if (!/\b(?:pelanggan|customer)\s+(?:yang\s+)?(?:baru|new)\b/u.test(normalized)) return null;
  if (/\b(?:bulan\s+(?:lalu|kemarin|sebelumnya)|bulan\s+yang\s+lalu)\b/u.test(normalized)) return 'previous';
  const month = CHAT_MONTHS.find((candidate) =>
    new RegExp(`\\bbulan\\s+${candidate.toLocaleLowerCase()}\\b`, 'u').test(normalized));
  if (month) {
    const year = normalized.match(/\b20\d{2}\b/)?.[0];
    return { month, ...(year ? { year: Number(year) } : {}) };
  }
  return 'current';
}

export function getChatNewCustomerFollowUpQuestion(question: string, previousQuestion: string): string {
  if (!/^(?:bulan\s+lalu|lalu)$/iu.test(question.trim())) return question;
  if (!getChatNewCustomerPeriod(previousQuestion)) return question;

  const periodPattern = new RegExp(
    `\\bbulan\\s+(?:ini|lalu|kemarin|sebelumnya|yang\\s+lalu|${CHAT_MONTHS.join('|')})(?:\\s+20\\d{2})?\\b`,
    'iu',
  );
  const expandedQuestion = previousQuestion.replace(periodPattern, 'bulan lalu');
  return expandedQuestion === previousQuestion
    ? `${previousQuestion.trim()} bulan lalu`
    : expandedQuestion;
}

export function getChatBillingFollowUpQuestion(question: string, previousQuestion: string): string {
  const normalizedQuestion = normalizeChatSearchText(question);
  const requestedMonth = CHAT_MONTHS.find((month) =>
    normalizedQuestion.split(/\s+/u).includes(month.toLocaleLowerCase()));
  if (!requestedMonth || !getChatContextTopics(previousQuestion).includes('billing')) return question;

  const remainingTerms = normalizedQuestion.split(/\s+/u).filter((term) =>
    !customerLookupFillerWords.has(term)
    && !CHAT_MONTHS.some((month) => month.toLocaleLowerCase() === term)
    && !/^20\d{2}$/u.test(term));
  if (remainingTerms.length > 0) return question;

  const requestedYear = normalizedQuestion.match(/\b20\d{2}\b/u)?.[0];
  const previousMonthPattern = new RegExp(
    `\\b(?:bulan\\s+)?(${CHAT_MONTHS.join('|')})(?:\\s+(20\\d{2}))?\\b`,
    'iu',
  );
  const previousMonth = previousQuestion.match(previousMonthPattern);
  if (!previousMonth) {
    return `${previousQuestion.trim()} bulan ${requestedMonth}${requestedYear ? ` ${requestedYear}` : ''}`;
  }

  const year = requestedYear || previousMonth[2] || '';
  return previousQuestion.replace(previousMonthPattern, `bulan ${requestedMonth}${year ? ` ${year}` : ''}`);
}

export function getChatContextFollowUpQuestion(
  question: string,
  history: readonly ChatConversationMessage[],
): string {
  const previousQuestions = history
    .filter((message) => message.role === 'user')
    .slice(-4)
    .map((message) => message.content.trim());
  const previousQuestion = previousQuestions.at(-1) || '';
  if (!previousQuestion) return question;

  const expandedQuestion = getChatBillingFollowUpQuestion(
    getChatNewCustomerFollowUpQuestion(question, previousQuestion),
    previousQuestion,
  );
  const isContextReference = (value: string) =>
    /\b(?:dia|beliau|itu|tersebut|tadi|yang\s+(?:sama|tadi|itu)|(?:history|riwayat)\s+(?:tagihan|pembayaran|transaksi)|(?:tagihan|alamat|paket|status|pembayaran|tunggakan|nomor|kontak|kunjungan|pelanggan|nama|harga|periode|sisa)nya)\b/iu
      .test(normalizeChatSearchText(value));
  if (!isContextReference(expandedQuestion)) {
    return expandedQuestion;
  }

  const contextQuestions: string[] = [];
  for (const previous of previousQuestions.reverse()) {
    if (getChatContextTopics(previous).length > 0) contextQuestions.push(previous);
    if (!isContextReference(previous)) break;
  }
  if (contextQuestions.length === 0) return expandedQuestion;

  return `${contextQuestions.reverse().join('\n')}\n${expandedQuestion}`;
}

export function matchesChatCustomerNameQuery(question: string, customerName: string): boolean {
  const normalizedName = normalizeChatSearchText(customerName);
  const normalizedQuestion = ` ${normalizeChatSearchText(question)} `;
  if (normalizedQuestion.includes(` ${normalizedName} `)) return true;

  const questionTerms = new Set(
    normalizedQuestion.trim().split(/\s+/u)
      .filter((term) => !customerLookupFillerWords.has(term) && !/^\d+$/u.test(term)),
  );
  return normalizedName.split(/\s+/u).some((term) => questionTerms.has(term));
}

export function getChatCustomerAddressQualifierTerms(question: string, customerName: string): string[] {
  const nameTerms = new Set(normalizeChatSearchText(customerName).split(/\s+/u));
  return normalizeChatSearchText(question)
    .split(/\s+/u)
    .filter((term) => term.length > 1
      && !nameTerms.has(term)
      && !customerLookupFillerWords.has(term)
      && !/^20\d{2}$/u.test(term));
}

export function matchesChatCustomerAddressQuery(
  question: string,
  customerName: string,
  address: string,
): boolean {
  const addressTerms = new Set(normalizeChatSearchText(address).split(/\s+/u));
  return getChatCustomerAddressQualifierTerms(question, customerName)
    .some((term) => addressTerms.has(term));
}

export function requestsChatCustomerAddress(question: string): boolean {
  return /\b(?:alamat|kontak)\b/u.test(normalizeChatSearchText(question));
}

export function getChatUnpaidMonthThreshold(question: string): number | null {
  const normalized = normalizeChatSearchText(question);
  const numberWords: Record<string, number> = {
    satu: 1,
    dua: 2,
    tiga: 3,
    empat: 4,
    lima: 5,
    enam: 6,
    tujuh: 7,
    delapan: 8,
    sembilan: 9,
    sepuluh: 10,
  };
  const match = normalized.match(/\blebih dari (\d+|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh) bulan\b/u);
  if (!match) return null;
  const count = Number(match[1]) || numberWords[match[1]];
  return Number.isInteger(count) && count > 0 && count < 120 ? count + 1 : null;
}

export function selectChatCustomerMatchIds<T>(
  nameMatchingIds: readonly T[],
  addressMatchedIds: readonly T[],
  hasAddressQualifier: boolean,
): T[] {
  return [...(hasAddressQualifier ? addressMatchedIds : nameMatchingIds)];
}
