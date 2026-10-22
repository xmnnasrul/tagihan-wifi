export const ADMIN_CHAT_WALLPAPER_MAX_SIZE = 1024 * 1024;

function wallpaperArt(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const ADMIN_CHAT_WALLPAPERS = {
  mountain: {
    label: 'Danau alpine',
    background: 'url("/images/chat-wallpapers/mountain-lake.jpg")',
  },
  ocean: {
    label: 'Laut & layar',
    background: `${wallpaperArt('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><circle cx="940" cy="150" r="76" fill="#fff2c7"/><path d="M0 380q160-70 320 0t320 0 320 0 320 0v420H0Z" fill="#39a8b7"/><path d="M0 490q160-75 320 0t320 0 320 0 320 0v310H0Z" fill="#167c9b"/><path d="M0 620q140-60 280 0t280 0 280 0 280 0 280 0v180H0Z" fill="#105b7a"/><path d="M585 190v300h205Z" fill="#fff2dc"/><path d="M565 235 410 460h155Z" fill="#f6d59d"/><path d="M545 490h280l-45 54H590Z" fill="#17394c"/><path d="M582 530v-40" stroke="#17394c" stroke-width="12"/></svg>')}, linear-gradient(#68c4d0 0 42%, #167c9b 42%, #105b7a)`,
  },
  forest: {
    label: 'Danau berkabut',
    background: 'url("/images/chat-wallpapers/alpine-lake.jpg")',
  },
  city: {
    label: 'Kota malam',
    background: `${wallpaperArt('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><path d="M0 0h1200v800H0Z" fill="#17264c"/><circle cx="940" cy="145" r="67" fill="#ffe8a6"/><path d="M65 335h190v465H65Zm215-145h210v610H280Zm245 230h185v380H525Zm220-170h225v550H745Zm260 105h140v445h-140Z" fill="#263d68"/><g fill="#ffd56f"><path d="M100 390h30v48h-30zm80 0h30v48h-30zm160-130h34v52h-34zm82 0h34v52h-34zm-82 100h34v52h-34zm82 0h34v52h-34zm84 120h32v48h-32zm82 0h32v48h-32zm160-190h36v50h-36zm88 0h36v50h-36zm-88 100h36v50h-36zm88 0h36v50h-36zm120 100h30v50h-30z"/></g><path d="M0 720h1200v80H0Z" fill="#111c39"/></svg>')}, linear-gradient(160deg, #273a71, #111a36)`,
  },
  desert: {
    label: 'Gurun',
    background: `${wallpaperArt('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><path d="M0 0h1200v800H0Z" fill="#f5c27f"/><circle cx="880" cy="170" r="95" fill="#fff0bb"/><path d="M0 460q260-160 520 0t680-10v350H0Z" fill="#e99b62"/><path d="M0 575q300-155 600 5t600-10v230H0Z" fill="#c87555"/><path d="M0 690q270-120 540 0t660-5v115H0Z" fill="#a9534e"/><path d="M180 548q-15-160 55-205 85 65 65 205m-65-52q-100-5-125-95m132 94q115-20 139-112" fill="none" stroke="#53664c" stroke-width="22" stroke-linecap="round"/><path d="M850 520q-8-110 48-142 61 46 46 142m-47-35q-73-4-90-68m97 66q81-14 98-77" fill="none" stroke="#59694b" stroke-width="17" stroke-linecap="round"/></svg>')}, linear-gradient(#f5c27f 0 48%, #d9885b 48%, #a9534e)`,
  },
  coffee: {
    label: 'Meja kopi',
    background: `${wallpaperArt('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><path d="M0 0h1200v800H0Z" fill="#d9c3a2"/><path d="M0 570q290-110 570 0t630-10v240H0Z" fill="#a98260"/><circle cx="880" cy="325" r="195" fill="#eee3cf"/><circle cx="880" cy="325" r="145" fill="#faf4e8"/><circle cx="880" cy="325" r="95" fill="#8d5939"/><path d="M1012 295h70q82 0 70 83-10 72-78 72h-69" fill="none" stroke="#eee3cf" stroke-width="34"/><path d="M234 250h120v310H234z" rx="25" fill="#66816c"/><path d="M294 250v-92m0 92-62-60m62 60 62-72" stroke="#66816c" stroke-width="22" stroke-linecap="round"/><path d="M120 620h960" stroke="#79583f" stroke-width="18" stroke-linecap="round"/></svg>')}, linear-gradient(145deg, #e7d4b7, #b58e6e 65%, #86674f)`,
  },
} as const;

export type AdminChatWallpaperPreset = keyof typeof ADMIN_CHAT_WALLPAPERS;
export type AdminChatWallpaperSelection = AdminChatWallpaperPreset | 'custom' | 'none';

export interface AdminChatWallpaperKey {
  userId: string;
  keyId: string;
  encryptedKey: string;
}

export interface EncryptedAdminChatWallpaper {
  ciphertext: string;
  iv: string;
  image: string;
  imageIv: string;
  wrappedKeys: AdminChatWallpaperKey[];
}

export interface AdminChatWallpaperSettings {
  preset: AdminChatWallpaperSelection;
  blur: number;
  brightness: number;
  overlay: number;
  encryptedWallpaper: EncryptedAdminChatWallpaper | null;
}

export const DEFAULT_ADMIN_CHAT_WALLPAPER: AdminChatWallpaperSettings = {
  preset: 'none',
  blur: 0,
  brightness: 100,
  overlay: 0,
  encryptedWallpaper: null,
};

export function getAdminChatWallpaperBackground(preset: AdminChatWallpaperSelection, customUrl: string | null): string {
  if (preset === 'custom') return customUrl ? `url("${customUrl}")` : 'none';
  if (preset === 'none') return 'none';
  return ADMIN_CHAT_WALLPAPERS[preset].background;
}
