"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      // 1. Buscar el usuario en tu tabla `usuarios`
      const { data: userRow, error: e1 } = await supabase
        .from("usuarios")
        .select("id, username, rol")
        .eq("username", username)
        .single();

      if (e1 || !userRow) throw new Error("Usuario no encontrado");

      // 2. Buscar el email real en auth.users
      const { data: authUser, error: e2 } = await supabase
        .from("auth.users")
        .select("email")
        .eq("id", userRow.id)
        .single();

      if (e2 || !authUser) throw new Error("No se encontró correo vinculado");

      // 3. Hacer login con email y contraseña
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password,
      });

      if (error) throw error;

      // 4. Guardar info local
      localStorage.setItem("rol", userRow.rol);
      localStorage.setItem("username", userRow.username);

      setMsg("✅ Login exitoso");
      router.push("/");
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md border">
        <h1 className="text-xl font-bold text-center mb-6">Iniciar sesión</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            placeholder="Nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 text-white px-3 py-2 text-sm"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        {msg && <p className="mt-4 text-center text-sm text-gray-700">{msg}</p>}
      </div>
    </main>
  );
}
