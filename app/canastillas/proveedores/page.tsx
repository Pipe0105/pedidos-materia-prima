"use client";

import React, { useState } from "react";
import { ArrowLeft, CheckCircle2, Truck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function CrateSuppliersPage() {
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setNombre("");
    setContacto("");
    setTelefono("");
    setNotas("");
    setGuardado(false);
    setIsSaving(false);
    setErrorMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nombre.trim()) return;
    setIsSaving(true);
    setErrorMessage(null);

    const { error } = await supabase.from("canastillas_proveedores").insert({
      nombre: nombre.trim(),
      contacto: contacto.trim() || null,
      telefono: telefono.trim() || null,
      notas: notas.trim() || null,
      activo: true,
    });

    if (error) {
      setErrorMessage(
        "No se pudo guardar el proveedor. Verifica la conexión e intenta de nuevo.",
      );
      setIsSaving(false);
      return;
    }

    setGuardado(true);
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-[0.2em]">
              Canastillas
            </p>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Truck size={24} className="text-blue-600" />
              Crear proveedor
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Registra proveedores nuevos para canastillas sin salir del flujo
              principal.
            </p>
          </div>
          <a
            href="/canastillas"
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <ArrowLeft size={16} /> Volver
          </a>
        </header>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {guardado ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Proveedor creado
                </h2>
                <p className="text-sm text-slate-500">
                  Ya puedes regresar al registro de canastillas y seleccionarlo.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:border-slate-300 hover:text-slate-800"
                >
                  Crear otro proveedor
                </button>
                <a
                  href="/canastillas"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Volver a canastillas
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nombre del proveedor
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  required
                  placeholder="Ej. Proveedores del Norte"
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nombre de contacto
                </label>
                <input
                  type="text"
                  value={contacto}
                  onChange={(event) => setContacto(event.target.value)}
                  placeholder="Persona responsable"
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  placeholder="Número de contacto"
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={notas}
                  onChange={(event) => setNotas(event.target.value)}
                  rows={4}
                  placeholder="Horarios, condiciones o comentarios relevantes."
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all resize-none"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all"
                >
                  {isSaving ? "Guardando..." : "Guardar proveedor"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:border-slate-300 hover:text-slate-800"
                >
                  Limpiar formulario
                </button>
              </div>
              {errorMessage && (
                <p className="text-sm font-semibold text-red-600">
                  {errorMessage}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
