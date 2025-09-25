// app/api/consumo/apply/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/consumo/apply?zonaId=...&date=YYYY-MM-DD
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const zonaId = searchParams.get("zonaId");
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  if (!zonaId) {
    return NextResponse.json({ error: "Falta zonaId" }, { status: 400 });
  }

  // 1) Traer materiales con consumo > 0 en la zona
  const { data: mats, error: errMats } = await supabase
    .from("materiales")
    .select("id,presentacion_kg_por_bulto,tasa_consumo_diaria_kg,activo")
    .eq("zona_id", zonaId)
    .eq("activo", true)
    .gt("tasa_consumo_diaria_kg", 0)
    .returns<{ id: string; presentacion_kg_por_bulto: number; tasa_consumo_diaria_kg: number; activo: boolean }[]>();

  if (errMats) return NextResponse.json({ error: errMats.message }, { status: 500 });

  // 2) Evitar duplicados: ya existe consumo para esa fecha?
  const { data: exist } = await supabase
    .from("movimientos_inventario")
    .select("material_id")
    .eq("zona_id", zonaId)
    .eq("fecha", date)
    .eq("ref_tipo", "consumo_diario")
    .returns<{ material_id: string }[]>();
  const yaPosteados = new Set((exist ?? []).map((r) => r.material_id));

  // 3) Preparar inserciones
  const payload = (mats ?? [])
    .filter((m) => !yaPosteados.has(m.id))
    .map((m) => {
      const kg = Number(m.tasa_consumo_diaria_kg);
      const bultos = kg / Number(m.presentacion_kg_por_bulto || 1);
      return {
        zona_id: zonaId,
        material_id: m.id,
        fecha: date,
        tipo: "salida" as const,
        kg: Math.round(kg * 1e4) / 1e4,
        bultos: Math.round(bultos * 1e4) / 1e4,
        ref_tipo: "consumo_diario",
        ref_id: date, // clave de referencia por fecha
        notas: null as string | null,
      };
    });

  if (!payload.length) {
    return NextResponse.json({ ok: true, inserted: 0, message: "Nada por hacer (ya aplicado o sin consumos > 0)." });
  }

  const { error: errIns } = await supabase.from("movimientos_inventario").insert(payload);
  if (errIns) return NextResponse.json({ error: errIns.message }, { status: 500 });

  return NextResponse.json({ ok: true, inserted: payload.length, date, zonaId });
}
