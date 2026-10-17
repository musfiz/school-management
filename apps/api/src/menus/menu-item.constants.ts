/** Which part of the site a menu item belongs to. Extend as new menu surfaces
 *  are added (e.g. 'footer', 'dashboard_sidebar').
 *
 *  AD-P9: moved out of the TypeORM entity so it survives the entity's deletion
 *  at Wave 6. */
export type MenuLocation = 'header';
