import React, { useEffect, useMemo, useState } from "react";
import {
  CanastillaFormValues,
  CrateType,
  InventoryItem,
} from "../canastillas/types";
import { Plus, Trash2, Box } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
  items: InventoryItem[];
  formValues: CanastillaFormValues;
  notes: string;
  onNotesChange: (val: string) => void;
  onFormChange: (values: CanastillaFormValues) => void;
  onAddItem: (item: InventoryItem) => void;
  onRemoveItem: (id: string) => void;
}

export const InventoryEntry: React.FC<Props> = ({
  items,
  formValues,
  notes,
  onNotesChange,
  onFormChange,
  onAddItem,
  onRemoveItem,
}) => {
  const [type, setType] = useState<CrateType>(CrateType.STANDARD);
  const [provider, setProvider] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [providers, setProviders] = useState<string[]>([]);
  const [providerError, setProviderError] = useState<string | null>(null);
  const { fecha, fechaDevolucion, placaVH, nombreCliente, nombreAutoriza } =
    formValues;
  const placaLength = placaVH.trim().length;
  const isPlacaValid = placaLength === 6;
  const isProviderSelected = provider.trim().length > 0;
  const isReturnDateValid =
    fechaDevolucion.trim().length === 0 || fechaDevolucion >= fecha;
  const isEntryComplete =
    isReturnDateValid &&
    isPlacaValid &&
    isProviderSelected &&
    nombreCliente.trim().length > 0 &&
    nombreAutoriza.trim().length > 0;

  const getErrorStatus = (supabaseError: unknown) => {
    if (
      typeof supabaseError === "object" &&
      supabaseError !== null &&
      "status" in supabaseError
    ) {
      const statusValue = (supabaseError as { status?: number }).status;
      return typeof statusValue === "number" ? statusValue : undefined;
    }
    return undefined;
  };

  const handleAdd = () => {
    if (quantity <= 0 || !isEntryComplete) return;
    onAddItem({
      id: Math.random().toString(36).substr(2, 9),
      type,
      provider,
      quantity,
    });
    setQuantity(1);
  };

  useEffect(() => {
    const loadProviders = async () => {
      setProviderError(null);
      const { data, error } = await supabase
        .from("canastillas_proveedores")
        .select("nombre, activo")
        .order("nombre", { ascending: true });

      if (error) {
        if (getErrorStatus(error) === 404) {
          setProviders([]);
          return;
        }
        setProviderError(
          "No se pudieron cargar los proveedores. Usa la lista por defecto o intenta más tarde.",
        );
        return;
      }

      const loadedProviders = (data ?? [])
        .filter((item) => item.activo !== false)
        .map((item) => item.nombre?.trim())
        .filter((value): value is string => Boolean(value));

      setProviders(loadedProviders);
      if (!provider && loadedProviders.length > 0) {
        setProvider(loadedProviders[0]);
      }
    };

    void loadProviders();
  }, []);

  const updateForm = (patch: Partial<CanastillaFormValues>) => {
    onFormChange({ ...formValues, ...patch });
  };
  const handlePlacaChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
    updateForm({ placaVH: sanitized });
  };

  const providerOptions = useMemo(() => {
    if (providers.length > 0) return providers;
    return ["Macpollo", "Don Pollo", "Galpon"];
  }, [providers]);

  useEffect(() => {
    if (!provider && providerOptions.length > 0) {
      setProvider(providerOptions[0]);
    }
  }, [provider, providerOptions]);

  const getProviderBadgeClasses = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized.includes("mac")) return "bg-green-100 text-green-700";
    if (normalized.includes("don")) return "bg-red-100 text-red-700";
    return "bg-orange-100 text-orange-700";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Plus size={20} className="text-blue-600" />
          Ingresar Canastillas
        </h2>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Fecha
            </label>
            <input
              type="text"
              value={fecha}
              readOnly
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Fecha de devolución
            </label>
            <input
              type="date"
              value={fechaDevolucion}
              onChange={(e) => updateForm({ fechaDevolucion: e.target.value })}
              min={fecha}
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />
            {!isReturnDateValid && (
              <p className="mt-1 text-xs font-medium text-red-500">
                La fecha de devolución no puede ser anterior a la fecha actual.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Placa VH
            </label>
            <input
              type="text"
              value={placaVH}
              onChange={(e) => handlePlacaChange(e.target.value)}
              placeholder="Ingresa la placa VH"
              maxLength={6}
              minLength={6}
              required
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />
            <p
              className={`mt-1 text-xs font-medium ${
                isPlacaValid ? "text-slate-400" : "text-red-500"
              }`}
            >
              {isPlacaValid
                ? "Debe tener exactamente 6 caracteres."
                : "La placa VH debe tener 6 caracteres (letras o números)."}
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Tipo de Canastilla
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CrateType)}
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            >
              {Object.values(CrateType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Proveedores
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                {providerOptions.map((value) => (
                  <button
                    key={value}
                    onClick={() => setProvider(value)}
                    className={`flex-1 py-2 px-1 rounded-lg border text-xs font-bold transition-all ${
                      provider === value
                        ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-100"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              {providerError && (
                <p className="text-xs font-semibold text-amber-600">
                  {providerError}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Cantidad
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-12 h-12 flex items-center justify-center rounded-xl border border-slate-300 text-xl font-bold hover:bg-slate-50"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="flex-grow text-center p-3 text-lg font-bold rounded-xl bg-slate-50 border border-slate-200"
              />
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-12 h-12 flex items-center justify-center rounded-xl border border-slate-300 text-xl font-bold hover:bg-slate-50"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Nombre cliente
            </label>
            <input
              type="text"
              value={nombreCliente}
              onChange={(e) => updateForm({ nombreCliente: e.target.value })}
              placeholder="Nombre completo"
              required
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Nombre quien autoriza
            </label>
            <input
              type="text"
              value={nombreAutoriza}
              onChange={(e) => updateForm({ nombreAutoriza: e.target.value })}
              placeholder="Nombre completo"
              required
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={!isEntryComplete}
            className={`w-full mt-2 py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
              isEntryComplete
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Plus size={20} /> Añadir al Inventario
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-2">
          Lista Actual ({items.length})
        </h3>
        {items.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <Box size={48} className="mb-2 opacity-20" />
            <p className="font-medium">No hay items registrados</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm animate-in zoom-in-95 duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    {item.quantity}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{item.type}</h4>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${getProviderBadgeClasses(
                        item.provider,
                      )}`}
                    >
                      {item.provider}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          Observaciones adicionales
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Escriba aquí cualquier detalle relevante..."
          className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 h-32 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all resize-none"
        />
      </div>

      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-blue-800 text-sm">
          <strong>Aviso:</strong> Al proceder al siguiente paso, certifica que
          los datos ingresados son correctos y están listos para ser firmados.
        </p>
      </div>
    </div>
  );
};
