import type { Timestamp } from "firebase/firestore";

export type UserRole =
  | 'admin'
  | 'oic'
  | 'auditor'
  | 'procurement'
  | 'dept_admin_finance'
  | 'dept_admin_marketing'
  | 'dept_admin_operations_office'
  | 'district_head'
  | 'district_assistant'
  | 'coordinator';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  roles: UserRole[];
  permissions: { [key: string]: boolean };
  departments?: string[];
  districtIds?: string[];
  coordinatorBrgyIds?: string[];
  isActive: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  photoURL?: string;
}

export interface District {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Barangay {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  population: number;
  votingPopulation: number;
  favoredVotePct: number;
  isWin: boolean;
  congVisitCount: number;
  coordinatorUids: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CaptainProfile {
  captain: { name: string; address: string; contact: string; birthday: string; age: number; email: string; };
  secretary: { name: string; contact: string; };
  councilors: { name: string; contact: string; }[];
  updatedAt: Timestamp;
}

export interface Coordinator {
  id: string;
  name: string;
  address: string;
  contact: string;
  districtId: string;
  status: 'active' | 'inactive';
  assignedBrgyIds: string[];
  lastReportAt: Timestamp | null;
  reportCount: number;
  updatedAt: Timestamp;
}

export interface CoordinatorReport {
  id: string;
  coordinatorId: string;
  brgyId: string;
  districtId: string;
  title: string;
  notes: string;
  createdByUid: string;
  createdAt: Timestamp;
}

export type AssistanceSector = "medical" | "educational" | "infrastructure";
export type ValueType = "cash" | "in-kind" | "service";
export type RecordStatus = "draft" | "submitted" | "approved" | "released" | "archived";

export interface AssistanceRecord {
  id: string;
  brgyId: string;
  districtId: string;
  sector: AssistanceSector;
  departmentId?: string;
  title: string;
  description: string;
  beneficiaryCount: number;
  valueAmount: number;
  valueType: ValueType;
  status: RecordStatus;
  eventDate: Timestamp;
  createdByUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GlobalAnalytics {
    totalBarangays: number;
    totalCoordinators: number;
    totalRecords: number;
    budgetTotal: number;
    expensesTotal: number;
    sectorBreakdown: Record<AssistanceSector, number>;
    districtBreakdown: Record<string, { totalRecords: number; budget: number; expenses: number }>;
}

export interface GeneratedProfile {
  name: string;
  age: number;
  occupation: string;
  votedForFavored: boolean;
  income: number;
  [key: string]: any;
}
