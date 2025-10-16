// lib/format.ts
// Formateadores base
export const fNum = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
});
export const fNum2 = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const fCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
});
export const fDate = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

// Helpers de formato (exportados)
export const fmtNum = (v: number | null | undefined) =>
  fNum.format(Number(v ?? 0));
export const fmt2 = (v: number | null | undefined) =>
  fNum2.format(Number(v ?? 0));
export const fmtCOP = (v: number | null | undefined) =>
  fCOP.format(Number(v ?? 0));
export const fmtDate = (d: string | Date | null | undefined) =>
  d ? fDate.format(typeof d === "string" ? new Date(d) : d) : "—";

// Parser numérico seguro (para inputs tipo "1.234,56" o "1234.56")
export const toNum = (x: unknown): number => {
  if (typeof x === "number") return isFinite(x) ? x : 0;
  if (typeof x !== "string") return 0;
  // normaliza miles/punto decimal en locales es-CO
  const s = x.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

export function show2(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
