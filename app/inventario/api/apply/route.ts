// app/api/consumo/apply/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { calcularConsumoDiarioKg } from "@/lib/consumo";
import { aplicarConsumoAutomatico } from "./consumo-automatico-service";
const querySchema = z.object({
  zonaId: z
    .string()
    .nonempty("Falta el ID de la zona")
    .min(1, "Falta Id de la zona")
    .max(128, "El Id es demasiado largo")
    .refine((value) => /^[a-zA-Z0-9_-]+$/.test(value), {
      message: "El Id de la zona contiene caracteres no permitidos",
    }),
  date: z
    .string()
    .regex(
      /^(\d{4})-(\d{2})-(\d{2})$/,
      "Formato de fecha inválido (YYYY-MM-DD)"
    )
    .optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/consumo/apply?zonaId=...&date=YYYY-MM-DD
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const parseResult = querySchema.safeParse({
    zonaId: searchParams.get("zonaId"),
    date: searchParams.get("date") ?? undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Parametros invalidos", issues: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const zonaId = parseResult.data.zonaId;
  const date = parseResult.data.date ?? new Date().toISOString().slice(0, 10);

  try {
    const resultado = await aplicarConsumoAutomatico({
      supabaseClient: supabase,
      zonaId,
      date,
    });

    return NextResponse.json({
      ok: true,
      date,
      zonaId,
      ...resultado,
    });
  } catch (error) {
    console.error("consumo automatico apply", error);
    const message =
      error instanceof Error ? error.message : "No se pudo aplicar el consumo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
