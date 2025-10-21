"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setStatus("idle");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error("Ingresa un correo electrónico válido");
      }

      // 4️⃣ Iniciar sesión con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) throw error;
      if (!data.session)
        throw new Error("No se pudo iniciar sesión, inténtalo nuevamente");

      setMsg("✅ Login exitoso");
      setStatus("success");

      const redirectTo = searchParams.get("redirectTo");
      const isValidRedirect =
        redirectTo &&
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//");
      const destination =
        isValidRedirect && redirectTo !== "/auth/login" ? redirectTo : "/";

      router.push(destination);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ocurrió un error inesperado";
      setMsg(message);
      setStatus("error");
      console.error("[Login] Error al iniciar sesión", error);
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
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        {msg && (
          <p
            className={`mt-4 text-center text-sm ${
              status === "error" ? "text-red-600" : "text-green-600"
            }`}
          >
            {msg}
          </p>
        )}
      </div>
    </main>
  );
}
