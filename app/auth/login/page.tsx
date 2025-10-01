"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Opcional: cargar info extendida del usuario desde tu tabla "usuarios"
      const user = data.user;
      if (user) {
        const { data: perfil } = await supabase
          .from("usuarios")
          .select("nombre, rol, zona_id")
          .eq("id", user.id)
          .single();

        console.log("Perfil:", perfil);
      }

      setMsg("Login exitoso ✅");
      router.push("/"); // Redirigir al dashboard
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      <form onSubmit={handleLogin} className="space-y-3">
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
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </main>
  );
}
