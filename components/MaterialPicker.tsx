"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Material = {
  id: string;
  nombre: string;
  presentacion_kg_por_bulto: number | null;
  unidad_medida: "bulto" | "unidad" | "litro";
};

export default function MaterialPicker({
  zonaId,
  onChange,
}: {
  zonaId: string;
  onChange: (
    id: string,
    meta?: {
      nombre: string;
      presentacion_kg_por_bulto: number | null;
      unidad_medida: "bulto" | "unidad" | "litro";
    }
  ) => void;
}) {
  const [materiales, setMateriales] = useState<Material[]>([]);

  useEffect(() => {
    const fetchMateriales = async () => {
      const { data, error } = await supabase
        .from("materiales")
        .select("id, nombre, presentacion_kg_por_bulto, unidad_medida")
        .eq("zona_id", zonaId)
        .eq("activo", true)
        .order("nombre");

      if (!error && data) {
        setMateriales(data as Material[]);
      }
    };

    if (zonaId) fetchMateriales();
  }, [zonaId]);

  return (
    <select
      className="rounded-lg border px-3 py-1 text-sm"
      onChange={(e) => {
        const mat = materiales.find((m) => m.id === e.target.value);
        onChange(
          e.target.value,
          mat
            ? {
                nombre: mat.nombre,
                presentacion_kg_por_bulto: mat.presentacion_kg_por_bulto,
                unidad_medida: mat.unidad_medida,
              }
            : undefined
        );
      }}
    >
      <option value="">Seleccionar material</option>
      {materiales.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nombre}{" "}
          {m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto
            ? `(${m.presentacion_kg_por_bulto} kg/bulto)`
            : `(${m.unidad_medida})`}
        </option>
      ))}
    </select>
  );
}
