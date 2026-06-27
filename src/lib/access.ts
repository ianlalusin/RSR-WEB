// NOTE: No 'use client' directive — this module is pure permission logic (no
// hooks, no browser APIs), so it must stay universal. It is imported both by
// client components AND by server actions (src/app/actions.ts), and a 'use
// client' boundary here makes calling these functions server-side throw
// ("Attempted to call canViewPage() from the server").
import type { UserProfile, PageKey, AccessLevel, Role } from './types';

export const ALL_PAGE_KEYS: PageKey[] = [
  'dashboard',
  'barangays_list',
  'barangay_detail',
  'organization_orgMembers',
  'organization_departments',
  'organization_roles',
  'receiving',
  'projects_medical',
  'projects_hospitals',
  'projects_educational',
  'projects_infrastructure',
  'tasker',
  'analytics',
  'profile',
  'admin_users',
  'socmed',
  'scholarship_providers',
  'scholarship_applications',
  'scholarship_scholars',
  'scholarship_portal',
];

// ---- Access Presets ----

function buildAccess(
  levels: Partial<Record<PageKey, AccessLevel>>
): Record<PageKey, { level: AccessLevel }> {
  return ALL_PAGE_KEYS.reduce((acc, key) => {
    acc[key] = { level: levels[key] ?? 'restricted' };
    return acc;
  }, {} as Record<PageKey, { level: AccessLevel }>);
}

export const defaultAccess = {
  pages: buildAccess({ dashboard: 'readonly', profile: 'readonly' }),
  districtIds: [] as string[],
};

export const platformAdminAccess = {
  pages: buildAccess(
    ALL_PAGE_KEYS.reduce((acc, k) => { acc[k] = 'full'; return acc; }, {} as Record<PageKey, AccessLevel>)
  ),
  districtIds: [] as string[],
};

export const oicAccess = {
  pages: buildAccess({
    dashboard: 'full',
    barangays_list: 'full',
    barangay_detail: 'full',
    organization_orgMembers: 'full',
    organization_departments: 'full',
    organization_roles: 'full',
    receiving: 'full',
    projects_medical: 'full',
    projects_hospitals: 'full',
    projects_educational: 'full',
    projects_infrastructure: 'full',
    tasker: 'full',
    analytics: 'full',
    profile: 'full',
    admin_users: 'readwrite',
    socmed: 'full',
    scholarship_providers: 'full',
    scholarship_applications: 'full',
    scholarship_scholars: 'full',
    scholarship_portal: 'restricted',
  }),
  districtIds: [] as string[],
};

export const officeAdminAccess = {
  pages: buildAccess({
    dashboard: 'readwrite',
    barangays_list: 'readwrite',
    barangay_detail: 'readwrite',
    organization_orgMembers: 'full',
    organization_departments: 'full',
    organization_roles: 'full',
    receiving: 'readwrite',
    projects_medical: 'readwrite',
    projects_hospitals: 'readwrite',
    projects_educational: 'readwrite',
    projects_infrastructure: 'readwrite',
    tasker: 'readwrite',
    analytics: 'readonly',
    profile: 'readwrite',
    admin_users: 'restricted',
    socmed: 'readwrite',
    scholarship_providers: 'readwrite',
    scholarship_applications: 'readwrite',
    scholarship_scholars: 'readwrite',
    scholarship_portal: 'restricted',
  }),
  districtIds: [] as string[],
};

export const coordinatorAccess = {
  pages: buildAccess({
    dashboard: 'readonly',
    barangays_list: 'readwrite',
    barangay_detail: 'readwrite',
    organization_orgMembers: 'readonly',
    organization_departments: 'restricted',
    organization_roles: 'restricted',
    receiving: 'readwrite',
    projects_medical: 'readwrite',
    projects_hospitals: 'readonly',
    projects_educational: 'readonly',
    projects_infrastructure: 'readonly',
    tasker: 'readonly',
    analytics: 'restricted',
    profile: 'readwrite',
    admin_users: 'restricted',
    socmed: 'readwrite',
    scholarship_providers: 'restricted',
    scholarship_applications: 'readonly',
    scholarship_scholars: 'readonly',
    scholarship_portal: 'restricted',
  }),
  districtIds: [] as string[],
};

export const socmedUserAccess = {
  pages: buildAccess({
    socmed: 'full',
    profile: 'readwrite',
  }),
  districtIds: [] as string[],
};

// ---- Internal rank/scope helpers ----
// These fallbacks are used when role docs haven't loaded yet (e.g. initial render).
// Once role docs are loaded and passed to functions, doc-driven values take over.

const _FALLBACK_RANK: Record<string, number> = {
  socmed: 0, coordinator: 1, officeAdmin: 2, oic: 3, platformAdmin: 4,
};

function _getRank(roleId: string | undefined, roles?: Role[]): number {
  if (roles?.length) return roles.find(r => r.id === roleId)?.rank ?? 0;
  return _FALLBACK_RANK[roleId ?? ''] ?? 0;
}

function _getScopeBreadth(roleId: string | undefined, roles?: Role[]) {
  if (roles?.length) return roles.find(r => r.id === roleId)?.scopeBreadth ?? 'own_districts';
  // Fallback: only OIC and platformAdmin have all_districts access
  if (roleId === 'oic' || roleId === 'platformAdmin') return 'all_districts';
  if (roleId === 'socmed') return 'none';
  return 'own_districts';
}

// ---- Guard functions ----

export function isPlatformAdmin(u: UserProfile | null | undefined, isPlatformAdminClaim?: boolean): boolean {
  if (isPlatformAdminClaim === true) return true;
  return !!u && u.isActive && u.roleId === 'platformAdmin';
}

export function isOIC(u: UserProfile | null | undefined): boolean {
  return !!u && u.isActive && u.roleId === 'oic';
}

export function isOfficeAdmin(u: UserProfile | null): boolean {
  return !!u && u.isActive && u.roleId === 'officeAdmin';
}

/**
 * Can actor manage (edit) the target user?
 * Uses rank from role docs when provided; falls back to built-in ranks.
 */
export function canManageUser(
  actor: UserProfile | null,
  target: UserProfile,
  opts?: { isPlatformAdminClaim?: boolean; roles?: Role[] }
): boolean {
  if (!actor?.isActive) return false;
  if (opts?.isPlatformAdminClaim === true) return true;

  const actorRank = _getRank(actor.roleId, opts?.roles);
  const targetRank = _getRank(target.roleId, opts?.roles);

  return actorRank > targetRank;
}

/**
 * Which roles can the actor assign to others?
 * Returns full Role objects sorted by rank descending.
 * Uses rank from role docs when provided; falls back to built-in ranks.
 */
export function assignableRoles(
  actor: UserProfile | null,
  opts?: { isPlatformAdminClaim?: boolean; roles?: Role[] }
): Role[] {
  if (!actor?.isActive) return [];

  const actorRank = opts?.isPlatformAdminClaim
    ? (opts?.roles ? (_getRank('platformAdmin', opts.roles)) : 4)
    : _getRank(actor.roleId, opts?.roles);

  const pool = opts?.roles ?? [];
  return pool
    .filter(r => r.status === 'active' && (r.rank ?? 0) < actorRank)
    .sort((a, b) => b.rank - a.rank);
}

export function canViewPage(
  u: UserProfile | null,
  page: PageKey,
  opts?: { isPlatformAdminClaim?: boolean }
): boolean {
  if (opts?.isPlatformAdminClaim === true) return true;
  if (!u?.isActive) return false;

  if (page === 'admin_users') return isPlatformAdmin(u, opts?.isPlatformAdminClaim) || isOIC(u);

  if (!u.access?.pages || typeof u.access.pages !== 'object' || Array.isArray(u.access.pages)) {
    return false;
  }

  const pageAccess = u.access.pages[page];
  if (!pageAccess || typeof pageAccess !== 'object' || !('level' in pageAccess)) {
    return false;
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

  if (page === 'admin_users') {
    if (isPlatformAdmin(u, opts?.isPlatformAdminClaim)) return true;
    if (isOIC(u)) return action !== 'delete';
    return false;
  }

  if (!u.access?.pages || typeof u.access.pages !== 'object' || Array.isArray(u.access.pages)) {
    return false;
  }

  const level = u.access.pages?.[page]?.level ?? 'restricted';

  if (level === 'full') return true;
  if (level === 'readwrite') return action !== 'delete';
  if (level === 'readonly') return action === 'read';

  return false;
}

/**
 * Does the user have scope over the given district?
 * Uses scopeBreadth from role docs when provided; falls back to built-in OIC check.
 */
export function hasDistrictScope(
  u: UserProfile | null | undefined,
  districtId: string,
  opts?: { isPlatformAdminClaim?: boolean; roles?: Role[] }
): boolean {
  if (opts?.isPlatformAdminClaim === true) return true;
  if (!u || !u.isActive) return false;

  const scope = _getScopeBreadth(u.roleId, opts?.roles);
  if (scope === 'all_districts') return true;
  if (scope === 'none') return false;

  return u.access?.districtIds?.includes(districtId) ?? false;
}
