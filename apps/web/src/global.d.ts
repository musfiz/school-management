import type en from "./messages/en.json";

/**
 * Message schema shared by every locale file.
 *
 * Declared once from `en.json` and reused via `keyof Messages` so
 * `next-intl`'s typed translator knows every key that exists at runtime
 * — without it, dynamically-imported JSON collapses to `Record<string, any>`
 * and `tContent("notFound")` fails strict mode even though the file
 * clearly defines the key.
 *
 * If a translation is intentionally added to one locale but not the
 * other, that's fine: keys are required but values can still differ.
 */
type Messages = typeof en;

declare module "next-intl" {
  interface AppConfig {
    Messages: Messages;
  }
}

export {};