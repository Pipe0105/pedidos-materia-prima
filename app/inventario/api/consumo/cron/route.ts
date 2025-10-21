import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabasedamin";
import { aplicarConsumoAutomatico } from "@/app/inventario/api/apply/consumo-automatico-service";

type ZonaRow = { id: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  const date = new Date().toISOString().slice(0, 10);

  const { data: zonas, error: errZonas } = await supabaseAdmin
    .from("zonas")
    .select("id")
    .eq("activo", true)
    .returns<ZonaRow[]>();

  if (errZonas) {
    console.error("consumo cron zonas", errZonas);
    return NextResponse.json(
      { error: "No se pudieron obtener las zonas activas" },
      { status: 500 }
    );
  }

  const resultados: {
    zonaId: string;
    procesados: number;
    actualizados: number;
    sinReserva: number;
    sinStock: number;
    error?: string;
  }[] = [];

  for (const zona of zonas ?? []) {
    if (!zona.id) continue;

    try {
      const resultado = await aplicarConsumoAutomatico({
        supabaseClient: supabaseAdmin,
        zonaId: zona.id,
        date,
      });

      resultados.push({ zonaId: zona.id, ...resultado });
    } catch (error) {
      console.error("consumo cron zona", zona.id, error);
      resultados.push({
        zonaId: zona.id,
        procesados: 0,
        actualizados: 0,
        sinReserva: 0,
        sinStock: 0,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo aplicar el consumo automático",
      });
    }
  }

  return NextResponse.json({ ok: true, date, resultados });
}
