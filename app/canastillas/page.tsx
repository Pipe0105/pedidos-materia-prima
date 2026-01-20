"use client";

import React, { useState } from "react";
import { InventoryEntry } from "@/app/canastillas/InventoryEntry";
import { InventoryOverview } from "@/app/canastillas/InventoryOverview";
import { SignaturePad } from "@/app/canastillas/SignaturePad";
import { SuccessView } from "@/app/canastillas/SuccessView";
import { Summary } from "@/app/canastillas/Summary";
import { CanastillaFormValues, InventoryItem } from "@/app/canastillas/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

enum Step {
  ENTRY = 0,
  SUMMARY = 1,
  SIGNATURE = 2,
  SUCCESS = 3,
}

const getTodayDate = () => new Date().toISOString().slice(0, 10);

export default function CrateFlowPage() {
  const [currentStep, setCurrentStep] = useState<Step>(Step.ENTRY);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [signature, setSignature] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [showInventory, setShowInventory] = useState(false);
  const [formValues, setFormValues] = useState<CanastillaFormValues>({
    fecha: getTodayDate(),
    fechaDevolucion: "",
    placaVH: "",
    nombreCliente: "",
    nombreAutoriza: "",
  });

  const handleAddItem = (item: InventoryItem) => {
    setItems([...items, item]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleReset = () => {
    setCurrentStep(Step.ENTRY);
    setItems([]);
    setNotes("");
    setSignature("");
    setFormValues({
      fecha: getTodayDate(),
      fechaDevolucion: "",
      placaVH: "",
      nombreCliente: "",
      nombreAutoriza: "",
    });
    setSaveError(null);
    setIsSaving(false);
  };

  const canProceedFromEntry =
    items.length > 0 && formValues.placaVH.trim().length === 6;

  const handleSaveSignature = async (dataUrl: string) => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const observaciones = notes.trim();

    const payload = items.map((item) => ({
      fecha: formValues.fecha,
      placa_vh: formValues.placaVH,
      tipo_canastilla: item.type,
      nombre_cliente: formValues.nombreCliente,
      proveedor: item.provider,
      fecha_devolucion: formValues.fechaDevolucion || null,
      cantidad: item.quantity,
      nombre_autoriza: formValues.nombreAutoriza,
      observaciones: observaciones || null,
      firma: dataUrl,
    }));

    const { error } = await supabase.from("canastillas").insert(payload);
    if (error) {
      setSaveError(
        "No se pudo guardar el registro. Verifica la conexión y vuelve a intentar.",
      );
      setIsSaving(false);
      return;
    }

    setSignature(dataUrl);
    setCurrentStep(Step.SUCCESS);
    setIsSaving(false);
    setHistoryRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setShowInventory((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
          >
            {showInventory ? "Volver al registro" : "Ver inventario"}
          </button>
        </div>
        {showInventory ? (
          <InventoryOverview refreshKey={historyRefreshKey} />
        ) : (
          <>
            {/* Progress Indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                {["Registro", "Resumen", "Firma", "Completado"].map(
                  (label, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col items-center flex-1"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                          idx === currentStep
                            ? "bg-blue-600 text-white scale-110 shadow-lg shadow-blue-200"
                            : idx < currentStep
                              ? "bg-green-500 text-white"
                              : "bg-slate-200 text-slate-400"
                        }`}
                      >
                        {idx < currentStep ? "✓" : idx + 1}
                      </div>
                      <span
                        className={`text-xs mt-2 font-semibold ${
                          idx === currentStep
                            ? "text-blue-600"
                            : "text-slate-400"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  ),
                )}
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-500 ease-out"
                  style={{ width: `${(currentStep / 3) * 100}%` }}
                />
              </div>
            </div>

            {/* Step Content */}
            {currentStep === Step.ENTRY && (
              <InventoryEntry
                items={items}
                formValues={formValues}
                onFormChange={setFormValues}
                onAddItem={handleAddItem}
                onRemoveItem={handleRemoveItem}
                onNext={() => setCurrentStep(Step.SUMMARY)}
              />
            )}

            {currentStep === Step.SUMMARY && (
              <Summary
                items={items}
                notes={notes}
                onNotesChange={setNotes}
                onBack={() => setCurrentStep(Step.ENTRY)}
                onNext={() => setCurrentStep(Step.SIGNATURE)}
              />
            )}

            {currentStep === Step.SIGNATURE && (
              <SignaturePad
                onSave={handleSaveSignature}
                onBack={() => setCurrentStep(Step.SUMMARY)}
                isSaving={isSaving}
                errorMessage={saveError}
              />
            )}

            {currentStep === Step.SUCCESS && (
              <SuccessView
                items={items}
                signature={signature}
                onReset={handleReset}
              />
            )}

            {/* Navigation Buttons (except for signature and success steps) */}
            {currentStep !== Step.SIGNATURE && currentStep !== Step.SUCCESS && (
              <div className="mt-8 grid gap-3">
                {currentStep === Step.ENTRY && (
                  <button
                    onClick={() => setCurrentStep(Step.SUMMARY)}
                    disabled={!canProceedFromEntry}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                      canProceedFromEntry
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    }`}
                  >
                    Continuar a Resumen <ChevronRight size={20} />
                  </button>
                )}

                {currentStep === Step.SUMMARY && (
                  <>
                    <button
                      onClick={() => setCurrentStep(Step.SIGNATURE)}
                      className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                    >
                      Proceder a Firma <ChevronRight size={20} />
                    </button>
                    <button
                      onClick={() => setCurrentStep(Step.ENTRY)}
                      className="w-full py-3 text-slate-500 font-semibold hover:text-slate-700 flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={20} /> Regresar al Registro
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
