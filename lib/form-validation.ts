export function isValidOptionalPhoneNumber(value: string): boolean {
  const phone = value.trim();
  if (!phone) return true;
  if (!/^\+?[0-9().\s-]+$/.test(phone)) return false;

  const digitCount = phone.replace(/\D/g, '').length;
  return digitCount >= 8 && digitCount <= 15;
}

export function isPositiveAmount(value: string | number): boolean {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount > 0;
}
