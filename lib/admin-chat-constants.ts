export const ADMIN_CHAT_RETENTION_DAYS = 15;
export const ADMIN_CHAT_RETENTION_MS = ADMIN_CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const ADMIN_CHAT_UPLOAD_CHUNK_SIZE = 1024 * 1024;
export const ADMIN_CHAT_MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

export function getAdminChatExpiry(startedAt = new Date()): Date {
  return new Date(startedAt.getTime() + ADMIN_CHAT_RETENTION_MS);
}

export function isAdminChatMediaType(contentType: string): boolean {
  const normalizedType = contentType.split(';', 1)[0].trim().toLowerCase();
  if (/^(image|video)\//.test(normalizedType)) return !/^image\/svg\+xml$/.test(normalizedType);
  return ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'].includes(normalizedType);
}

export function sanitizeAdminChatFileName(fileName: string): string {
  return fileName
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split(/[\\/]/)
    .pop()
    ?.trim()
    .slice(0, 180) || '';
}