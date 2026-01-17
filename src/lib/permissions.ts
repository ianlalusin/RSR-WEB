
export type UserProfile = {
  isActive?: boolean;
  roles?: string[];
  permissions?: Record<string, boolean>;
  departments?: string[];
  districtIds?: string[];
  coordinatorBrgyIds?: string[];
};

export function isAdmin(u?: UserProfile | null) {
  return !!u?.roles?.includes("admin") || !!u?.permissions?.["admin.all"];
}

export function can(u: UserProfile | null | undefined, key: string) {
  if (!u?.isActive) return false;
  if (isAdmin(u)) return true;
  return !!u?.permissions?.[key];
}

// Hard rule: delete is admin only
export function canDelete(u: UserProfile | null | undefined) {
  return isAdmin(u);
}
