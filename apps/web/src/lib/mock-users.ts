import type { Role } from "./dashboard-nav";

/**
 * Mock user list for the dashboard demo.
 *
 * Single source of truth for username -> role mapping. The auth cookie stores
 * only the username; the role is looked up from this list on every read.
 *
 * !! MOCK ONLY — never ship real credentials in source. Swap for a real
 * backend lookup (DB or auth provider) when wiring production auth.
 */
export interface MockUser {
  username: string;
  password: string;
  name: string;
  email: string;
  role: Role;
}

export const MOCK_USERS: readonly MockUser[] = [
  { username: "admin",     password: "admin123",  name: "Aisha Rahman",  email: "admin@modelhigh.edu.bd",     role: "admin" },
  { username: "principal", password: "manage123", name: "Karim Hossain", email: "principal@modelhigh.edu.bd", role: "management" },
  { username: "teacher",   password: "teach123",  name: "Nadia Akter",   email: "teacher@modelhigh.edu.bd",   role: "teacher" },
  { username: "student",   password: "stud123",   name: "Rifat Khan",    email: "student@modelhigh.edu.bd",   role: "student" },
  { username: "guardian",  password: "guard123",  name: "Sumon Mia",     email: "guardian@modelhigh.edu.bd",  role: "guardian" },
];

export function findUser(username: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.username === username);
}

export function findUserByCredentials(
  username: string,
  password: string,
): MockUser | null {
  const u = findUser(username.trim().toLowerCase());
  if (!u || u.password !== password) return null;
  return u;
}
