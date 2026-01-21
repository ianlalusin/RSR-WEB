'use server';

import type { Timestamp } from "firebase/firestore";

export type UserRole =
  | 'admin'
  | 'office'
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
  photoURL?: string | null;
  roles: UserRole[];
  permissions: { [key: string]: boolean };
  departments?: string[];
  districtIds?: string[];
  coordinatorBrgyIds?: string[];
  isActive: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
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
  rsrVotes: number;
  favoredVotePct: number;
  isWin: boolean;
  congVisitCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CaptainProfile {
  captain: {
    name: string;
    photoURL?: string | null;
    address: string;
    contact: string;
    birthday: string;
    age: number;
    email: string;
  };
  secretary: { name: string; contact: string; };
  councilors: { name: string; contact: string; }[];
  updatedAt: Timestamp;
  updatedByUid: string;
  updatedByEmail: string | null;
  createdAt?: Timestamp;
  createdByUid?: string;
  createdByEmail?: string | null;
}

export interface Coordinator {
  id: string;
  employmentId: string;
  name: string;
  address: string;
  contact: string;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  birthday: Timestamp;
  departmentId: string; // Should link to Department.id
  role: string;
  employmentStartDate: Timestamp;
  status: 'active' | 'inactive' | 'on_leave';
  createdAt: Timestamp;
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

export type ProjectSector = "medical" | "educational" | "infrastructure";
export type ValueType = "cash" | "in-kind" | "service";
export type RecordStatus = "draft" | "submitted" | "approved" | "released" | "archived";

export interface ProjectRecord {
  id: string;
  brgyIds: string[];
  districtIds: string[];
  sector: ProjectSector;
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

export type PermissionKey = 'barangays' | 'barangayCaptain' | 'coordinators' | 'projects' | 'users';

export type DepartmentPermissions = {
  read?: boolean;
  add?: boolean;
  edit?: boolean;
  delete?: boolean;
};

export type DepartmentScope = 'department' | 'district' | 'brgy';

export interface Department {
  id: string;
  name: string;
  description?: string;
  headUid?: string;
  scopes?: DepartmentScope[];
  permissions?: Partial<Record<PermissionKey, DepartmentPermissions>>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PositionBranch = 'office' | 'field';

export interface Position {
  id: string;
  name: string;
  branch: PositionBranch;
  departmentIds?: string[];
  scopes?: DepartmentScope[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}


export interface GlobalAnalytics {
    totalBarangays: number;
    totalCoordinators: number;
    totalRecords: number;
    budgetTotal: number;
    expensesTotal: number;
    sectorBreakdown: Record<ProjectSector, number>;
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

export interface DepartmentAnalytics {
    name: string;
    memberCount: number;
}

export interface AnalyticsData {
    brgyWithProfileCount: number;
    userCount: number;
    departmentCount: number;
    projectCount: number;
    departments: DepartmentAnalytics[];
}
