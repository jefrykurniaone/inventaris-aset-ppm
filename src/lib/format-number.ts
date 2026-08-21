import type { Locale } from "@/i18n/config";

const LOCALE_TAGS: Readonly<Record<Locale, string>> = {
  id: "id-ID",
  en: "en-US",
};

const IDR_CURRENCY_CODE = "IDR";

/** Rupiah has no minor unit in everyday use; asset prices are whole amounts. */
const IDR_FRACTION_DIGITS = 0;

/** `1.234.567` in `id`, `1,234,567` in `en` — the thousands separator per locale. */
export function formatInteger(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    maximumFractionDigits: IDR_FRACTION_DIGITS,
  }).format(value);
}

/**
 * Renders an amount as Indonesian rupiah. The separator and currency
 * placement follow the active locale; the currency itself is always IDR,
 * because every acquisition price and loan record in this system is in
 * rupiah regardless of which language is displaying it (PRD FR-10.4).
 */
export function formatCurrencyIdr(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: "currency",
    currency: IDR_CURRENCY_CODE,
    maximumFractionDigits: IDR_FRACTION_DIGITS,
  }).format(value);
}
