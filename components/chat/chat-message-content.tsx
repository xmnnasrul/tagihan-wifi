'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  appendChatTablePageMetadata,
  ChatAISettings,
  ChatTablePageMetadata,
  getChatBillingHistoryReply,
  getChatCustomerDataReply,
  getChatNoDataReply,
  getChatNotesReply,
  getChatPackageDataReply,
  getChatTablePageMetadata,
  getChatUnpaidBillingReply,
  getChatVisitedCustomerReply,
  getChatWebImageMetadata,
  getVisibleChatAnswer,
  isChatAIProvider,
} from '@/lib/chat-answer';

export type Message = { role: 'user' | 'assistant'; content: string };
export type ChatWebSource = { title: string; url: string };
export type ChatWebImage = { title: string; thumbnail: string; url: string };

export function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return 'role' in value
    && (value.role === 'user' || value.role === 'assistant')
    && 'content' in value
    && typeof value.content === 'string';
}

export function isChatAISettings(value: unknown): value is ChatAISettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return 'provider' in value
    && isChatAIProvider(value.provider)
    && 'baseURL' in value && typeof value.baseURL === 'string'
    && 'model' in value && typeof value.model === 'string'
    && 'hasApiKey' in value && typeof value.hasApiKey === 'boolean';
}

export async function readResponseData(response: Response): Promise<unknown> {
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

export function getResponseError(value: unknown, fallback: string): string {
  return typeof value === 'object' && value !== null
    && 'error' in value && typeof value.error === 'string'
    ? value.error
    : fallback;
}

export function getChatWebSources(response: Response): ChatWebSource[] {
  const header = response.headers.get('x-chat-web-sources');
  if (!header) return [];
  try {
    const data: unknown = JSON.parse(decodeURIComponent(header));
    if (!Array.isArray(data)) throw new Error('Daftar sumber internet tidak valid.');
    return data.flatMap((source): ChatWebSource[] => {
      if (
        typeof source !== 'object' || source === null
        || !('title' in source) || typeof source.title !== 'string'
        || !('url' in source) || typeof source.url !== 'string'
      ) throw new Error('Format sumber internet tidak valid.');
      try {
        const url = new URL(source.url);
        if (url.protocol !== 'https:') throw new Error('Tautan sumber internet tidak aman.');
        return [{ title: source.title.slice(0, 180), url: url.href }];
      } catch {
        throw new Error('Tautan sumber internet tidak valid.');
      }
    });
  } catch {
    throw new Error('Sumber internet dari server tidak dapat dibaca.');
  }
}

export function getChatWebImages(response: Response): ChatWebImage[] {
  const header = response.headers.get('x-chat-web-images');
  if (!header) return [];
  try {
    const data: unknown = JSON.parse(decodeURIComponent(header));
    if (!Array.isArray(data)) throw new Error('Daftar gambar internet tidak valid.');
    return data.flatMap((image): ChatWebImage[] => {
      if (
        typeof image !== 'object' || image === null
        || !('title' in image) || typeof image.title !== 'string'
        || !('thumbnail' in image) || typeof image.thumbnail !== 'string'
        || !('url' in image) || typeof image.url !== 'string'
      ) throw new Error('Format gambar internet tidak valid.');
      try {
        const thumbnail = new URL(image.thumbnail);
        const url = new URL(image.url);
        if (
          thumbnail.protocol !== 'https:'
          || !/^tse\d+\.mm\.bing\.net$/iu.test(thumbnail.hostname)
          || url.protocol !== 'https:'
          || url.username || url.password
        ) throw new Error('Tautan gambar internet tidak aman.');
        return [{ title: image.title.slice(0, 180), thumbnail: thumbnail.href, url: url.href }];
      } catch {
        throw new Error('Tautan gambar internet tidak valid.');
      }
    });
  } catch {
    throw new Error('Gambar internet dari server tidak dapat dibaca.');
  }
}

export function appendChatWebSources(content: string, sources: ChatWebSource[]): string {
  if (sources.length === 0) return content;
  return `${content.trimEnd()}\n\nSumber internet:\n${sources
    .map((source, index) => `${index + 1}. ${source.title}\n${source.url}`)
    .join('\n')}`;
}

export function getStructuredChatReply(value: unknown): string | null {
  return getChatNoDataReply(value)
    || getChatBillingHistoryReply(value)
    || getChatUnpaidBillingReply(value)
    || getChatVisitedCustomerReply(value)
    || getChatPackageDataReply(value)
    || getChatNotesReply(value)
    || getChatCustomerDataReply(value);
}

export function attachChatTablePagination(
  content: string,
  metadata: ChatTablePageMetadata | null,
): string {
  if (
    !metadata || (metadata.page === 1 && !metadata.hasNext)
    || !/\n\|[^\n]+\|\n\|[-:| ]+\|/u.test(content)
  ) return content;
  return appendChatTablePageMetadata(content, metadata);
}

export function renderChatMessage(
  content: string,
  onPageChange?: (page: number) => void,
  pageLoading = false,
): ReactNode {
  const pagination = getChatTablePageMetadata(content);
  const lines = getVisibleChatAnswer(content).split('\n');
  const blocks: ReactNode[] = [];
  let textLines: string[] = [];
  let blockIndex = 0;
  let paginationRendered = false;

  function flushText() {
    if (textLines.length === 0) return;
    const text = textLines.join('\n').trim();
    if (text) {
      const key = `text-${blockIndex++}`;
      blocks.push(/^(?:Riwayat Tagihan|Detail pembayaran)$/u.test(text)
        ? <h4 key={key} className="pt-2 text-sm font-semibold text-foreground">{text}</h4>
        : (
          <p key={key} className="whitespace-pre-wrap">
            {text.split(/(https:\/\/[^\s<]+)/giu).map((part, index) => {
              if (!part.startsWith('https://')) return part;
              const trailingPunctuation = part.match(/[.,!?;:)]+$/u)?.[0] || '';
              const link = trailingPunctuation ? part.slice(0, -trailingPunctuation.length) : part;
              return (
                <span key={`${key}-link-${index}`}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-primary underline underline-offset-2 hover:opacity-80 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {link}
                  </a>
                  {trailingPunctuation}
                </span>
              );
            })}
          </p>
        ));
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
    const isBillingHistorySummary = headers[0] === 'Bulan' && headers.includes('Dibayar');
    const isBillingPaymentDetails = headers.includes('Periode')
      && headers.includes('Pembayaran') && headers.includes('Nominal');
    const isBillingHistoryTable = isBillingHistorySummary || isBillingPaymentDetails;
    const minWidthClass = isBillingHistorySummary
      ? 'min-w-[34rem]'
      : isBillingPaymentDetails ? 'min-w-[50rem]' : 'min-w-max';

    blocks.push(
      <div
        key={`table-${blockIndex++}`}
        className="max-w-full overflow-x-auto rounded-md border border-border"
        role="region"
        aria-label="Tabel jawaban yang dapat digulir"
        tabIndex={0}
      >
        <table className={`w-full border-collapse text-left text-sm ${minWidthClass}`}>
          <thead className="bg-muted/80">
            <tr>
              {headers.map((header, columnIndex) => (
                <th
                  key={`${header}-${columnIndex}`}
                  scope="col"
                  className={`border-b border-r border-border px-3 py-2.5 font-medium text-muted-foreground first:pl-3 last:border-r-0 last:pr-3 ${
                    isBillingHistoryTable && columnIndex === 0 ? 'sticky left-0 z-20 bg-muted' : ''
                  } ${
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
                    className={`border-b border-r border-border px-3 py-2.5 align-middle first:pl-3 last:pr-3 ${
                      isBillingHistoryTable && columnIndex === 0 ? 'sticky left-0 z-10 bg-background font-medium' : ''
                    } ${
                      isBillingHistoryTable && /catatan/i.test(headers[columnIndex])
                        ? 'max-w-48 whitespace-normal break-words'
                        : isBillingPaymentDetails && headers[columnIndex] === 'Tanggal dan petugas'
                          ? 'max-w-52 whitespace-normal'
                          : 'whitespace-nowrap'
                    } ${
                        /(?:tagihan|jumlah|total|harga|saldo|nominal|bayar|setoran)/iu.test(headers[columnIndex])
                          ? 'text-right tabular-nums'
                          : 'text-left'
                      } ${columnIndex === row.length - 1 ? 'border-r-0' : ''}`}
                    >
                      {isBillingHistoryTable && headers[columnIndex] === 'Status'
                        ? (() => {
                            const status = cell.trim().toLocaleLowerCase();
                            const statusClass = ['lunas', 'transfer', 'tunai'].includes(status)
                              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : status === 'nyicil'
                                ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                : status === 'belum bayar'
                                  ? 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'
                                  : 'border-border bg-muted text-muted-foreground';
                            return <span className={`inline-flex whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${statusClass}`}>{cell}</span>;
                          })()
                        : pagination && columnIndex === 0 && /^no\.?$/iu.test(headers[0].trim())
                          ? (pagination.page - 1) * pagination.pageSize + rowIndex + 1
                          : cell}
                    </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    if (pagination && onPageChange && !paginationRendered) {
      paginationRendered = true;
      blocks.push(
        <nav key={`pagination-${blockIndex++}`} className="flex items-center justify-end gap-2" aria-label="Halaman tabel">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Halaman sebelumnya"
            disabled={pageLoading || pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-28 text-center text-xs text-muted-foreground" aria-live="polite">
            {pageLoading ? 'Memuat halaman…' : `Halaman ${pagination.page}`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Halaman berikutnya"
            disabled={pageLoading || !pagination.hasNext}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </nav>,
      );
    }
  }

  flushText();
  const images = getChatWebImageMetadata(content);
  if (images.length > 0) {
    blocks.push(
      <div key="web-images" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <a
            key={`${image.url}-${index}`}
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Buka sumber gambar: ${image.title}`}
            className="group min-w-0 overflow-hidden rounded-md bg-background transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="relative block aspect-[4/3] overflow-hidden">
              <Image
                src={image.thumbnail}
                alt={image.title}
                fill
                sizes="(max-width: 640px) 42vw, 220px"
                unoptimized
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </span>
            <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">{image.title}</span>
          </a>
        ))}
      </div>,
    );
  }
  return <div className="space-y-3">{blocks}</div>;
}
