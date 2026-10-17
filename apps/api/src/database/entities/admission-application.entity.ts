export type AdmissionApplicationStatus =
  | 'APPLIED'
  | 'SHORTLISTED'
  | 'WAITING'
  | 'ADMITTED'
  | 'REJECTED';

export const ADMISSION_APPLICATION_STATUSES: AdmissionApplicationStatus[] = [
  'APPLIED',
  'SHORTLISTED',
  'WAITING',
  'ADMITTED',
  'REJECTED',
];
