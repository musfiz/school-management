import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

/**
 * CC-20 decimal storage discipline: read persisted values as strings/Decimals,
 * compute with decimal.js, write strings. Shared by the Result Engine modules.
 */
export function dec(value: Decimal.Value | null | undefined, tag = 'value'): Decimal {
  let d: Decimal;
  try {
    d = new Decimal(value == null || value === '' ? '0' : value);
  } catch {
    throw new BadRequestException(`${tag} "${value}" is not a valid decimal`);
  }
  if (!d.isFinite() || d.isNegative()) {
    throw new BadRequestException(`${tag} must be a non-negative number`);
  }
  return d;
}

export function round2(d: Decimal): Decimal {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** `round2` + fixed 2-dp string, ready for a DECIMAL(_,2) column. */
export function fmt2(value: Decimal.Value): string {
  return round2(dec(value)).toFixed(2);
}
