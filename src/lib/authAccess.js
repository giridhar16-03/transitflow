const AUTH_STORAGE_KEYS = {
  "public-user": ["transitflow:login:public-user", "transitflow:register:public-user"],
  "public-driver": ["transitflow:login:public-driver", "transitflow:register:public-driver"],
  private: ["transitflow:login:private", "transitflow:register:private"],
};

const ROLE_PATHS = {
  "public-user": "/public",
  "public-driver": "/driver",
  private: "/institution",
};

function normalizeUserId(userId) {
  return String(userId || "").trim();
}

export function normalizeAuthRole(role) {
  if (role === "driver" || role === "public-driver") return "public-driver";
  if (role === "public_user" || role === "public-user") return "public-user";
  if (role === "private") return "private";
  return "public-user";
}

export function toProfileRole(role) {
  if (normalizeAuthRole(role) === "public-driver") return "driver";
  if (normalizeAuthRole(role) === "private") return "private_institution_admin";
  return "public_user";
}

export function fromProfileRole(role) {
  if (role === "driver") return "public-driver";
  if (role === "private_institution_admin" || role === "private_institution_user") return "private";
  return "public-user";
}

export function getRolePath(role) {
  return ROLE_PATHS[normalizeAuthRole(role)] || ROLE_PATHS["public-user"];
}

export function getDashboardPath(role, userId) {
  const normalizedUserId = normalizeUserId(userId);
  return normalizedUserId ? `${getRolePath(role)}/${normalizedUserId}` : getRolePath(role);
}

export function getUserRole(user, fallbackRole = "public-user") {
  return normalizeAuthRole(user?.user_metadata?.role || fallbackRole);
}

export function getPreferredDisplayName(user, fallbackName = "User") {
  const directName = user?.user_metadata?.full_name || user?.user_metadata?.name;
  if (directName && String(directName).trim()) {
    return String(directName).trim();
  }

  const email = String(user?.email || "").trim();
  if (!email) return fallbackName;

  const localPart = email.split("@")[0] || "";
  if (!localPart) return fallbackName;

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function persistAuthAccess(role, mode, payload = {}) {
  if (typeof window === "undefined") return;

  const normalizedRole = normalizeAuthRole(role);
  const key = `transitflow:${mode}:${normalizedRole}`;
  window.localStorage.setItem(
    key,
    JSON.stringify({ role: normalizedRole, mode, ...payload, createdAt: new Date().toISOString() }),
  );
}

export function hasStoredAuthAccess(role) {
  if (typeof window === "undefined") return false;

  const normalizedRole = normalizeAuthRole(role);
  const keys = AUTH_STORAGE_KEYS[normalizedRole] || [];
  return keys.some((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      return normalizeAuthRole(parsed?.role) === normalizedRole;
    } catch {
      return false;
    }
  });
}

export function clearStoredAuthAccess(role) {
  if (typeof window === "undefined") return;

  const normalizedRole = normalizeAuthRole(role);
  const keys = AUTH_STORAGE_KEYS[normalizedRole] || [];
  keys.forEach((key) => window.localStorage.removeItem(key));
}
