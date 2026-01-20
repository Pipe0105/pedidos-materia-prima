import React, { useState } from "react";
import { CrateType, CrateStatus, InventoryItem } from "../canastillas/types";
import { Plus, Trash2, Box } from "lucide-react";

interface Props {
  items: InventoryItem[];
  onAddItem: (item: InventoryItem) => void;
  onRemoveItem: (id: string) => void;
  onNext: () => void;
}

export const InventoryEntry: React.FC<Props> = ({
  items,
  onAddItem,
  onRemoveItem,
  onNext,
}) => {
  const [type, setType] = useState<CrateType>(CrateType.STANDARD);
  const [status, setStatus] = useState<CrateStatus>(CrateStatus.MACPOLLO);
  const [quantity, setQuantity] = useState<number>(1);
  const [placaVH, setPlacaVH] = useState<string>("");
  const [autoriza, setAutoriza] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");

  const fechaActual = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const handleAdd = () => {
    if (quantity <= 0) return;

    onAddItem({
      id: Math.random().toString(36).substr(2, 9),
      type,
      status,
      quantity,
    });
    setQuantity(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Plus size={20} className="text-blue-600" />
          Agregar Canastillas
        </h2>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Fecha
            </label>
            <input
              type="text"
              value={fechaActual}
              readOnly
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Placa VH
            </label>
            <input
              type="text"
              value={placaVH}
              onChange={(e) => setPlacaVH(e.target.value)}
              placeholder="Ingresa la placa VH"
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />
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
            <div className="flex gap-2">
              {Object.values(CrateStatus).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 px-1 rounded-lg border text-xs font-bold transition-all ${
                    status === s
                      ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-100"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s}
                </button>
              ))}
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
              Nombre quien autoriza
            </label>
            <input
              type="text"
              value={autoriza}
              onChange={(e) => setAutoriza(e.target.value)}
              placeholder="Nombre completo"
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Observaciones
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Agrega observaciones relevantes"
              rows={3}
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all resize-none"
            />
          </div>

          <button
            onClick={handleAdd}
            className="w-full mt-2 py-4 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
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
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        item.status === CrateStatus.MACPOLLO
                          ? "bg-green-100 text-green-700"
                          : item.status === CrateStatus.DON_POLLO
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {item.status}
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
    </div>
  );
};
