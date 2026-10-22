import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require:permission';

export type MenuAction = 'canView' | 'canCreate' | 'canEdit' | 'canDelete';

export interface RequirePermissionMetadata {
  menuSlug: string;
  action: MenuAction;
}

/**
 * Declares that a route requires a specific menu-level action
 * (`canView` | `canCreate` | `canEdit` | `canDelete`) on the menu identified
 * by `menuSlug`. Enforced by `MenuPermissionsGuard`; superadmins bypass it.
 */
export const RequirePermission = (menuSlug: string, action: MenuAction) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { menuSlug, action });
