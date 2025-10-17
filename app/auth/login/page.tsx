"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ResolveUserSuccess = {
  email: string;
  role: string;
  username: string;
};

type ResolveUserError = {
  error?: string;
};

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
      // 1️⃣ Enviar solicitud al backend
      const response = await fetch("/auth/resolve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      // 2️⃣ Tipar explícitamente la respuesta del JSON
      const result = (await response.json()) as
        | ResolveUserSuccess
        | ResolveUserError;

      // 3️⃣ Validar que venga un email válido
      if (!response.ok || "error" in result || !("email" in result)) {
        throw new Error(
          (result as ResolveUserError)?.error ?? "No se pudo validar al usuario"
        );
      }

      // ✅ TypeScript ahora sabe que result.email es string
      const { email } = result;

      // 4️⃣ Iniciar sesión con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.session)
        throw new Error("No se pudo iniciar sesión, inténtalo nuevamente");

      setMsg("✅ Login exitoso");
      router.push("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ocurrió un error inesperado";
      setMsg(message);
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
