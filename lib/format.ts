export const fmt2 = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("es-CO",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
export const toNum = (v: string) => (v.trim()==="" ? null : Number(v.replace(",", ".")));
