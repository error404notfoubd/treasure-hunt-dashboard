// ── Role Definitions ──────────────────────────────────────
export const ROLES = {
  owner: {
    level: 100,
    label: "Owner",
    color: "#F5B731",
    bgColor: "rgba(245,183,49,0.12)",
    icon: "♔",
    description: "Full system access — manage everything",
  },
  admin: {
    level: 80,
    label: "Admin",
    color: "#4A9EF5",
    bgColor: "rgba(74,158,245,0.12)",
    icon: "⚙",
    description: "Manage data, users, and view audit logs",
  },
  editor: {
    level: 50,
    label: "Editor",
    color: "#32D583",
    bgColor: "rgba(50,213,131,0.12)",
    icon: "✎",
    description: "View and edit survey data",
  },
  viewer: {
    level: 10,
    label: "Viewer",
    color: "#9EAAB8",
    bgColor: "rgba(158,170,184,0.12)",
    icon: "◉",
    description: "Read-only access to data",
  },
};

export const ROLE_ORDER = ["admin", "editor", "viewer"];

// ── Permissions ──────────────────────────────────────────
export const PERMISSIONS = {
  owner: [
    "View all survey responses",
    "Edit any record",
    "Delete any record",
    "Manage all users & roles",
    "Promote/demote any role",
    "View audit log",
    "Modify system settings",
  ],
  admin: [
    "View all survey responses",
    "Edit any record",
    "Delete records",
    "Approve / reject sign-up requests",
    "Manage editors & viewers",
    "View audit log",
  ],
  editor: [
    "View all survey responses",
    "Edit records",
    "Flag / unflag entries",
  ],
  viewer: [
    "View survey responses (read-only)",
  ],
};

// ── Permission Checks ────────────────────────────────────
export function getRoleLevel(role) {
  return ROLES[role]?.level ?? 0;
}

export function canViewData(role) {
  return getRoleLevel(role) >= 10;
}

export function canEditData(role) {
  return getRoleLevel(role) >= 50;
}

export function canDeleteData(role) {
  return getRoleLevel(role) >= 80;
}

export function canManageUsers(role) {
  return getRoleLevel(role) >= 80;
}

export function canVerifyData(role) {
  return getRoleLevel(role) >= 80;
}

export function canViewAudit(role) {
  return getRoleLevel(role) >= 50;
}

export function canAssignRole(assignerRole, targetRole) {
  if (targetRole === "owner") return false;
  return getRoleLevel(assignerRole) > getRoleLevel(targetRole);
}

export function canModifyUser(actorRole, targetRole) {
  if (targetRole === "owner") return actorRole === "owner";
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}
