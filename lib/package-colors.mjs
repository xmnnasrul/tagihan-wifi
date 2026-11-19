/**
 * @typedef {'blue' | 'green' | 'amber' | 'red' | 'violet'} PackageColor
 */

/** @type {readonly PackageColor[]} */
export const PACKAGE_COLOR_IDS = ['blue', 'green', 'amber', 'red', 'violet'];

/** @type {Record<PackageColor, { label: string; pill: string; text: string; swatch: string }>} */
const PACKAGE_COLOR_STYLES = {
  blue: {
    label: 'Biru',
    pill: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300',
    text: 'text-sky-700 dark:text-sky-300',
    swatch: 'bg-sky-600',
  },
  green: {
    label: 'Hijau',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-300',
    swatch: 'bg-emerald-600',
  },
  amber: {
    label: 'Kuning',
    pill: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
    text: 'text-amber-800 dark:text-amber-300',
    swatch: 'bg-amber-500',
  },
  red: {
    label: 'Merah',
    pill: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300',
    text: 'text-rose-700 dark:text-rose-300',
    swatch: 'bg-rose-600',
  },
  violet: {
    label: 'Ungu',
    pill: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-300',
    text: 'text-violet-700 dark:text-violet-300',
    swatch: 'bg-violet-600',
  },
};

const NEUTRAL_PILL = 'border-border bg-muted text-muted-foreground';
const NEUTRAL_TEXT = 'text-muted-foreground';

/** @param {unknown} value @returns {value is PackageColor} */
export function isPackageColor(value) {
  return typeof value === 'string' && PACKAGE_COLOR_IDS.includes(/** @type {PackageColor} */ (value));
}

/** @param {string | null | undefined} color */
export function getPackageColorClasses(color) {
  return isPackageColor(color) ? PACKAGE_COLOR_STYLES[color].pill : NEUTRAL_PILL;
}

/** @param {string | null | undefined} color */
export function getPackageColorTextClass(color) {
  return isPackageColor(color) ? PACKAGE_COLOR_STYLES[color].text : NEUTRAL_TEXT;
}

/** @param {string | null | undefined} color */
export function getPackageColorLabel(color) {
  return isPackageColor(color) ? PACKAGE_COLOR_STYLES[color].label : 'Netral';
}

export const PACKAGE_COLOR_OPTIONS = PACKAGE_COLOR_IDS.map((id) => ({
  id,
  label: PACKAGE_COLOR_STYLES[id].label,
  swatch: PACKAGE_COLOR_STYLES[id].swatch,
}));
