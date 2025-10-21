import { calcularConsumoDiarioKg } from "@/lib/consumo";
import type { SupabaseClient } from "@supabase/supabase-js";

type UnidadMedida = "bulto" | "unidad" | "litro";

type MaterialRow = {
  id: string;
  nombre: string | null;
  unidad_medida: UnidadMedida | null;
  presentacion_kg_por_bulto: number | null;
  tasa_consumo_diaria_kg: number | null;
};

type ReservaRow = {
  material_id: string;
  stock_kg: number | null;
  stock_bultos: number | null;
};

type ConsumoAutomaticoResultado = {
  procesados: number;
  actualizados: number;
  sinReserva: number;
  sinStock: number;
};

type AplicarConsumoArgs = {
  supabaseClient: SupabaseClient;
  zonaId: string;
  date: string;
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function aplicarConsumoAutomatico({
  supabaseClient,
  zonaId,
  date,
}: AplicarConsumoArgs): Promise<ConsumoAutomaticoResultado> {
  const { data: mats, error: errMats } = await supabaseClient
    .from("materiales")
    .select(
      "id,nombre,unidad_medida,presentacion_kg_por_bulto,tasa_consumo_diaria_kg"
    )
    .eq("zona_id", zonaId)
    .eq("activo", true)
    .returns<MaterialRow[]>();

  if (errMats) {
    throw new Error(errMats.message);
  }

  const materiales = mats ?? [];

  if (!materiales.length) {
    return { procesados: 0, actualizados: 0, sinReserva: 0, sinStock: 0 };
  }

  const materialIds = materiales.map((m) => m.id);

  let reservasQuery = supabaseClient
    .from("consumo_automatico_reservas")
    .select("material_id,stock_kg,stock_bultos")
    .eq("zona_id", zonaId)
    .returns<ReservaRow[]>();

  if (materialIds.length) {
    reservasQuery = reservasQuery.in("material_id", materialIds);
  }

  const { data: reservas, error: errReservas } = await reservasQuery;

  if (errReservas) {
    throw new Error(errReservas.message);
  }

  const reservasPorMaterial = new Map(
    (reservas ?? []).map((item) => [item.material_id, item])
  );

  const updates: {
    zona_id: string;
    material_id: string;
    stock_kg: number;
    stock_bultos: number | null;
    updated_at: string;
  }[] = [];

  const movimientos: {
    zona_id: string;
    material_id: string;
    fecha: string;
    consumo_kg: number | null;
    consumo_bultos: number | null;
    stock_kg_restante: number | null;
    stock_bultos_restante: number | null;
  }[] = [];

  let sinReserva = 0;
  let sinStock = 0;
  let actualizados = 0;

  for (const material of materiales) {
    const reserva = reservasPorMaterial.get(material.id);

    if (!reserva) {
      sinReserva += 1;
      continue;
    }

    const unidad = material.unidad_medida ?? "bulto";
    const presentacion = toNumber(material.presentacion_kg_por_bulto);
    const stockKgActual = toNumber(reserva.stock_kg);
    const stockBultosActual =
      reserva.stock_bultos == null ? null : toNumber(reserva.stock_bultos);

    if (unidad === "unidad") {
      const consumoUnidades = material.tasa_consumo_diaria_kg;
      if (!consumoUnidades || consumoUnidades <= 0) {
        continue;
      }

      if (stockBultosActual == null || stockBultosActual <= 0) {
        sinStock += 1;
        continue;
      }

      const consumoReal = Math.min(stockBultosActual, consumoUnidades);
      const stockRestanteBultos = Math.max(stockBultosActual - consumoReal, 0);

      updates.push({
        zona_id: zonaId,
        material_id: material.id,
        stock_kg: stockKgActual,
        stock_bultos: stockRestanteBultos,
        updated_at: new Date().toISOString(),
      });

      movimientos.push({
        zona_id: zonaId,
        material_id: material.id,
        fecha: date,
        consumo_kg: null,
        consumo_bultos: consumoReal,
        stock_kg_restante: stockKgActual,
        stock_bultos_restante: stockRestanteBultos,
      });

      actualizados += 1;
      continue;
    }

    const consumoKg = calcularConsumoDiarioKg({
      nombre: material.nombre,
      unidad_medida: unidad,
      presentacion_kg_por_bulto: material.presentacion_kg_por_bulto,
      tasa_consumo_diaria_kg: material.tasa_consumo_diaria_kg,
    });

    if (!consumoKg || consumoKg <= 0) {
      continue;
    }

    if (stockKgActual <= 0) {
      sinStock += 1;
      continue;
    }

    const consumoRealKg = Math.min(stockKgActual, consumoKg);
    const stockRestanteKg = Math.max(stockKgActual - consumoRealKg, 0);

    let stockRestanteBultos: number | null = stockBultosActual;
    let consumoRealBultos: number | null = null;

    if (unidad === "bulto") {
      const divisor = presentacion > 0 ? presentacion : 1;
      const consumoBultosCalculado = consumoKg / divisor;
      const consumoPosibleBultos =
        stockBultosActual == null
          ? consumoBultosCalculado
          : Math.min(stockBultosActual, consumoBultosCalculado);
      consumoRealBultos = consumoPosibleBultos;
      stockRestanteBultos =
        stockBultosActual == null
          ? null
          : Math.max(stockBultosActual - consumoPosibleBultos, 0);
    }

    updates.push({
      zona_id: zonaId,
      material_id: material.id,
      stock_kg: stockRestanteKg,
      stock_bultos: stockRestanteBultos,
      updated_at: new Date().toISOString(),
    });

    movimientos.push({
      zona_id: zonaId,
      material_id: material.id,
      fecha: date,
      consumo_kg: consumoRealKg,
      consumo_bultos: consumoRealBultos,
      stock_kg_restante: stockRestanteKg,
      stock_bultos_restante: stockRestanteBultos,
    });

    actualizados += 1;
  }

  if (updates.length) {
    const { error: errUpdate } = await supabaseClient
      .from("consumo_automatico_reservas")
      .upsert(updates, { onConflict: "zona_id,material_id" });

    if (errUpdate) {
      throw new Error(errUpdate.message);
    }
  }

  if (movimientos.length) {
    const { error: errMovs } = await supabaseClient
      .from("consumo_automatico_movimientos")
      .insert(movimientos);

    if (errMovs) {
      throw new Error(errMovs.message);
    }
  }

  return {
    procesados: materiales.length,
    actualizados,
    sinReserva,
    sinStock,
  };
}
