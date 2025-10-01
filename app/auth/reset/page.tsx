"use client";

export default function ResetPasswordInfo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md border text-center">
        <h1 className="text-xl font-bold mb-4">¿Olvidaste tu contraseña?</h1>
        <p className="text-gray-700 text-sm mb-6">
          Si olvidaste tu contraseña, por favor contacta al administrador del sistema.
          <br />
          Solo él puede restablecer tu acceso.
        </p>
        <a
          href="/auth/login"
          className="inline-block rounded-lg bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 transition"
        >
          Volver al login
        </a>
      </div>
    </main>
  );
}
