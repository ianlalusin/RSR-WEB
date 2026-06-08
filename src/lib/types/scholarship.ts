import type { Timestamp, FieldValue } from "firebase/firestore";

export type ScholarshipSex = 'Male' | 'Female' | 'Prefer not to say';
export type ScholarshipCivilStatus = 'Single' | 'Married' | 'Widowed' | 'Separated';
export type ScholarshipRelationship = 'Mother' | 'Father' | 'Guardian' | 'Sibling' | 'Spouse' | 'Other';
export type ScholarshipIncomeBracket =
  | 'Below ₱10,000'
  | '₱10,000–₱20,000'
  | '₱20,001–₱40,000'
  | '₱40,001–₱80,000'
  | 'Above ₱80,000';
export type ScholarshipYearLevel =
  | 'Incoming 1st Year'
  | '1st Year'
  | '2nd Year'
  | '3rd Year'
  | '4th Year'
  | '5th Year'
  | 'Graduating';

export interface ScholarshipProof {
  /** Firebase Storage path under scholarshipProofs/ (admins resolve to a URL on demand). */
  storagePath: string;
  /** Original file name chosen by the applicant (for display only). */
  fileName: string;
  /** Stored content type (images are normalized to image/jpeg after compression). */
  contentType: string;
}

export interface ScholarshipApplication {
  id: string;
  referenceNo: string;

  // Personal
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
  dateOfBirth: string;
  sex: ScholarshipSex;
  civilStatus: ScholarshipCivilStatus;

  // Contact
  homeAddress: string;
  city: string;
  province: string;
  postalCode?: string;
  mobile: string;
  email: string;

  // Parent / Guardian
  parentName: string;
  parentRelationship: ScholarshipRelationship;
  parentContact: string;
  incomeBracket: ScholarshipIncomeBracket;

  // Educational
  school: string;
  schoolOther?: string;
  course: string;
  courseOther?: string;
  yearLevel: ScholarshipYearLevel;
  expectedGraduationYear: number;

  // Proof of residency — government-issued ID of the student or guardian.
  proofOfResidency?: ScholarshipProof | null;

  // Barangay — only captured (via dropdown) when the city is Lipa City.
  barangay?: string;

  // Other scholarship grant — beneficiary of any existing grant?
  hasOtherScholarship?: boolean;
  otherScholarshipDetails?: string;

  // Priority score (0–4), computed at submit. See computePriorityScore.
  priorityScore?: number;

  // Consent
  consentGiven: boolean;

  // Eligibility (server-computed)
  isShortlisted: boolean;
  shortlistReason: string;

  // Metadata
  createdAt: Timestamp | Date | FieldValue;
  updatedAt: Timestamp | Date | FieldValue;
}

export interface ScholarshipSchool {
  school: string;
  city: string;
  courses: string[];
}

export interface ShortlistResult {
  isShortlisted: boolean;
  reason: string;
}
