'use client';

import type { UserProfile, PageKey, AccessLevel } from './types';

export const ALL_PAGE_KEYS: PageKey[] = [
  'dashboard',
  'barangays_list',
  'barangay_detail',
  'organization_orgMembers',
  'organization_departments',
  'organization_roles',
  'projects',
  'analytics',
  'profile',
  'admin_users',
];

// --- Default Access for new users ---
const defaultPages: Partial<Record<PageKey, { level: AccessLevel }>> = {};
for (const key of ALL_PAGE_KEYS) {
  if (key === 'dashboard' || key === 'profile') {
    defaultPages[key] = { level: 'readonly' };
  } else {
    defaultPages[key] = { level: 'restricted' };
  }
}
export const defaultAccess = {
  pages: defaultPages,
  districtIds: [],
};


// --- Platform admin gets full everywhere in-app (UI). Firestore rules will also bypass via claim. ---
const adminPages: Partial<Record<PageKey, { level: AccessLevel }>> = {};
for (const key of ALL_PAGE_KEYS) {
  adminPages[key] = { level: 'full' };
}
export const platformAdminAccess = {
  pages: adminPages,
  districtIds: [],
};

/**
 * Platform Admin determination:
 * - Prefer claim (passed in), because it is authoritative
 * - Fallback to profile.roleId for convenience (optional)
 */
export function isPlatformAdmin(u: UserProfile | null | undefined, isPlatformAdminClaim?: boolean): boolean {
  if (isPlatformAdminClaim === true) return true;
  return !!u && u.isActive && u.roleId === 'platformAdmin';
}

export function isOfficeAdmin(u: UserProfile | null): boolean {
  return !!u && u.isActive && u.roleId === 'officeAdmin';
}

export function canViewPage(
  u: UserProfile | null,
  page: PageKey,
  opts?: { isPlatformAdminClaim?: boolean }
): boolean {
  if (opts?.isPlatformAdminClaim === true) return true;

  if (!u?.isActive) return false;

  // hard-gate admin users page: only platform admin
  if (page === 'admin_users') return isPlatformAdmin(u, opts?.isPlatformAdminClaim);

  // safe defaults for users with no access configured yet, or with malformed data
  if (!u.access?.pages || typeof u.access.pages !== 'object' || Array.isArray(u.access.pages)) {
    return page === 'dashboard' || page === 'profile';
  }

  const pageAccess = u.access.pages[page];
  if (!pageAccess || typeof pageAccess !== 'object' || !('level' in pageAccess)) {
    return false; // Invalid access structure
  }

  return pageAccess.level !== 'restricted';
}

export function canDo(
  u: UserProfile | null,
  page: PageKey,
  action: 'read' | 'create' | 'update' | 'delete',
  opts?: { isPlatformAdminClaim?: boolean }
): boolean {
  if (opts?.isPlatformAdminClaim === true) return true;
  if (!u?.isActive) return false;

  // hard-gate admin actions page
  if (page === 'admin_users') return isPlatformAdmin(u, opts?.isPlatformAdminClaim);
  
  // More robust check for malformed pages object
  if (!u.access?.pages || typeof u.access.pages !== 'object' || Array.isArray(u.access.pages)) {
    return false;
  }

  const level = u.access.pages?.[page]?.level ?? 'restricted';

  if (level === 'full') return true;
  if (level === 'readwrite') return action !== 'delete';
  if (level === 'readonly') return action === 'read';

  return false;
}

export function hasDistrictScope(
  u: UserProfile | null | undefined,
  districtId: string,
  opts?: { isPlatformAdminClaim?: boolean }
): boolean {
  if (opts?.isPlatformAdminClaim === true) return true;
  if (!u || !u.isActive) return false;
  return u.access?.districtIds?.includes(districtId) ?? false;
}
