/** Workflow 1 types — mirror of FamilyRegistryService return shape. */

export interface FamilyProfile {
  id: string;
  familyCode: string;
  primaryGuardianPhone: string;
  fatherNameEn: string;
  fatherNameBn?: string | null;
  fatherNid?: string | null;
  fatherOccupation?: string | null;
  fatherMonthlyIncome: string;
  isFatherDeceased: boolean;
  motherNameEn: string;
  motherNameBn?: string | null;
  motherNid?: string | null;
  motherPhone?: string | null;
  motherOccupation?: string | null;
  localGuardianName?: string | null;
  localGuardianRelation?: string | null;
  localGuardianPhone?: string | null;
  localGuardianNid?: string | null;
  presentAddress: string;
  permanentAddress?: string | null;
  upazilaThana?: string | null;
  district?: string | null;
  isZakatEligibleFamily: boolean;
}

/** A student belonging to a family (directory sibling-linkage viewer). */
export interface FamilyChild {
  studentId: string;
  studentUniqueId: string;
  name: string;
  nameBn: string | null;
  gender: string;
  currentStatus: string;
  admissionDate: string;
  photoUrl: string | null;
  classOrDeptId: string | null;
  sectionOrBatchId: string | null;
  classRollNo: number | null;
  academicGroup: string | null;
  residenceType: string | null;
  quotaTag: string | null;
  isActiveEnrollment: boolean;
}

/** Phase 2 — directory row: family profile + multi-sibling linkage. */
export interface FamilyDirectoryRow extends FamilyProfile {
  childCount: number;
  activeChildCount: number;
  children: FamilyChild[];
}

export interface ActiveSibling {
  studentId: string;
  studentUniqueId: string;
  name: string;
  status: string;
  classOrDeptId: string | null;
  sectionOrBatchId: string | null;
  classRollNo: number | null;
  academicGroup: string | null;
}

export interface SiblingWaiverSuggestion {
  waiverType: "SIBLING";
  admissionFeePct: number;
  tuitionFeePct: number;
  reason: string;
}

export type FamilyLookupResult =
  | { found: false; query: string }
  | {
      found: true;
      family: FamilyProfile;
      activeSiblings: ActiveSibling[];
      suggestedWaiver: SiblingWaiverSuggestion | null;
    };

/** Workflow 2 — calculator suggestion (mirrors WaiverCalculatorService). */
export interface WaiverSuggestion {
  ruleCode: string;
  ruleName: string;
  waiverType: string;
  admissionFeePct: string;
  tuitionFeePct: string;
  requiresZakatEligible: boolean;
  allowed: boolean;
  reason: string | null;
}

export interface WaiverPresetRule {
  id: string;
  ruleCode: string;
  ruleName: string;
  institutionType?: string | null;
  minGpa?: string | null;
  maxGpa?: string | null;
  quotaTag?: string | null;
  residenceType?: string | null;
  waiverType: string;
  admissionFeePct: string;
  tuitionFeePct: string;
  requiresZakatEligible: boolean;
  priority: number;
  isActive: boolean;
  remark?: string | null;
}

/** Workflow 2/4 — calculator + confirm inputs. */
export interface WaiverInputs {
  prevGpa?: string;
  institutionType?: string;
  quotaTag?: string;
  residenceType?: string;
}

/** Workflow 4 — wizard placement carried from Step 3. */
export interface PlacementMeta {
  sessionId: string;
  classId: string;
  group: string;
  shiftId: string;
  sectionId: string;
  subjectIds: string[];
}

/** Workflow 4 — fee suggestion row. */
export interface FeeSuggestItem {
  feeHeadId: string;
  headCode: string;
  headName: string;
  billingType: string;
  grossAmount: string;
  isCautionDeposit: boolean;
}

export interface FeePreviewLine {
  feeHeadId: string;
  headCode: string;
  headName: string;
  gross: string;
  waiver: string;
  net: string;
  isCautionDeposit: boolean;
}

export interface FeePreview {
  lines: FeePreviewLine[];
  appliedWaivers: Array<{ ruleCode: string; waiverType: string; admissionFeePct: string; tuitionFeePct: string }>;
  totals: { gross: string; waiver: string; net: string };
}

export interface ConfirmResult {
  studentId: string;
  studentUniqueId: string;
  familyId: string;
  familyCode: string;
  classRollNo: number;
  invoiceId: string;
  invoiceNo: string;
  grossAmount: string;
  waiverAmount: string;
  netAmount: string;
  moneyReceiptNo: string | null;
  receiptId: string | null;
  applicationId: string | null;
  applicationNo: string | null;
}

/** Phase 4 — Step 2 identity state (react-hook-form model, mirrors StudentIdentityDto). */export interface IdentityState {
  fullNameEn: string;
  fullNameBn: string;
  gender: string;
  dateOfBirth: string;
  birthRegNo: string;
  nationalIdNo: string;
  religion: string;
  bloodGroup: string;
  photoUrl: string;
  medicalAllergyNotes: string;
  pickupGuardianName: string;
  pickupGuardianPhone: string;
  admissionDate: string;
}

/** Phase 4 — one previous-exam table row. */
export interface PrevEduRow {
  key: string;
  examTitle: string;
  instituteName: string;
  educationBoard: string;
  academicGroup: string;
  rollNo: string;
  regNo: string;
  passingYear: string;
  gpaObtained: string;
  tcNumber: string;
}

/** Phase 4 — Step 4 stay extras (stipend + boarding/transport, seat masters later). */
export interface StayExtras {
  stipendMfsType: string;
  stipendAccountNo: string;
  hostelSeatId: string;
  transportRouteId: string;
}

export const EMPTY_IDENTITY: IdentityState = {
  fullNameEn: "",
  fullNameBn: "",
  gender: "",
  dateOfBirth: "",
  birthRegNo: "",
  nationalIdNo: "",
  religion: "",
  bloodGroup: "",
  photoUrl: "",
  medicalAllergyNotes: "",
  pickupGuardianName: "",
  pickupGuardianPhone: "",
  admissionDate: "",
};

export const EMPTY_EXTRAS: StayExtras = {
  stipendMfsType: "",
  stipendAccountNo: "",
  hostelSeatId: "",
  transportRouteId: "",
};

/** Phase 2 — campaign + application (mirrors backend entities). */
export interface AdmissionCampaign {
  id: string;
  academicSessionId: string;
  classOrDeptId: string;
  campaignTitle: string;
  applicationFee: string;
  totalSeats: number;
  minRequiredGpa: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface AdmissionApplication {
  id: string;
  applicationNo: string;
  campaignId: string;
  campaign?: AdmissionCampaign | null;
  applicantNameEn: string;
  applicantNameBn?: string | null;
  gender: string;
  dateOfBirth: string;
  birthRegNo?: string | null;
  guardianPhone: string;
  prevExamName?: string | null;
  prevBoard?: string | null;
  prevRollNo?: string | null;
  prevRegNo?: string | null;
  prevPassingYear?: number | null;
  prevGpa?: string | null;
  admissionTestMarks: string;
  meritRank?: number | null;
  quotaApplied?: string | null;
  formFeePaid: boolean;
  status: string;
  admittedStudentId?: string | null;
}

/** Workflow 3 — syllabus preview row (mirrors SubjectEnrollmentService). */
export interface SubjectPreviewRow {
  syllabusSubjectId: string;
  subjectCode: string;
  subjectName: string;
  paperNumber: number | null;
  combinedGroupCode: string | null;
  combinedGroupName: string | null;
  defaultRole: string;
  creditHours: string;
  fullMarks: string;
  locked: boolean;
}

export interface SubjectPreview {
  compulsory: SubjectPreviewRow[];
  groupElectives: SubjectPreviewRow[];
  otherElectives: SubjectPreviewRow[];
  fourthOptions: SubjectPreviewRow[];
  nonCredit: SubjectPreviewRow[];
  requiresFourth: boolean;
  creditMode: boolean;
  totalCredits: string;
  lockedIds: string[];
}

/* ================= Phase 5 — student directory, clearance, TC ================= */

export interface StudentEnrollmentRow {
  id: string;
  academicSessionId: string;
  institutionType: string;
  classOrDeptId: string;
  sectionOrBatchId: string | null;
  academicGroup: string;
  classRollNo: number;
  residenceType: string;
  quotaTag: string;
  enrollmentType?: string;
}

export interface StudentDirectoryRow {
  id: string;
  studentUniqueId: string;
  fullNameEn: string;
  fullNameBn: string | null;
  gender: string;
  currentStatus: string;
  admissionDate: string;
  photoUrl: string | null;
  arBalance: string;
  feeDue: boolean;
  enrollment: StudentEnrollmentRow | null;
}

export interface StudentClearance {  studentId: string;
  studentUniqueId: string;
  currentStatus: string;
  arBalance: string;
  cautionHeld: string;
  canIssueTc: boolean;
  blockers: string[];
}

export interface TcResult {
  studentId: string;
  studentUniqueId: string;
  status: string;
  tcNumber: string;
  tcIssueDate: string;
  arBalance: string;
  cautionHeld: string;
  duesWaived: boolean;
  overrideReason: string | null;
}

export interface StudentProfile {
  student: {
    id: string;
    studentUniqueId: string;
    fullNameEn: string;
    fullNameBn?: string | null;
    gender: string;
    dateOfBirth: string;
    birthRegNo?: string | null;
    nationalIdNo?: string | null;
    religion: string;
    bloodGroup?: string | null;
    photoUrl?: string | null;
    currentStatus: string;
    admissionDate: string;
    tcNumber?: string | null;
    tcIssueDate?: string | null;
  };
  family: FamilyProfile | null;
  enrollments: StudentEnrollmentRow[];
  previousEducations: Array<{
    id: string;
    examTitle: string;
    instituteName: string;
    educationBoard?: string | null;
    academicGroup?: string | null;
    rollNo?: string | null;
    regNo?: string | null;
    passingYear?: number | null;
    gpaObtained?: string | null;
    tcNumber?: string | null;
  }>;
  documents: Array<{ id: string; documentType: string; fileUrl: string; isOriginalSubmitted: boolean }>;
  arBalance: string;
}

/** Phase 5 — directory filter dropdown option (derived from active enrollments). */
export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface StudentFilterOptions {
  sessions: FilterOption[];
  classes: FilterOption[];
  sections: FilterOption[];
}

/* ================= Admission dashboard (Plan §2) ================= */

export interface AdmissionDashboardKpis {
  activeCampaigns: number;
  totalSeats: number;
  totalEnrolled: number;
  seatsRemaining: number;
  fillPct: number;
  totalApplications: number;
  todayAdmissions: number;
  pendingFeeCount: number;
  pendingFeeAmount: string;
}

export interface CampaignSeatRow {
  id: string;
  campaignTitle: string;
  academicSessionId: string;
  classOrDeptId: string;
  totalSeats: number;
  applications: number;
  admitted: number;
  enrolled: number;
  remaining: number;
  fillPct: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

export interface TodayAdmissionRow {
  studentId: string;
  studentUniqueId: string;
  fullNameEn: string;
  gender: string;
  classOrDeptId: string | null;
  sectionOrBatchId: string | null;
  classRollNo: number | null;
  academicGroup: string | null;
}

export interface PendingFeeRow {
  invoiceId: string;
  invoiceNo: string;
  studentId: string;
  studentUniqueId: string;
  fullNameEn: string;
  billingPeriod: string;
  dueDate: string;
  netAmount: string;
  paidAmount: string;
  outstanding: string;
  overdue: boolean;
}

export interface AdmissionDashboardOverview {
  today: string;
  generatedAt: string;
  kpis: AdmissionDashboardKpis;
  applicationStatus: Array<{ status: string; count: number }>;
  campaigns: CampaignSeatRow[];
  todayAdmissions: TodayAdmissionRow[];
  pendingFees: PendingFeeRow[];
}

/* ================= Phase 5 — documents & verification ================= */

export interface StudentDocumentRow {
  id: string;
  studentId: string;
  documentType: string;
  fileUrl: string;
  isOriginalSubmitted: boolean;
  verifiedBy: string | null;
  uploadedAt: string;
}

export interface StudentDocumentChecklist {
  student: {
    id: string;
    studentUniqueId: string;
    fullNameEn: string;
    fullNameBn: string | null;
    currentStatus: string;
    classOrDeptId: string | null;
    sectionOrBatchId: string | null;
  };
  documents: StudentDocumentRow[];
  types: string[];
}

export interface DocumentSummaryRow {
  studentId: string;
  studentUniqueId: string;
  fullNameEn: string;
  currentStatus: string;
  classOrDeptId: string | null;
  sectionOrBatchId: string | null;
  uploaded: number;
  verified: number;
  pending: number;
  originalsHeld: number;
}

export interface DocumentSummary {
  types: string[];
  rows: DocumentSummaryRow[];
  totals: { students: number; uploaded: number; verified: number; pending: number; originalsHeld: number };
}
