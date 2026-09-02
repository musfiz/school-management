"use client";

/**
 * Same-origin fetch with auto-redirect on 401.
 *
 * The session cookie is sent automatically because the browser attaches
 * cookies to same-origin requests. If the server responds 401 the user is
 * bounced to /login with returnTo set to the current path.
 *
 * Usage from a client component:
 *   const data = await apiFetch<MyType>("/students");
 *
 * The redirect is fired via `window.location.href`, which the browser
 * begins immediately. The thrown `Error("Unauthorized")` is for callers
 * that want to short-circuit further work in the same tick; in practice
 * the navigation has already started by the time any catch runs.
 */
export async function apiFetch<T = unknown>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      const returnTo = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      window.location.href = `/login?returnTo=${returnTo}`;
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    let message = `Request failed with ${res.status}`;
    try {
      const data = (await res.json()) as {
        error?: string;
        message?: string | string[];
      };
      if (data?.message) {
        message = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message;
      } else if (data?.error) {
        message = data.error;
      }
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(message);
  }

  // Try JSON; fall back to undefined for empty bodies (e.g. 204).
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
