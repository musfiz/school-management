import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require:permission';

export type StandardMenuAction = 'canView' | 'canCreate' | 'canEdit' | 'canDelete';
export type MenuAction = StandardMenuAction | (string & {});

export interface RequirePermissionMetadata {
  menuSlug: string;
  action: MenuAction;
}

/**
 * Declares that a route requires a specific menu-level action
 * (standard: `canView` | `canCreate` | `canEdit` | `canDelete`, or custom: `excel` | `pdf` | `approve` etc.)
 * on the menu identified by `menuSlug`. Enforced by `MenuPermissionsGuard`; superadmins bypass it.
 */
export const RequirePermission = (menuSlug: string, action: MenuAction) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { menuSlug, action });
