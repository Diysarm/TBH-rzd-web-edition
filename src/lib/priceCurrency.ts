/** Detect ISO currency from a Steam price string (e.g. "Rp 12 432", "$0.07"). */
export function detectCurrencyFromRaw(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/^Rp\b|^IDR/i.test(t)) return "IDR";
  if (/^\$|^USD|^US\$|^A\$|^C\$|^NZ\$|^S\$|^HK\$|^NT\$|^Mex\$|^COL\$|^CLP\$|^R\s/i.test(t))
    return "USD"; // broad $ prefix bucket; USD display uses $
  if (/^€|^EUR/i.test(t)) return "EUR";
  if (/^₩|^KRW/i.test(t)) return "KRW";
  if (/^¥|^JPY|^CNY|^TWD/i.test(t)) return "JPY";
  if (/^₽|^RUB/i.test(t)) return "RUB";
  if (/^R\$|^BRL/i.test(t)) return "BRL";
  if (/^₹|^INR/i.test(t)) return "INR";
  if (/^₺|^TRY/i.test(t)) return "TRY";
  if (/^฿|^THB/i.test(t)) return "THB";
  if (/^₫|^VND/i.test(t)) return "VND";
  if (/^£|^GBP/i.test(t)) return "GBP";
  if (/^zł|^PLN/i.test(t)) return "PLN";
  return null;
}

export function priceRawMatchesCurrency(raw: string | null | undefined, iso: string): boolean {
  const detected = detectCurrencyFromRaw(raw);
  if (!detected) return true;
  const want = iso.toUpperCase();
  if (want === detected) return true;
  // Steam sometimes uses $ for multiple dollar currencies; accept for USD/CAD/AUD etc.
  if (want === "USD" && detected === "USD") return true;
  if (["CAD", "AUD", "NZD", "SGD", "HKD"].includes(want) && detected === "USD") return true;
  return false;
}

export function formatPriceForCurrency(
  entry: { rawLowest: string | null; rawMedian: string | null; lowest: number | null; median: number | null },
  iso: string,
): { raw: string | null; unit: number | null } {
  const raw = entry.rawMedian ?? entry.rawLowest;
  const unit = entry.median ?? entry.lowest;
  if (raw && priceRawMatchesCurrency(raw, iso)) {
    return { raw, unit };
  }
  return { raw: null, unit: null };
}
