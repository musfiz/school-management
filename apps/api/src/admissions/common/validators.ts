/**
 * Phase 1 — Bangladeshi BRN / NID validators (Plan Phase 1, common/).
 * BRN: 17-digit birth certificate number. NID: 10-digit (smart card),
 * 13-digit or 17-digit legacy numbers. Digits only (spaces/dashes stripped).
 */

const digitsOnly = (v: string): string => (v ?? '').replace(/\D/g, '');

/** 17-digit Bangladesh Birth Registration Number. */
export function isValidBrn(raw: string): boolean {
  return /^\d{17}$/.test(digitsOnly(raw));
}

/** 10 / 13 / 17-digit Bangladesh National ID. */
export function isValidNid(raw: string): boolean {
  const d = digitsOnly(raw);
  return d.length === 10 || d.length === 13 || d.length === 17;
}

/** BD mobile: 01XXXXXXXXX (also accepts +880 / 880 prefixes). */
export function isValidBdPhone(raw: string): boolean {
  let d = digitsOnly(raw);
  if (d.length === 13 && d.startsWith('880')) d = `0${d.slice(3)}`;
  else if (d.length === 12 && d.startsWith('88')) d = `0${d.slice(2)}`;
  return /^01\d{9}$/.test(d);
}
