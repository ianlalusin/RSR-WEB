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
      acc[key] = { level: 'readonly' };
    } else {
      acc[key] = { level: 'restricted' };
    }
    return acc;
  }, {} as Record<PageKey, { level: AccessLevel }>),
  districtIds: [],
};

export const platformAdminAccess = {
    pages: ALL_PAGE_KEYS.reduce((acc, key) => {
        acc[key] = { level: 'full' };
        return acc;
    }, {} as Record<PageKey, { level: AccessLevel }>),
    districtIds: [],
}

/**
 * Checks if a user is a Platform Admin.
 * This is a hard-coded check based on positionId.
 * @param u The user profile.
 * @returns boolean
 */
export function isPlatformAdmin(u: UserProfile | null): boolean {
  return !!u && u.isActive && u.positionId === "platformAdmin";
}

/**
 * Checks if a user is an Office Admin.
 * This is a hard-coded check based on positionId.
 * @param u The user profile.
 * @returns boolean
 */
export function isOfficeAdmin(u: UserProfile | null): boolean {
    return !!u && u.isActive && u.positionId === 'officeAdmin';
}

/**
 * Checks if a user can view a specific page.
 * @param u The user profile.
 * @param page The key of the page to check.
 * @returns boolean
 */
export function canViewPage(u: UserProfile | null, page: PageKey): boolean {
  if (!u?.isActive) return false;

  // ✅ Full bypass for platform admin
  if (isPlatformAdmin(u)) return true;

  // safe defaults for users with no access configured yet
  if (!u.access?.pages) {
    return page === "dashboard" || page === "profile";
  }

  return u.access.pages[page]?.level !== "restricted";
}


/**
 * Checks if a user can perform a specific action on a page.
 * @param u The user profile.
 * @param page The key of the page to check.
 * @param action The action to perform ('read', 'create', 'update', 'delete').
 * @returns boolean
 */
export function canDo(u: UserProfile | null, page: PageKey, action: 'read' | 'create' | 'update' | 'delete'): boolean {
    if (!u?.isActive) return false;

    // ✅ Full bypass for platform admin
    if (isPlatformAdmin(u)) return true;

    const level = u.access?.pages?.[page]?.level ?? 'restricted';

    if (level === 'full') {
        return true;
    }
    
    if (level === 'readwrite') {
        return action !== 'delete';
    }

    if (level === 'readonly') {
        return action === 'read';
    }
    
    // level is 'restricted' or unhandled
    return false;
}


/**
 * Checks if a user has access to a specific district.
 * Platform Admins have access to all districts.
 * @param u The user profile.
 * @param districtId The ID of the district to check.
 * @returns boolean
 */
export function hasDistrictScope(u: UserProfile | null | undefined, districtId: string): boolean {
    if (!u || !u.isActive) return false;
    if (isPlatformAdmin(u)) return true;
    return u.access?.districtIds?.includes(districtId) ?? false;
}
