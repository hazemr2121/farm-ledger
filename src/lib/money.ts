import type { Minor } from '../db';

// Arabic-Indic (٠-٩) and Persian (۰-۹) digits → ASCII, so typing on an Arabic keyboard works.
const DIGITS: Record<string, string> = {};
'٠١٢٣٤٥٦٧٨٩'.split('').forEach((d, i) => (DIGITS[d] = String(i)));
'۰۱۲۳۴۵۶۷۸۹'.split('').forEach((d, i) => (DIGITS[d] = String(i)));

export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d]).replace(/٫/g, '.').replace(/[٬,\s]/g, '');
}

/**
 * "1,200.5" → 120050. Returns null for anything that isn't a positive amount
 * with at most 2 decimals. Built from string parts, never `parseFloat(x) * 100`,
 * because 1.15 * 100 === 114.99999999999999 in floating point.
 */
export function parseAmount(input: string): Minor | null {
  const s = normalizeDigits(input.trim());
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? '').padEnd(2, '0'));
  const minor = whole * 100 + frac;
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  return minor;
}

/** 120050 → "1,200.50" (negative amounts get a leading minus). */
export function formatAmount(minor: Minor): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

/** For Excel cells: a real number so SUM() works there. Only for export, never for math here. */
export const toMajor = (minor: Minor) => minor / 100;
