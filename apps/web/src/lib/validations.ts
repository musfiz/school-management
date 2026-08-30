import { z } from "zod";

/**
 * Login form schema.
 *
 * Tightened from the first pass:
 * - Email is trimmed and lowercased before validation so a user typing
 *   "  Foo@Bar.com " submits the canonical form. We still validate the
 *   trimmed value with `.email()`.
 * - Password is capped at 128 characters. Real bcrypt hashes are ~60 chars;
 *   anything beyond 128 is either a paste mistake or a DoS attempt, and
 *   rejecting it client-side saves a network round-trip.
 * - Error messages are written for the end user, not the developer.
 */
export const loginSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string({ message: "Password is required" })
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password is too long"),
});

export type LoginInput = z.infer<typeof loginSchema>;
