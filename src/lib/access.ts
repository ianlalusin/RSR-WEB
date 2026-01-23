'use client';

import type { UserProfile, PageKey, AccessLevel } from './types';

export const ALL_PAGE_KEYS: PageKey[] = [
  'dashboard',
  'barangays_list',
  'barangay_detail',
  'organization_orgMembers',
  'organization_departments',
  'organization_positions',
  'assistance_projects',
  'analytics',
  'profile',
  'admin_users',
];

export const defaultAccess = {
  pages: ALL_PAGE_KEYS.reduce((acc, key) => {
    if (key === 'dashboard' || key === 'profile') {
      acc[key] = { level: 'readonly' as AccessLevel };
    } else {
      acc[key] = { level: 'restricted' as AccessLevel };
    }
    return acc;
  }, {} as Record<PageKey, { level: AccessLevel }>),
  districtIds: [],
};

// Platform admin gets full everywhere in-app (UI). Firestore rules will also bypass via claim.
export const platformAdminAccess = {
  pages: ALL_PAGE_KEYS.reduce((acc, key) => {
    acc[key] = { level: 'full' as AccessLevel };
    return acc;
  }, {} as Record<PageKey, { level: AccessLevel }>),
  districtIds: [],
};

/**
 * Platform Admin determination:
 * - Prefer claim (passed in), because it is authoritative
 * - Fallback to profile.positionId for convenience (optional)
 */
export function isPlatformAdmin(u: UserProfile | null | undefined, isPlatformAdminClaim?: boolean): boolean {
  if (isPlatformAdminClaim === true) return true;
  return !!u && u.isActive && u.positionId === 'platformAdmin';
}

export function isOfficeAdmin(u: UserProfile | null): boolean {
  return !!u && u.isActive && u.positionId === 'officeAdmin';
}

export function canViewPage(
  u: UserProfile | null,
  page: PageKey,
  opts?: { isPlatformAdminClaim?: boolean }
): boolean {
  // If claim says platform admin, allow everything (even if profile doc missing)
  if (opts?.isPlatformAdminClaim === true) return true;

  if (!u?.isActive) return false;

  // hard-gate admin users page: only platform admin
  if (page === 'admin_users') return isPlatformAdmin(u, opts?.isPlatformAdminClaim);

  // safe defaults for users with no access configured yet
  if (!u.access?.pages) {
    return page === 'dashboard' || page === 'profile';
  }

  return u.access.pages[page]?.level !== 'restricted';
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

  const level = u.access?.pages?.[page]?.level ?? 'restricted';

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
