import type { locales } from "@/i18n/config";

import type messages from "./messages/id.json";

/**
 * Type-safe `useTranslations` / `getTranslations` keys, and a `Locale` union
 * narrower than `string`. `id.json` is the reference shape; `en.json` is
 * required to match it exactly, which `src/i18n/messages.test.ts` enforces
 * at test time — this file only needs one of the two to describe the shape.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof locales)[number];
    Messages: typeof messages;
  }
}
