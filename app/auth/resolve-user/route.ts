import { NextResponse } from "next/server";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
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

  type UserRow = { id: string; username: string | null; rol: string | null };

  const { data: userRowData, error: userError } = await supabaseAdmin
    .from("usuarios")
    .select("id, username, rol")
    .ilike("username", username)
    .maybeSingle();

  const userRow = (userRowData ?? null) as UserRow | null;

  if (userError) {
    return NextResponse.json(
      { error: "No se pudo consultar la tabla de usuarios" },
      { status: 500 }
    );
  }

  let resolvedUserRow = userRow;
  let authUser: User | null = null;

  if (!resolvedUserRow) {
    if (username.includes("@")) {
      const normalizedEmail = username.toLowerCase();
      const { data: authList, error: authLookupError } =
        await supabaseAdmin.auth.admin.listUsers({
          email: normalizedEmail,
          perPage: 1,
        });

      if (authLookupError) {
        if (authLookupError.status === 404) {
          return NextResponse.json(
            { error: "Usuario no encontrado" },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: "No se pudo consultar la cuenta de Supabase" },
          { status: 500 }
        );
      }
      const authUserLookup =
        authList?.users.find(
          (candidate) => candidate.email?.toLowerCase() === normalizedEmail
        ) ?? null;

      if (!authUserLookup) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        );
      }

      const { data: authByIdData, error: authByIdError } =
        await supabaseAdmin.auth.admin.getUserById(authUserLookup.id);

      if (authByIdError) {
        if (authByIdError.status === 404) {
          return NextResponse.json(
            { error: "Usuario no encontrado" },
            { status: 404 }
          );
        }

        return NextResponse.json(
          { error: "No se pudo obtener la cuenta de Supabase" },
          { status: 500 }
        );
      }

      const authUserById = authByIdData?.user ?? null;
      authUser = authUserById ?? authUserLookup;

      const { data: userByIdData, error: userByIdError } = await supabaseAdmin
        .from("usuarios")
        .select("id, username, rol")
        .eq("id", authUser.id)
        .maybeSingle();

      if (userByIdError) {
        return NextResponse.json(
          { error: "No se pudo consultar la tabla de usuarios" },
          { status: 500 }
        );
      }

      const userById = (userByIdData ?? null) as UserRow | null;
      resolvedUserRow = userById ?? {
        id: authUser.id,
        username:
          (authUser.user_metadata?.username as string | undefined) ??
          authUser.email ??
          username,
        rol: (authUser.user_metadata?.role as string | undefined) ?? null,
      };
    } else {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }
  }

  if (!resolvedUserRow) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  if (!authUser) {
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(resolvedUserRow.id);

    if (authError) {
      if (authError.status === 404) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "No se pudo obtener la cuenta de Supabase" },
        { status: 500 }
      );
    }

    authUser = authData.user;
  }

  const user = authUser;

  if (!user?.email) {
    return NextResponse.json(
      { error: "El usuario no tiene un correo vinculado" },
      { status: 422 }
    );
  }

  const role =
    (user.user_metadata?.role as string | undefined) ??
    resolvedUserRow?.rol ??
    "user";

  const resolvedUsername =
    resolvedUserRow?.username ??
    (user.user_metadata?.username as string | undefined) ??
    user.email;

  return NextResponse.json({
    email: user.email,
    role,
    username: resolvedUsername,
  });
}
