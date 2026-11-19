interface ErrorLogEntry {
  level: 'error';
  message: string;
  error: unknown;
  timestamp: string;
}

type ErrorSink = (entry: ErrorLogEntry) => void;

let errorSink: ErrorSink | null = null;

/**
 * Titik sambung opsional untuk layanan monitoring (Sentry, OpenTelemetry, dll).
 * Cukup panggil sekali saat aplikasi start; tanpa sink, error tetap ditulis ke console.
 */
export function setErrorSink(sink: ErrorSink | null): void {
  errorSink = sink;
}

export function logError(message: string, error?: unknown): void {
  const entry: ErrorLogEntry = {
    level: 'error',
    message,
    error,
    timestamp: new Date().toISOString(),
  };

  if (errorSink) {
    try {
      errorSink(entry);
    } catch {
      // Kegagalan sink monitoring tidak boleh mengganggu request.
    }
  }

  console.error(`[error] ${entry.timestamp} ${message}`, error ?? '');
}
