import type { InventoryPriceInfo } from "../types";

export const TBH_STEAM_APP_ID = 3678970;

export function steamMarketListingUrl(marketHashName: string, appId = TBH_STEAM_APP_ID): string {
  return `https://steamcommunity.com/market/listings/${appId}/${encodeURIComponent(marketHashName)}`;
}

export function pickMarketUnit(price: InventoryPriceInfo): {
  unit: number | null;
  raw: string | null;
  source: "median" | "lowest" | null;
} {
  if (price.median != null) {
    return { unit: price.median, raw: price.rawMedian, source: "median" };
  }
  if (price.lowest != null) {
    return { unit: price.lowest, raw: price.rawLowest, source: "lowest" };
  }
  return { unit: null, raw: null, source: null };
}

export interface SteamCurrency {
  code: number;
  iso: string;
  label: string;
  prefix: string;
}

export const STEAM_CURRENCIES: SteamCurrency[] = [
  { code: 1, iso: "USD", label: "US Dollar", prefix: "$" },
  { code: 2, iso: "GBP", label: "British Pound", prefix: "£" },
  { code: 3, iso: "EUR", label: "Euro", prefix: "€" },
  { code: 4, iso: "CHF", label: "Swiss Franc", prefix: "CHF " },
  { code: 5, iso: "RUB", label: "Russian Ruble", prefix: "₽" },
  { code: 6, iso: "PLN", label: "Polish Zloty", prefix: "" },
  { code: 7, iso: "BRL", label: "Brazilian Real", prefix: "R$ " },
  { code: 8, iso: "JPY", label: "Japanese Yen", prefix: "¥" },
  { code: 9, iso: "NOK", label: "Norwegian Krone", prefix: "kr " },
  { code: 10, iso: "IDR", label: "Indonesian Rupiah", prefix: "Rp " },
  { code: 11, iso: "MYR", label: "Malaysian Ringgit", prefix: "RM" },
  { code: 12, iso: "PHP", label: "Philippine Peso", prefix: "P" },
  { code: 13, iso: "SGD", label: "Singapore Dollar", prefix: "S$" },
  { code: 14, iso: "THB", label: "Thai Baht", prefix: "฿" },
  { code: 15, iso: "VND", label: "Vietnamese Dong", prefix: "" },
  { code: 16, iso: "KRW", label: "South Korean Won", prefix: "₩" },
  { code: 17, iso: "TRY", label: "Turkish Lira", prefix: "₺" },
  { code: 18, iso: "UAH", label: "Ukrainian Hryvnia", prefix: "" },
  { code: 19, iso: "MXN", label: "Mexican Peso", prefix: "Mex$ " },
  { code: 20, iso: "CAD", label: "Canadian Dollar", prefix: "C$" },
  { code: 21, iso: "AUD", label: "Australian Dollar", prefix: "A$" },
  { code: 22, iso: "NZD", label: "New Zealand Dollar", prefix: "NZ$ " },
  { code: 23, iso: "CNY", label: "Chinese Yuan", prefix: "¥" },
  { code: 24, iso: "INR", label: "Indian Rupee", prefix: "₹" },
];

const BY_ISO = new Map(STEAM_CURRENCIES.map((c) => [c.iso, c]));

export function currencyByIso(iso: string): SteamCurrency {
  return BY_ISO.get(iso.toUpperCase()) ?? STEAM_CURRENCIES[0];
}

export function currencyCode(iso: string): number {
  return currencyByIso(iso).code;
}

export function currencyPrefix(iso: string): string {
  return currencyByIso(iso).prefix;
}

const COMMA_DECIMAL = new Set([
  "BGN", "BRL", "CLP", "COP", "CRC", "CZK", "DKK", "EUR", "HUF", "NOK", "PEN", "PLN", "RON",
  "RUB", "TRY", "UAH", "UYU", "VND",
]);

const INTEGER_MONEY = new Set(["JPY", "KRW"]);

const DISPLAY_LOCALE: Record<string, string> = {
  BRL: "pt-BR", EUR: "de-DE", GBP: "en-GB", IDR: "id-ID", JPY: "ja-JP", KRW: "ko-KR",
  PLN: "pl-PL", RUB: "ru-RU", THB: "th-TH", USD: "en-US", VND: "vi-VN",
};

function displayLocale(iso: string): string {
  const code = iso.toUpperCase();
  return DISPLAY_LOCALE[code] ?? (COMMA_DECIMAL.has(code) ? "de-DE" : "en-US");
}

function formatAmountBody(amount: number, iso: string): string {
  const code = iso.toUpperCase();
  const locale = displayLocale(code);
  if (INTEGER_MONEY.has(code)) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(amount));
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoney(amount: number, iso: string): string {
  const code = iso.toUpperCase();
  return `${currencyPrefix(code)}${formatAmountBody(amount, code)}`;
}

/** Total stack value using the same currency formatting as unit prices. */
export function formatStackValue(
  unitRaw: string | null,
  unitAmount: number | null,
  count: number,
  iso: string,
): string {
  if (unitAmount == null) return "—";
  if (count <= 1 && unitRaw) return unitRaw;
  return formatMoney(unitAmount * count, iso);
}

export function parseMoney(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;

  const lastSep = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  const trailing = lastSep === -1 ? 0 : cleaned.length - lastSep - 1;
  const isDecimal = lastSep !== -1 && trailing !== 3;

  let value: number;
  if (!isDecimal) {
    value = Number(cleaned.replace(/[.,]/g, ""));
  } else {
    const intPart = cleaned.slice(0, lastSep).replace(/[.,]/g, "");
    const fracPart = cleaned.slice(lastSep + 1).replace(/[.,]/g, "");
    value = Number(`${intPart}.${fracPart}`);
  }
  return Number.isFinite(value) ? value : null;
}
