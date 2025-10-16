import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabasedamin";

export async function GET(request: NextRequest) {
  const zonaParam = request.nextUrl.searchParams.get("zonaId");
  const zonaId = zonaParam && zonaParam.trim().length > 0 ? zonaParam : null;

  try {
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
    return NextResponse.json(
      { error: "No se pudo obtener el inventario actual" },
      { status: 500 }
    );
  }
}
