"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const redirectTo = `${window.location.origin}/auth/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo, // ✅ corregido
      });

      if (error) throw error;

      setMessage(
        "Te enviamos un correo con las instrucciones para reestablecer tu contraseña"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No pudimos enviar el correo";
      setMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md border text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Restablecer contraseña</h1>
          <p className="text-gray-700 text-sm">
            Ingresa tu correo electrónico para enviarte un enlace seguro de
            recuperación.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <label className="block text-sm font-medium text-gray-700">
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="tu-correo@empresa.com"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 text-white px-3 py-2 text-sm disabled:opacity-60"
          >
            {loading ? "Enviando…" : "Enviar instrucciones"}
          </button>
        </form>
        {message && <p className="text-sm text-gray-700">{message}</p>}
        <Link
          href="/auth/login"
          className="inline-block rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </main>
  );
}
