"use client";

/**
 * Module catalog client.
 *
 * Thin wrappers over the same-origin `/api/modules` API (proxied to NestJS,
 * JWT sent automatically by the browser cookie).
 */

import { apiFetch } from "./api";

export interface Module {
  id: string;
  name: string;
  created_at?: string;
}

export function listModules(): Promise<Module[]> {
  return apiFetch<Module[]>("/api/modules");
}

export function createModule(input: { name: string }): Promise<Module> {
  return apiFetch<Module>("/api/modules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateModule(
  id: string,
  input: { name: string },
): Promise<Module> {
  return apiFetch<Module>(`/api/modules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteModule(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/modules/${id}`, {
    method: "DELETE",
  });
}
