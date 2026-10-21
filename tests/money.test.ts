import { describe, expect, it } from 'vitest';
import { formatAmount, parseAmount } from '../src/lib/money';

describe('parseAmount', () => {
  it.each([
    ['1200', 120000],
    ['1,200.5', 120050],
    ['1.15', 115], // parseFloat('1.15') * 100 === 114.99999999999999
    ['0.1', 10],
    ['١٢٠٠', 120000], // Arabic-Indic digits
    ['١٢٠٠٫٥٠', 120050], // Arabic decimal separator
    [' 50 ', 5000],
  ])('%s → %i', (input, expected) => expect(parseAmount(input)).toBe(expected));

  it.each(['', 'abc', '0', '-5', '1.234', '1.2.3'])('rejects %j', (input) => expect(parseAmount(input)).toBeNull());
});

describe('formatAmount', () => {
  it('formats', () => {
    expect(formatAmount(120050)).toBe('1,200.50');
    expect(formatAmount(5)).toBe('0.05');
    expect(formatAmount(-60000)).toBe('-600.00');
  });
});
