import { fmtNum } from "@/lib/format";

import type { Unidad } from "@/app/inventario/types";

export function formatUnidad(valor: number, unidad: Unidad) {
  const plural =
    unidad === "bulto" ? "bultos" : unidad === "unidad" ? "unidades" : "litros";
  const singular = unidad;
  return `${fmtNum(valor)} ${valor === 1 ? singular : plural}`;
}

export function calcularFechaHasta(
  fechaBase: string,
  stockDisponible: number,
  consumoDiario: number | null
) {
  if (!consumoDiario || consumoDiario <= 0) return null;
  let dias = Math.floor(stockDisponible / consumoDiario);
  const fecha = new Date(fechaBase);
  while (dias > 0) {
    fecha.setDate(fecha.getDate() + 1);
    if (fecha.getDay() !== 0) dias--;
  }
  return fecha.toISOString().slice(0, 10);
}

export const obtenerEtiquetaCobertura = (cobertura: number | null) => {
  if (cobertura === null) {
    return {
      texto: "sin estimacion",
      estilo: "bg-slate-100 text-slate-700",
    } as const;
  }
  if (cobertura <= 2) {
    return {
      text: "Critico",
      estilo: "bg-red-100 text-red-800",
    } as const;
  }
  if (cobertura <= 5) {
    return {
      texto: "En observación",
      estilo: "bg-amber-100 text-amber-800",
    } as const;
  }

  return {
    texto: "Estable",
    estilo: "bg-emerald-100 text-emerald-800",
  } as const;
};
