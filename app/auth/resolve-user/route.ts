import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabasedamin";

const resolveUserSchema = z.object({
  username: z
    .string({ message: "El nombre de usuario es obligatorio" })
    .min(1, "El nombre de usuario es obligatorio"),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = resolveUserSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "datos inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const username = parsed.data.username.trim();

  if (!username) {
    return NextResponse.json(
      { error: "El nombre de usuario es obligatorio" },
      { status: 400 }
    );
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    console.error("resolve-user supabase init error", error);
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo inicializar el cliente de Supabase";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: userRow, error: userError } = await supabaseAdmin
    .from("usuarios")
    .select("id, username, rol")
    .ilike("username", username)
    .maybeSingle();

  if (userError) {
    return NextResponse.json(
      { error: "No se pudo consultar la tabla de usuarios" },
      { status: 500 }
    );
  }

  if (!userRow) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.getUserById(userRow.id);

  if (authError) {
    return NextResponse.json(
      { error: "No se pudo obtener la cuenta de Supabase" },
      { status: 500 }
    );
  }

  const user = authData.user;

  if (!user?.email) {
    return NextResponse.json(
      { error: "El usuario no tiene un correo vinculado" },
      { status: 422 }
    );
  }

  const role =
    (user.user_metadata?.role as string | undefined) ?? userRow.rol ?? "user";

  return NextResponse.json({
    email: user.email,
    role,
    username: userRow.username,
  });
}
