export type ChatContextTopic = 'customers' | 'packages' | 'notes' | 'billing' | 'reports' | 'archive' | 'collection';
export type ChatTablePageSource =
  | 'customers'
  | 'archivedCustomers'
  | 'packages'
  | 'notes'
  | 'billings'
  | 'overdueCustomers'
  | 'visits'
  | 'collectionCustomers';
export interface ChatTablePageMetadata {
  question: string;
  source: ChatTablePageSource;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface ChatWebImageMetadata {
  title: string;
  thumbnail: string;
  url: string;
}

const chatTablePageSources: readonly ChatTablePageSource[] = [
  'customers', 'archivedCustomers', 'packages', 'notes',
  'billings', 'overdueCustomers', 'visits', 'collectionCustomers',
];

export function isChatTablePageMetadata(value: unknown): value is ChatTablePageMetadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return 'question' in value && typeof value.question === 'string'
    && 'source' in value && chatTablePageSources.some((source) => source === value.source)
    && 'page' in value && typeof value.page === 'number' && Number.isInteger(value.page) && value.page >= 1
    && 'pageSize' in value && typeof value.pageSize === 'number'
      && Number.isInteger(value.pageSize) && value.pageSize === 20
    && 'hasNext' in value && typeof value.hasNext === 'boolean';
}

export function appendChatTablePageMetadata(content: string, metadata: ChatTablePageMetadata): string {
  return `${content.trimEnd()}\n<!--CHAT_TABLE_PAGE:${encodeURIComponent(JSON.stringify(metadata))}-->`;
}

export function appendChatWebImageMetadata(content: string, images: ChatWebImageMetadata[]): string {
  if (images.length === 0) return content;
  return `${content.trimEnd()}\n<!--CHAT_WEB_IMAGES:${encodeURIComponent(JSON.stringify(images.slice(0, 5)))}-->`;
}

export function getChatWebImageMetadata(content: string): ChatWebImageMetadata[] {
  const marker = content.match(/<!--CHAT_WEB_IMAGES:([^>]+)-->/u)?.[1];
  if (!marker) return [];
  try {
    const data: unknown = JSON.parse(decodeURIComponent(marker));
    if (!Array.isArray(data)) return [];
    return data.slice(0, 5).flatMap((image): ChatWebImageMetadata[] => {
      if (
        typeof image !== 'object' || image === null
        || !('title' in image) || typeof image.title !== 'string'
        || !('thumbnail' in image) || typeof image.thumbnail !== 'string'
        || !('url' in image) || typeof image.url !== 'string'
      ) return [];
      try {
        const thumbnail = new URL(image.thumbnail);
        const url = new URL(image.url);
        if (
          thumbnail.protocol !== 'https:'
          || !/^tse\d+\.mm\.bing\.net$/iu.test(thumbnail.hostname)
          || url.protocol !== 'https:'
          || url.username || url.password
        ) return [];
        return [{
          title: image.title.slice(0, 180),
          thumbnail: thumbnail.href,
          url: url.href,
        }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function getChatTablePageMetadata(content: string): ChatTablePageMetadata | null {
  const marker = content.match(/<!--CHAT_TABLE_PAGE:([^>]+)-->/u)?.[1];
  if (!marker) return null;
  try {
    const metadata: unknown = JSON.parse(decodeURIComponent(marker));
    return isChatTablePageMetadata(metadata) ? metadata : null;
  } catch {
    return null;
  }
}
