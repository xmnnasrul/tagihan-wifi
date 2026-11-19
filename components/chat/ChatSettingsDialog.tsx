'use client';

import { type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/responsive-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CHAT_AI_PROVIDERS,
  ChatAIProvider,
  ChatAISettings,
  getCloudflareWorkersAIBaseURL,
  normalizeCloudflareAccountID,
} from '@/lib/chat-answer';

type ChatSettingsDialogProps = {
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedProvider: ChatAIProvider;
  chooseProvider: (provider: ChatAIProvider) => void;
  cloudflareAccountID: string;
  setCloudflareAccountID: Dispatch<SetStateAction<string>>;
  baseURL: string;
  setBaseURL: Dispatch<SetStateAction<string>>;
  apiKeyInput: string;
  setApiKeyInput: Dispatch<SetStateAction<string>>;
  availableModels: string[];
  setAvailableModels: Dispatch<SetStateAction<string[]>>;
  loadingModels: boolean;
  loadModels: () => void;
  modelsError: string;
  setModelsError: Dispatch<SetStateAction<string>>;
  model: string;
  setModel: Dispatch<SetStateAction<string>>;
  settingsError: string;
  settingsSaved: boolean;
  setSettingsSaved: Dispatch<SetStateAction<boolean>>;
  config: ChatAISettings | null;
  clearSettings: () => void;
};

export default function ChatSettingsDialog({
  open,
  onOpenChange,
  onSubmit,
  selectedProvider,
  chooseProvider,
  cloudflareAccountID,
  setCloudflareAccountID,
  baseURL,
  setBaseURL,
  apiKeyInput,
  setApiKeyInput,
  availableModels,
  setAvailableModels,
  loadingModels,
  loadModels,
  modelsError,
  setModelsError,
  model,
  setModel,
  settingsError,
  settingsSaved,
  setSettingsSaved,
  config,
  clearSettings,
}: ChatSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="chat-settings-dialog max-h-[min(85dvh,52rem)] gap-5 overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Pengaturan koneksi AI</DialogTitle>
          <DialogDescription>
            Atur penyedia, API key, dan model untuk chat ini.
          </DialogDescription>
        </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <p className="text-sm font-medium leading-none">Penyedia AI</p>
              <div className="-mx-1 overflow-x-auto px-1 scrollbar-hidden">
                <div className="flex min-w-max border-b border-border" role="group" aria-label="Pilih penyedia AI">
                  {CHAT_AI_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      aria-pressed={selectedProvider === provider.id}
                      onClick={() => chooseProvider(provider.id)}
                      className={`min-h-10 shrink-0 border-b-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selectedProvider === provider.id
                          ? 'border-foreground font-medium text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {provider.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {selectedProvider === 'cloudflare' && (
              <div className="grid gap-2">
                <Label htmlFor="chat-ai-cloudflare-account-id">Cloudflare Account ID</Label>
                <Input
                  id="chat-ai-cloudflare-account-id"
                  type="text"
                  value={cloudflareAccountID}
                  onChange={(event) => {
                    const nextAccountID = event.target.value;
                    const normalizedAccountID = normalizeCloudflareAccountID(nextAccountID);
                    setCloudflareAccountID(nextAccountID);
                    setBaseURL(normalizedAccountID ? getCloudflareWorkersAIBaseURL(normalizedAccountID) || '' : '');
                    setModelsError('');
                    setSettingsSaved(false);
                  }}
                  autoComplete="off"
                  maxLength={32}
                  pattern="[a-fA-F0-9]{32}"
                  title="Account ID harus terdiri dari 32 karakter heksadesimal."
                  aria-describedby="chat-ai-cloudflare-account-hint"
                  required
                />
                <p id="chat-ai-cloudflare-account-hint" className="text-xs text-muted-foreground">
                  Salin Account ID 32 karakter dari dashboard Cloudflare. Endpoint akan terisi otomatis.
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="chat-ai-base-url">Base URL</Label>
              <Input
                id="chat-ai-base-url"
                type="url"
                value={baseURL}
                onChange={(event) => {
                  if (selectedProvider !== 'custom') return;
                  setBaseURL(event.target.value);
                  setAvailableModels([]);
                  setModelsError('');
                  setSettingsSaved(false);
                }}
                readOnly={selectedProvider !== 'custom'}
                autoComplete="url"
                required={selectedProvider !== 'cloudflare'}
              />
              {selectedProvider === 'custom' && (
                <p className="text-xs text-muted-foreground">
                  Custom API harus memakai HTTPS.
                </p>
              )}
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="chat-ai-api-key">
                {selectedProvider === 'cloudflare' ? 'Cloudflare API Token' : 'API Key'}
              </Label>
              <Input
                id="chat-ai-api-key"
                type="password"
                value={apiKeyInput}
                onBlur={(event) => {
                  const nextTarget = event.relatedTarget;
                  if (
                    apiKeyInput.trim()
                    && !(nextTarget instanceof HTMLButtonElement)
                    && selectedProvider !== 'cloudflare'
                    && !loadingModels
                    && availableModels.length === 0
                  ) {
                    loadModels();
                  }
                }}
                onChange={(event) => {
                  setApiKeyInput(event.target.value);
                  setAvailableModels([]);
                  setModelsError('');
                  setSettingsSaved(false);
                }}
                autoComplete="new-password"
                maxLength={500}
                aria-describedby={selectedProvider === 'cloudflare' ? 'chat-ai-key-hint' : undefined}
              />
              {selectedProvider === 'cloudflare' && (
                <p id="chat-ai-key-hint" className="text-xs text-muted-foreground">
                  Gunakan API Token dengan izin Account &gt; Workers AI &gt; Read.
                </p>
              )}
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="chat-ai-model">Model AI</Label>
              {selectedProvider === 'cloudflare' ? (
                <Input
                  id="chat-ai-model"
                  type="text"
                  value={model}
                  onChange={(event) => {
                    setModel(event.target.value);
                    setSettingsSaved(false);
                  }}
                  maxLength={120}
                  autoComplete="off"
                  required
                  aria-describedby="chat-ai-model-hint"
                />
              ) : (
                <select
                  id="chat-ai-model"
                  value={availableModels.includes(model) ? model : ''}
                  onFocus={() => {
                    if (
                      !apiKeyInput.trim() && config?.provider === selectedProvider
                      && config.hasApiKey && !loadingModels && availableModels.length === 0
                    ) {
                      loadModels();
                    }
                  }}
                  onChange={(event) => {
                    setModel(event.target.value);
                    setSettingsSaved(false);
                  }}
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    {loadingModels
                      ? 'Memuat daftar model…'
                      : availableModels.length > 0
                        ? 'Pilih model AI'
                        : apiKeyInput.trim() || config?.hasApiKey
                          ? 'Pilih model AI'
                          : 'Isi API Key dulu'}
                  </option>
                  {availableModels.map((modelID) => <option key={modelID} value={modelID}>{modelID}</option>)}
                </select>
              )}
              {selectedProvider === 'cloudflare' && (
                <p id="chat-ai-model-hint" className="text-xs text-muted-foreground">
                  Gunakan ID dari katalog Cloudflare: @cf/meta/llama-3.1-8b-instruct atau google/gemini-4-argon.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {loadingModels && (
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Memuat model…
                  </span>
                )}
                {availableModels.length > 0 && (
                  <span className="text-sm text-muted-foreground" role="status">
                    {availableModels.length} model tersedia
                  </span>
                )}
              </div>
              {modelsError && <p className="text-sm text-destructive" role="alert">{modelsError}</p>}
            </div>
            {settingsError && (
              <p className="text-sm text-destructive md:col-span-2" role="alert">{settingsError}</p>
            )}
            {settingsSaved && (
              <p className="text-sm text-muted-foreground md:col-span-2" role="status">Pengaturan AI tersimpan.</p>
            )}
            <div className="flex items-center justify-end gap-2 md:col-span-2">
              {config && (
                <Button
                  type="button"
                  variant="outline"
                  className="mr-auto px-2 text-xs sm:px-4 sm:text-sm"
                  onClick={clearSettings}
                >
                  Hapus konfigurasi
                </Button>
              )}
              <Button type="submit" className="px-2 text-xs sm:px-4 sm:text-sm">
                Simpan pengaturan
              </Button>
            </div>
          </form>
      </DialogContent>
    </Dialog>
  );
}
