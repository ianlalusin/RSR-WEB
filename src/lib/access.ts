
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

/**
 * Checks if a user is a Platform Admin.
 * This is a hard-coded check based on positionId.
 * @param u The user profile.
 * @returns boolean
 */
export function isPlatformAdmin(u?: UserProfile | null): boolean {
    return u?.isActive === true && u?.positionId === 'platform_admin';
}

/**
 * Checks if a user is an Office Admin.
 * This is a hard-coded check based on positionId.
 * @param u The user profile.
 * @returns boolean
 */
export function isOfficeAdmin(u?: UserProfile | null): boolean {
    return u?.isActive === true && u?.positionId === 'office_admin';
}


/**
 * Gets the access level for a specific page.
 * @param u The user profile.
 * @param pageKey The key of the page to check.
 * @returns AccessLevel ('restricted', 'readonly', 'readwrite')
 */
function getPageAccess(u: UserProfile | null | undefined, pageKey: PageKey): AccessLevel {
    if (!u || !u.isActive) {
        return 'restricted';
    }
    // Platform Admin has full access to everything except profile which is user-specific.
    if (pageKey !== 'profile' && isPlatformAdmin(u)) {
        return 'readwrite';
    }
    return u.access?.pages?.[pageKey]?.level || 'restricted';
}


/**
 * Checks if a user can view a specific page.
 * @param u The user profile.
 * @param pageKey The key of the page to check.
 * @returns boolean
 */
export function canViewPage(u: UserProfile | null | undefined, pageKey: PageKey): boolean {
    // Special hard-gate for admin_users page
    if (pageKey === 'admin_users') {
        return isPlatformAdmin(u);
    }
    const level = getPageAccess(u, pageKey);
    return level === 'readonly' || level === 'readwrite';
}


/**
 * Checks if a user can perform a specific action on a page.
 * @param u The user profile.
 * @param pageKey The key of the page to check.
 * @param action The action to perform ('read', 'create', 'update', 'delete').
 * @returns boolean
 */
export function canDo(u: UserProfile | null | undefined, pageKey: PageKey, action: 'read' | 'create' | 'update' | 'delete'): boolean {
    if (!u || !u.isActive) return false;

    const level = getPageAccess(u, pageKey);

    switch (action) {
        case 'read':
            return level === 'readonly' || level === 'readwrite';
        case 'create':
        case 'update':
            return level === 'readwrite';
        case 'delete':
            // By design, restrict delete operations to admins for safety.
            return isPlatformAdmin(u) || isOfficeAdmin(u);
        default:
            return false;
    }
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
