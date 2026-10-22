'use client';

import { PointerEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface ImageSource {
  url: string;
  name: string;
  width: number;
  height: number;
}

interface ProfileImageEditorProps {
  username: string;
  profileImage: string;
  hasOriginalPhoto?: boolean;
  onUpdated: (profileImage: string, hasOriginalPhoto?: boolean) => void;
}

const CROP_SIZE = 288;
const MAX_SOURCE_SIZE = 10 * 1024 * 1024;
const MAX_SAVED_SIZE = 480 * 1024;
const MAX_ORIGINAL_SIZE = 2.4 * 1024 * 1024;

function createJpegBlob(image: HTMLImageElement, maxDimension: number): Promise<Blob | null> {
  const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Browser tidak dapat mengompres foto.'));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Gagal membaca foto.'));
    reader.onerror = () => reject(new Error('Gagal membaca foto.'));
    reader.readAsDataURL(blob);
  });
}

export default function ProfileImageEditor({ username, profileImage, hasOriginalPhoto = false, onUpdated }: ProfileImageEditorProps) {
  const [source, setSource] = useState<ImageSource | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);
  const [isLoadingOriginalPhoto, setIsLoadingOriginalPhoto] = useState(false);
  const [originalPhotoError, setOriginalPhotoError] = useState('');
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState('');
  const [originalPhotoDimensions, setOriginalPhotoDimensions] = useState({ width: 1, height: 1 });
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const baseScale = source?.width && source.height
    ? Math.max(CROP_SIZE / source.width, CROP_SIZE / source.height)
    : 1;
  const scale = baseScale * zoom;
  const displayWidth = (source?.width || CROP_SIZE) * scale;
  const displayHeight = (source?.height || CROP_SIZE) * scale;

  useEffect(() => () => {
    if (originalPhotoUrl) URL.revokeObjectURL(originalPhotoUrl);
  }, [originalPhotoUrl]);

  const closeOriginalPhoto = () => {
    setIsViewingPhoto(false);
    setOriginalPhotoError('');
    setOriginalPhotoDimensions({ width: 1, height: 1 });
    setOriginalPhotoUrl('');
  };

  const handleViewOriginalPhoto = async () => {
    setIsViewingPhoto(true);
    setOriginalPhotoError('');
    if (!hasOriginalPhoto) {
      setOriginalPhotoError('Upload foto profil');
      return;
    }

    setIsLoadingOriginalPhoto(true);
    try {
      const response = await fetch('/api/auth/me/profile-image/original', { cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Foto gagal dimuat (HTTP ${response.status}).`);
      }
      setOriginalPhotoUrl(URL.createObjectURL(await response.blob()));
    } catch (error) {
      setOriginalPhotoError(error instanceof Error ? error.message : 'Gagal memuat foto utuh.');
    } finally {
      setIsLoadingOriginalPhoto(false);
    }
  };

  const closeCrop = () => {
    if (source?.url) URL.revokeObjectURL(source.url);
    setSource(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_SOURCE_SIZE) {
      toast.error('Pilih foto JPG, PNG, atau WebP maksimal 10 MB.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    if (source?.url) URL.revokeObjectURL(source.url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSource({ url: URL.createObjectURL(file), name: file.name, width: 0, height: 0 });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!source?.width) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const maxX = Math.max(0, (displayWidth - CROP_SIZE) / 2);
    const maxY = Math.max(0, (displayHeight - CROP_SIZE) / 2);
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, dragRef.current.offsetX + event.clientX - dragRef.current.x)),
      y: Math.max(-maxY, Math.min(maxY, dragRef.current.offsetY + event.clientY - dragRef.current.y)),
    });
  };

  const handleSave = async () => {
    const image = imageRef.current;
    if (!source || !image || !source.width || isSaving) return;

    setIsSaving(true);
    try {
      let originalBlob: Blob | null = null;
      for (const maxDimension of [1920, 1600, 1280]) {
        originalBlob = await createJpegBlob(image, maxDimension);
        if (originalBlob && originalBlob.size <= MAX_ORIGINAL_SIZE) break;
      }
      if (!originalBlob || originalBlob.size > MAX_ORIGINAL_SIZE) {
        throw new Error('Foto utuh tidak dapat dikompres ke ukuran yang diizinkan. Coba foto lain.');
      }
      const finalOriginalBlob = originalBlob;

      const sourceSize = CROP_SIZE / scale;
      const sourceX = (displayWidth / 2 - CROP_SIZE / 2 - offset.x) / scale;
      const sourceY = (displayHeight / 2 - CROP_SIZE / 2 - offset.y) / scale;
      let croppedFile: Blob | null = null;

      for (const outputSize of [512, 384, 256]) {
        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Browser tidak dapat memotong foto.');
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
        croppedFile = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
        if (croppedFile && croppedFile.size <= MAX_SAVED_SIZE) break;
      }

      if (!croppedFile || croppedFile.size > MAX_SAVED_SIZE) {
        throw new Error('Ukuran hasil foto masih terlalu besar. Coba foto lain.');
      }
      const finalCroppedFile = croppedFile;
      const [profileImageData, originalProfileImageData] = await Promise.all([
        readBlobAsDataUrl(finalCroppedFile),
        readBlobAsDataUrl(finalOriginalBlob),
      ]);
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileImage: profileImageData, originalProfileImage: originalProfileImageData }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Gagal menyimpan foto (HTTP ${response.status}).`);

      onUpdated(data.profileImage || profileImageData, true);
      window.dispatchEvent(new Event('profile-updated'));
      toast.success(data.message || 'Foto profil berhasil diperbarui.');
      closeCrop();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui foto profil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (isSaving || !profileImage) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileImage: '' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Gagal menghapus foto (HTTP ${response.status}).`);
      onUpdated('', false);
      closeOriginalPhoto();
      window.dispatchEvent(new Event('profile-updated'));
      toast.success(data.message || 'Foto profil dihapus.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus foto profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => handleFileChange(event.target.files?.[0])}
        aria-label="Pilih foto profil"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleViewOriginalPhoto()}
          disabled={isSaving}
          className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-primary text-primary-foreground outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
          aria-label={profileImage ? `Lihat foto profil ${username}` : `Pilih foto profil ${username}`}
          title={profileImage ? 'Lihat foto profil' : 'Pilih foto profil'}
        >
          {profileImage ? <Image src={profileImage} alt="" width={48} height={48} unoptimized className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-lg font-semibold">{username.slice(0, 1).toUpperCase()}</span>}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Camera className="h-5 w-5" /></span>
        </button>
        <p className="truncate text-base font-semibold">{username}</p>
      </div>

      <Dialog open={Boolean(source)} onOpenChange={(open) => { if (!open && !isSaving) closeCrop(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur foto profil</DialogTitle>
            <DialogDescription>Geser foto agar posisinya pas. Hasil akan dipotong persegi.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative h-72 w-72 max-w-full touch-none overflow-hidden rounded-md bg-black/90 cursor-move"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={() => { dragRef.current = null; }}
              onPointerCancel={() => { dragRef.current = null; }}
              aria-label="Area crop foto, geser untuk mengatur posisi"
            >
              {source && <Image
                ref={imageRef}
                src={source.url}
                alt={`Pratinjau crop ${source.name}`}
                width={source.width || 1}
                height={source.height || 1}
                unoptimized
                draggable={false}
                onLoad={(event) => setSource((current) => current ? {
                  ...current,
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                } : current)}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: displayWidth,
                  height: displayHeight,
                  maxWidth: 'none',
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  pointerEvents: 'none',
                }}
              />}
            </div>
            <label className="flex w-full max-w-xs items-center gap-3 text-sm">
              <span className="shrink-0 text-muted-foreground">Zoom</span>
              <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => {
                const nextZoom = Number(event.target.value);
                const nextWidth = (source?.width || CROP_SIZE) * baseScale * nextZoom;
                const nextHeight = (source?.height || CROP_SIZE) * baseScale * nextZoom;
                setZoom(nextZoom);
                setOffset((current) => ({
                  x: Math.max(-(nextWidth - CROP_SIZE) / 2, Math.min((nextWidth - CROP_SIZE) / 2, current.x)),
                  y: Math.max(-(nextHeight - CROP_SIZE) / 2, Math.min((nextHeight - CROP_SIZE) / 2, current.y)),
                }));
              }} className="w-full accent-primary" aria-label="Zoom foto profil" />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeCrop} disabled={isSaving}>Batal</Button>
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !source?.width}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Simpan Foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewingPhoto} onOpenChange={(open) => { if (!open) closeOriginalPhoto(); }}>
        <DialogContent className="popup-appear max-w-2xl gap-5 rounded-xl p-5 pt-14 sm:gap-6 sm:rounded-xl sm:p-7 sm:pt-16 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0">
          <DialogTitle className="sr-only">Foto profil {username}</DialogTitle>
          {isLoadingOriginalPhoto && <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
          {originalPhotoError && <p className="mx-1 rounded-md border border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">{originalPhotoError}</p>}
          {originalPhotoUrl && <div className="flex min-h-48 max-h-[65dvh] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 p-3 sm:p-5">
            <Image
              src={originalPhotoUrl}
              alt={`Foto utuh profil ${username}`}
              width={originalPhotoDimensions.width}
              height={originalPhotoDimensions.height}
              unoptimized
              onLoad={(event) => setOriginalPhotoDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })}
              className="max-h-[55dvh] w-auto max-w-full rounded-md object-contain"
            />
          </div>}
          <DialogFooter className="mt-1 flex-row justify-end gap-3 border-t border-border pt-5">
            <Button type="button" variant="outline" onClick={() => { closeOriginalPhoto(); inputRef.current?.click(); }}>
              <Upload className="mr-2 h-4 w-4" /> Ganti foto
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleRemove()} disabled={isSaving || !profileImage}>
              <Trash2 className="mr-2 h-4 w-4" /> Hapus foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
