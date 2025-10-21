import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabasedamin";
import type { InventarioActualRow } from "@/app/(dashboard)/_components/_types";

export async function GET(request: NextRequest) {
  const zonaParam = request.nextUrl.searchParams.get("zonaId");
  const zonaId = zonaParam && zonaParam.trim().length > 0 ? zonaParam : null;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (zonaId) {
      const { data, error } = await supabaseAdmin.rpc("inventario_actual", {
        p_zona: zonaId,
      });

      if (error) {
        console.error("inventario_actual error", error);
        return NextResponse.json(
          { error: "No se pudo obtener el inventario actual" },
          { status: 500 }
        );
      }

      return NextResponse.json((data as InventarioActualRow[]) ?? []);
    }

    const { data: zonas, error: zonasError } = await supabaseAdmin
      .from("zonas")
      .select("id")
      .eq("activo", true);

    if (zonasError) {
      console.error("inventario_actual zonas error", zonasError);
      return NextResponse.json(
        { error: "No se pudo obtener el inventario actual" },
        { status: 500 }
      );
    }

    const zonaIds = (zonas ?? [])
      .map((zona) => zona.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const resultados: InventarioActualRow[] = [];

    for (const id of zonaIds) {
      const { data, error } = await supabaseAdmin.rpc("inventario_actual", {
        p_zona: id,
      });

      if (error) {
        console.error("inventario_actual error", { zonaId: id, error });
        return NextResponse.json(
          { error: "No se pudo obtener el inventario actual" },
          { status: 500 }
        );
      }

      if (Array.isArray(data)) {
        resultados.push(...(data as InventarioActualRow[]));
      }
    }

    return NextResponse.json(resultados);
  } catch (err) {
    console.error("inventario_actual unexpected", err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "No se pudo obtener el inventario actual" },
      { status: 500 }
    );
  }
}
