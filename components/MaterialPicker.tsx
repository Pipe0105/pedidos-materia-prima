"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Material = {
  id: string;
  nombre: string;
  presentacion_kg_por_bulto: number;
};

export default function MaterialPicker({
  zonaId,
  value,
  onChange,
}: {
  zonaId: string;
  value?: string;
  onChange: (materialId: string) => void;
}) {
  const [items, setItems] = useState<Material[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      if (!zonaId) return;
      const { data } = await supabase
        .from("materiales")
        .select("id,nombre,presentacion_kg_por_bulto")
        .eq("zona_id", zonaId)
        .eq("activo", true)
        .order("nombre")
        .returns<Material[]>();
      setItems(data ?? []);
    })();
  }, [zonaId]);

  const filtered = useMemo(
    () => (q ? items.filter((m) => m.nombre.toLowerCase().includes(q.toLowerCase())) : items),
    [items, q]
  );

  return (
    <div className="flex gap-2">
      <input
        className="w-44 rounded-lg border px-2 py-1 text-sm"
        placeholder="Buscar…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className="w-64 rounded-lg border px-2 py-1 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Selecciona…
        </option>
        {filtered.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
