import { apiFetch } from "./api";

export interface CustomActionDef {
  action: string;
  label: string;
}

export interface MenuActionsConfig {
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  custom?: CustomActionDef[];
}

export interface SystemMenu {
  id: string;
  slug: string;
  title: string;
  path: string | null;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  actionsConfig?: MenuActionsConfig | null;
  createdAt?: string;
  updatedAt?: string;
  parent?: {
    id: string;
    slug: string;
    title: string;
  } | null;
  _count?: {
    children: number;
  };
}

export interface CreateSystemMenuInput {
  slug: string;
  title: string;
  path?: string | null;
  icon?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  actionsConfig?: MenuActionsConfig | null;
}

export interface UpdateSystemMenuInput {
  slug?: string;
  title?: string;
  path?: string | null;
  icon?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  actionsConfig?: MenuActionsConfig | null;
}

export function listSystemMenus(): Promise<SystemMenu[]> {
  return apiFetch<SystemMenu[]>("/api/system-menus");
}

export function createSystemMenu(input: CreateSystemMenuInput): Promise<SystemMenu> {
  return apiFetch<SystemMenu>("/api/system-menus", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSystemMenu(id: string, input: UpdateSystemMenuInput): Promise<SystemMenu> {
  return apiFetch<SystemMenu>(`/api/system-menus/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSystemMenu(id: string): Promise<SystemMenu> {
  return apiFetch<SystemMenu>(`/api/system-menus/${id}`, {
    method: "DELETE",
  });
}
