import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabasedamin";

export async function GET(request: NextRequest) {
  const zonaParam = request.nextUrl.searchParams.get("zonaId");
  const zonaId = zonaParam && zonaParam.trim().length > 0 ? zonaParam : null;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc("inventario_actual", {
      p_zona: zonaId,
    });

    if (error) {
      console.error("inventario_actual error", error);
      return NextResponse.json(
        { error: "No se pudo obtener el inventario actuai" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
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
