'use server';

import type { Timestamp, FieldValue } from "firebase/firestore";

export type UserRole = 'platformAdmin' | 'oic' | 'officeAdmin' | 'coordinator' | 'socmed';

// NEW: PageKeys for granular page access
export type PageKey =
  | 'dashboard'
  | 'barangays_list'
  | 'barangay_detail'
  | 'organization_orgMembers'
  | 'organization_departments'
  | 'organization_roles'
  | 'receiving'
  | 'projects_medical'
  | 'projects_hospitals'
  | 'projects_educational'
  | 'projects_infrastructure'
  | 'analytics'
  | 'profile'
  | 'tasker'
  | 'admin_users'
  | 'socmed'
  | 'scholarship_providers'
  | 'scholarship_applications'
  | 'scholarship_scholars'
  | 'scholarship_portal';

// NEW: Access levels for pages
export type AccessLevel = 'restricted' | 'readonly' | 'readwrite' | 'full';

// NEW: Structure for page-specific access
export interface PageAccess {
  level: AccessLevel;
}

export type SocmedRole = 'Admin' | 'Manager' | 'Validator' | 'Checker' | 'Agent';

export interface SocmedGroup {
  id: string;
  name: string;
  description?: string;
  agentIds: string[];
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
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
    // Barangay-level scope (used when the role's scopeBreadth is 'own_barangays',
    // e.g. coordinators). Optional until populated per user.
    barangayIds?: string[];
    // Resolved location scope tier, denormalized from the user's role so that
    // firestore.rules can enforce record scope without recomputing role logic.
    // Written server-side whenever roleId changes.
    scopeBreadth?: ScopeBreadth;
  };

  socmedRole?: SocmedRole;

  createdAt: Timestamp | Date | FieldValue;
  updatedAt: Timestamp | Date | FieldValue;
}


export interface District {
  id: string;
  name: string;
  isActive: boolean;
}

export interface BarangayCycleStats {
  votingPopulation: number;
  rsrVotes: number;
  favoredVotePct: number;
  isWin: boolean;
}

export interface Barangay {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  population: number;
  congVisitCount: number;
  coordinatorUids?: string[];
  currentCycle: string;
  currentStats: BarangayCycleStats;
  // Legacy flat fields — kept readable on existing docs until migration completes.
  votingPopulation?: number;
  rsrVotes?: number;
  favoredVotePct?: number;
  isWin?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BarangayListItem {
  name: string;
  districtId: string;
  districtName: string;
  population: number;
  currentCycle: string;
  votingPopulation: number;
  rsrVotes: number;
  favoredVotePct: number;
  isWin: boolean;
}

export interface BarangayListDoc {
    barangays: Record<string, BarangayListItem>;
}

export interface CaptainInfo {
  name: string;
  photoURL?: string;
  address?: string;
  contact?: string;
  birthday?: string;
  age?: number;
  email?: string;
}

export interface CaptainProfile {
  captain: CaptainInfo;
  secretary: { name?: string; contact?: string; };
  councilors?: { name: string; contact?: string; }[];
  updatedAt: Timestamp;
  updatedByUid: string;
  updatedByEmail: string | null;
  createdAt?: Timestamp;
  createdByUid?: string;
  createdByEmail?: string | null;
}

export interface BarangayCycle {
  id: string;
  year: string;
  votingPopulation: number;
  rsrVotes: number;
  favoredVotePct: number;
  isWin: boolean;
  captain: CaptainInfo;
  secretary: { name?: string; contact?: string; };
  councilors?: { name: string; contact?: string; }[];
  createdAt: Timestamp;
  createdByUid: string;
  createdByEmail: string | null;
  updatedAt: Timestamp;
  updatedByUid: string;
  updatedByEmail: string | null;
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

// Location scope tiers (a role property):
//   all_districts  — sees everything (office staff, OIC, platform admin)
//   own_districts  — sees all barangays within assigned districtIds (district lead)
//   own_barangays  — sees only assigned barangayIds (coordinator)
//   none           — no access to location-tagged records (everyone else)
export type ScopeBreadth = 'own_districts' | 'own_barangays' | 'all_districts' | 'none';

export interface Role {
  id: string;
  name: string;
  rank: number;
  scopeBreadth: ScopeBreadth;
  preset?: Partial<Record<PageKey, AccessLevel>>;
  isBuiltIn: boolean;
  status: 'active' | 'archived';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RoleListItem {
  name: string;
  rank: number;
  scopeBreadth: ScopeBreadth;
  preset?: Partial<Record<PageKey, AccessLevel>>;
  isBuiltIn: boolean;
  status: 'active' | 'archived';
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

export type AuditLogAction = 'access_update' | 'create' | 'update' | 'delete' | 'bulk_update' | 'generate_ai_profile' | 'status_change' | 'view' | 'export';
export type AuditLogEntityType = 'user' | 'barangay' | 'barangayCycle' | 'captainProfile' | 'projectRecord' | 'medicalRecord' | 'department' | 'role' | 'hospital' | 'request' | 'task' | 'system' | 'scholarshipApplication';

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

// ---- Tasker ----
export type TaskStatus = 'created' | 'assigned' | 'acknowledged' | 'doing' | 'done' | 'failed' | 'voided';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const TASK_COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'] as const;
export type TaskColor = typeof TASK_COLORS[number];

export interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  color: TaskColor;
  assigneeUids: string[];
  assigneeNames: string[];
  dueDate?: Timestamp;
  tags?: string[];
  createdByUid: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---- Request / Receiving workflow ----
export type RequestStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export type MedicalSubCategory = 'medical_assistance' | 'accredited_hospitals' | 'financial_standing';
export type EducationalSubCategory = 'ched_tulong_dunong' | 'cong_scholarship';
export type SubCategory = MedicalSubCategory | EducationalSubCategory | string;

export interface RequestRecord {
  id: string;
  districtId: string;
  districtName: string;
  brgyId: string;
  brgyName: string;
  proponents: string;
  resoTitle: string;
  resoNumber?: string;
  description?: string;
  dateReceived: Timestamp;
  dateFiled: Timestamp;
  sector: ProjectSector;
  subCategory?: SubCategory;
  status: RequestStatus;
  reviewNotes?: string;
  reviewedByUid?: string;
  reviewedAt?: Timestamp;
  createdByUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  contact?: string;
  address?: string;
  birthday?: string;
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


export interface Hospital {
  id: string;
  name: string;
  address?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HospitalListItem {
  name: string;
  address?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HospitalListDoc {
  hospitals: Record<string, HospitalListItem>;
}
