
export type UserProfile = {
  isActive?: boolean;
  roles?: string[];
  permissions?: Record<string, boolean>;
  departments?: string[];
  districtIds?: string[];
  coordinatorBrgyIds?: string[];
};

export function isAdmin(u?: UserProfile | null) {
  return !!u?.roles?.includes("admin");
}

export function can(u: UserProfile | null | undefined, key: string) {
  if (!u?.isActive) return false;
  if (isAdmin(u)) return true;

  // Rule for OIC role as requested
  if (u.roles?.includes('oic')) {
      if (key === 'brgy.write' || key === 'brgy.captain.write') {
          // OIC role has these permissions unless explicitly denied
          return u.permissions?.[key] !== false;
      }
  }

  return !!u?.permissions?.[key];
}

// Hard rule: delete is admin only
export function canDelete(u: UserProfile | null | undefined) {
  if (!u?.isActive) return false;
  return isAdmin(u);
}
