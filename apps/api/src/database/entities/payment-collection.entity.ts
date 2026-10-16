/** Counter / bank / MFS channels (plan Phase 4). */
export type PaymentChannel =
  | 'CASH'
  | 'BANK_CHALLAN'
  | 'BKASH'
  | 'NAGAD'
  | 'ROCKET'
  | 'UPAY'
  | 'SSLCOMMERZ'
  | 'EKPAY';

export const PAYMENT_CHANNELS: PaymentChannel[] = [
  'CASH',
  'BANK_CHALLAN',
  'BKASH',
  'NAGAD',
  'ROCKET',
  'UPAY',
  'SSLCOMMERZ',
  'EKPAY',
];

/** Gateways that settle via a clearing account before hitting the bank. */
export const MFS_CHANNELS: PaymentChannel[] = [
  'BKASH',
  'NAGAD',
  'ROCKET',
  'UPAY',
  'SSLCOMMERZ',
  'EKPAY',
];

/** Clearing GL per MFS channel (spec §2 seed list). */
export const CLEARING_GL_BY_CHANNEL: Partial<Record<PaymentChannel, string>> = {
  BKASH: '11301',
  NAGAD: '11302',
  ROCKET: '11302',
  UPAY: '11303',
  SSLCOMMERZ: '11303',
  EKPAY: '11303',
};

/** Default TDR % per channel (editable per receipt at the counter). */
export const DEFAULT_TDR_PERCENT: Record<PaymentChannel, number> = {
  CASH: 0,
  BANK_CHALLAN: 0,
  BKASH: 1.0,
  NAGAD: 0.8,
  ROCKET: 1.0,
  UPAY: 1.0,
  SSLCOMMERZ: 2.0,
  EKPAY: 1.0,
};

export type ReconciliationStatus = 'COLLECTED' | 'PENDING' | 'SETTLED' | 'REVERSED';

export const RECONCILIATION_STATUSES: ReconciliationStatus[] = [
  'COLLECTED',
  'PENDING',
  'SETTLED',
  'REVERSED',
];
