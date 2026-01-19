import type { UserProfile } from "./types";

// This is the base check for admin role.
export function isAdmin(u?: UserProfile | null): boolean {
  return !!u?.roles?.includes("admin");
}

// Core permission checker.
export function hasPerm(u: UserProfile | null | undefined, key: string): boolean {
  if (!u?.isActive) return false;
  // Admin has all permissions.
  if (isAdmin(u)) return true;
  // Check for explicit permission.
  return !!u.permissions?.[key];
}

// Specific check for reading barangays.
export function canReadBarangays(u: UserProfile | null | undefined): boolean {
    if (!u?.isActive) return false;
    if (isAdmin(u)) return true; // Admin can always read.
    return hasPerm(u, 'brgy.read');
}


// Specific check for writing/editing barangays.
export function canWriteBarangay(u: UserProfile | null | undefined): boolean {
  if (!u?.isActive) return false;
  if (isAdmin(u)) return true;

  // Rule for 'office' role: has permission unless explicitly denied.
  if (u.roles?.includes('office')) {
    return u.permissions?.['brgy.write'] !== false;
  }
  
  return hasPerm(u, 'brgy.write');
}

// Specific check for editing the captain's profile.
export function canWriteCaptain(u: UserProfile | null | undefined): boolean {
  if (!u?.isActive) return false;
  if (isAdmin(u)) return true;

  // Rule for 'office' role: has permission unless explicitly denied.
  if (u.roles?.includes('office')) {
    return u.permissions?.['brgy.captain.write'] !== false;
  }

  return hasPerm(u, 'brgy.captain.write');
}

// Specific check for managing users.
export function canManageUsers(u: UserProfile | null | undefined): boolean {
  return hasPerm(u, 'admin.users.manage');
}

// Specific check for managing departments. Admin-only for now.
export function canManageDepartments(u: UserProfile | null | undefined): boolean {
  if (!u?.isActive) return false;
  return isAdmin(u);
}

// Specific check for managing positions. Admin-only for now.
export function canManagePositions(u: UserProfile | null | undefined): boolean {
  if (!u?.isActive) return false;
  return isAdmin(u);
}


// Hard rule: delete operations are admin-only.
export function canDelete(u: UserProfile | null | undefined): boolean {
  if (!u?.isActive) return false;
  return isAdmin(u);
}
