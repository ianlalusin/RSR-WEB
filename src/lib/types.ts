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

// NEW: PageKeys for granular page access
export type PageKey =
  | 'dashboard'
  | 'barangays_list'
  | 'barangay_detail'
  | 'organization_orgMembers'
  | 'organization_departments'
  | 'organization_roles'
  | 'projects'
  | 'projects_medical'
  | 'analytics'
  | 'profile'
  | 'admin_users';

// NEW: Access levels for pages
export type AccessLevel = 'restricted' | 'readonly' | 'readwrite' | 'full';

// NEW: Structure for page-specific access
export interface PageAccess {
  level: AccessLevel;
}

// UPDATED: UserProfile with new access control model
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isActive: boolean;
  
  departmentId?: string; // e.g., 'finance', 'operations'
  roleId?: string;   // e.g., 'platformAdmin', 'officeAdmin'

  // NEW: Centralized access control object
  access: {
    pages: Partial<Record<PageKey, PageAccess>>;
    districtIds: string[];
  };

  // DEPRECATED: Old permission fields (can be removed after migration)
  roles?: UserRole[];
  permissions?: { [key: string]: boolean };

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

export interface BarangayListItem {
  name: string;
  districtId: string;
  districtName: string;
  population: number;
  votingPopulation: number;
  rsrVotes: number;
  favoredVotePct: number;
  isWin: boolean;
}

export interface BarangayListDoc {
    barangays: Record<string, BarangayListItem>;
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

// UPDATED: Department is now just metadata
export interface Department {
  id: string;
  name: string;
  description?: string;
  pageVisibility?: Partial<Record<PageKey, boolean>>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DepartmentListItem {
  name: string;
  description?: string;
  pageVisibility?: Partial<Record<PageKey, boolean>>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DepartmentListDoc {
  departments: Record<string, DepartmentListItem>;
}

// UPDATED: Role is now just metadata
export interface Role {
  id: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RoleListItem {
    name: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface RoleListDoc {
    roles: Record<string, RoleListItem>;
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

export type AuditLogAction = 'access_update' | 'create' | 'update' | 'delete' | 'bulk_update' | 'generate_ai_profile';
export type AuditLogEntityType = 'user' | 'barangay' | 'captainProfile' | 'projectRecord' | 'medicalRecord' | 'department' | 'role' | 'system';

export interface AuditLog {
    id?: string;
    actorUid: string;
    actorEmail: string | null;
    action: AuditLogAction;
    entityType: AuditLogEntityType;
    entityId: string;
    districtId?: string;
    details?: any;
    timestamp: Timestamp;
}

export type MedicalProjectType = 'medical_drive' | 'medical_assistance';
export type MedicalAssistanceType = 'operation' | 'checkup' | 'dental' | 'medicine' | 'other';

export interface MedicalRecord {
  id: string;
  projectId: string;
  projectType: MedicalProjectType;
  districtId: string;
  districtName: string;
  brgyId: string;
  brgyName: string;
  
  // Medical Drive fields
  title?: string;
  description?: string;
  beneficiaryCount?: number;
  
  // Medical Assistance fields
  fullName?: string;
  householdSize?: number;
  hospital?: string;
  assistanceType?: MedicalAssistanceType;
  referralDetails?: {
    coordinatorId: string;
    coordinatorName: string;
    dateReferred: Timestamp;
    dateApproved: Timestamp;
  };
  
  eventDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUid: string;
}
