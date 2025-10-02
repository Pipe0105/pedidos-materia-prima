// /supabase/functions/consumo_auto/index.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // usar service key
);

export default async function handler(req: Request): Promise<Response> {
  const fecha = new Date().toISOString().slice(0, 10);

  // traer materiales activos
  const { data: mats, error } = await supabase
    .from("materiales")
    .select("id,zona_id,tasa_consumo_diaria_kg")
    .eq("activo", true);

  if (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }

  for (const m of mats ?? []) {
    if (!m.tasa_consumo_diaria_kg || m.tasa_consumo_diaria_kg <= 0) continue;

    // insertar en consumo_auto
    await supabase.from("consumo_auto").upsert({
      zona_id: m.zona_id,
      material_id: m.id,
      fecha,
      kg: m.tasa_consumo_diaria_kg,
    });

    // registrar movimiento de inventario
    await supabase.from("movimientos_inventario").insert({
      zona_id: m.zona_id,
      material_id: m.id,
      fecha,
      kg: m.tasa_consumo_diaria_kg,
      tipo: "salida",
    });
  }

  return new Response("Consumo automático registrado", { status: 200 });
}
