"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ConsumoManualDialog } from "@/app/inventario/_components/ConsumoManualDialog";
import type { MaterialConsumo, Unidad } from "@/app/inventario/types";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

const EMPTY_CONSUMO: MaterialConsumo = { id: "", nombre: "", unidad: "bulto" };

type ZonaKey = "desprese" | "desposte";

type ZonaInfo = {
  id: string;
  nombre: string;
  materiales: MaterialConsumo[];
};

const ZONA_LABELS: Record<ZonaKey, string> = {
  desprese: "Desprese",
  desposte: "Desposte",
};

export default function PconsumoPage() {
  const [zonas, setZonas] = useState<Partial<Record<ZonaKey, ZonaInfo>>>({});
  const [selectedZonaKey, setSelectedZonaKey] = useState<ZonaKey | null>(null);
  const [materialConsumo, setMaterialConsumo] =
    useState<MaterialConsumo>(EMPTY_CONSUMO);
  const [valorConsumo, setValorConsumo] = useState("");
  const [showConsumo, setShowConsumo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargarZonas = useCallback(async () => {
    const { data: zonasData, error: zonasError } = await supabase
      .from("zonas")
      .select("id, nombre");

    if (zonasError) {
      console.error("❌ Error obteniendo zonas para consumo:", zonasError);
      return;
    }

    const relevantes: Partial<Record<ZonaKey, ZonaInfo>> = {};

    for (const zona of zonasData ?? []) {
      const nombreNormalizado = zona.nombre.trim().toLowerCase();
      if (
        nombreNormalizado === "desprese" ||
        nombreNormalizado === "desposte"
      ) {
        const { data: materialesData, error: materialesError } = await supabase
          .from("materiales")
          .select("id, nombre, unidad_medida, activo")
          .eq("zona_id", zona.id)
          .eq("activo", true);

        if (materialesError) {
          console.error(
            "❌ Error obteniendo materiales para consumo:",
            materialesError
          );
          continue;
        }

        const materiales = (materialesData ?? [])
          .filter((material) => material.activo !== false)
          .map(
            (material) =>
              ({
                id: material.id,
                nombre: material.nombre,
                unidad: material.unidad_medida as Unidad,
              } satisfies MaterialConsumo)
          );

        relevantes[nombreNormalizado as ZonaKey] = {
          id: zona.id,
          nombre: zona.nombre,
          materiales,
        };
      }
    }

    setZonas(relevantes);
  }, []);

  useEffect(() => {
    void cargarZonas();
  }, [cargarZonas]);

  const zonaSeleccionada = useMemo(() => {
    if (!selectedZonaKey) return null;
    return zonas[selectedZonaKey] ?? null;
  }, [selectedZonaKey, zonas]);

  const abrirConsumo = (zonaKey: ZonaKey) => {
    const zona = zonas[zonaKey];
    if (!zona) {
      alert("No se encontró la zona seleccionada.");
      return;
    }

    if (!zona.materiales.length) {
      alert(
        "No hay materiales activos configurados para registrar consumo en esta zona."
      );
      return;
    }

    setSelectedZonaKey(zonaKey);
    setMaterialConsumo(zona.materiales[0]);
    setValorConsumo("");
    setShowConsumo(true);
  };

  const guardarConsumoManual = useCallback(async () => {
    if (!zonaSeleccionada) {
      alert("No se encontró la zona para registrar el consumo.");
      return;
    }

    const cantidad = parseFloat(valorConsumo);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      alert("Por favor ingrese una cantidad válida.");
      return;
    }

    setGuardando(true);

    const { id: materialId, unidad } = materialConsumo;

    const { data: matData, error: matError } = await supabase
      .from("materiales")
      .select("presentacion_kg_por_bulto")
      .eq("id", materialId)
      .single();

    if (matError) {
      alert("❌ Error obteniendo presentación del material.");
      setGuardando(false);
      return;
    }

    const presentacion = matData?.presentacion_kg_por_bulto || 1;

    let bultos: number | null = null;
    let kg = 0;

    if (unidad === "bulto") {
      bultos = cantidad;
      kg = cantidad * presentacion;
    } else if (unidad === "litro") {
      bultos = null;
      kg = cantidad;
    } else if (unidad === "unidad") {
      bultos = cantidad;
      kg = 0;
    }

    const { error } = await supabase.from("movimientos_inventario").insert({
      zona_id: zonaSeleccionada.id,
      material_id: materialId,
      fecha: new Date().toISOString().slice(0, 10),
      tipo: "salida",
      bultos,
      kg,
      ref_tipo: "consumo_manual",
      notas: `Consumo manual registrado (${cantidad} ${unidad}${
        cantidad !== 1 ? "s" : ""
      })`,
    });

    if (error) {
      alert("❌ Error registrando consumo manual: " + error.message);
    } else {
      alert("✅ Consumo manual guardado correctamente");
      setShowConsumo(false);
    }

    setGuardando(false);
  }, [materialConsumo, valorConsumo, zonaSeleccionada]);

  return (
    <PageContainer className="flex min-h-screen flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-10">
        <div className="grid w-full max-w-lg gap-6 sm:grid-cols-2">
          {(Object.keys(ZONA_LABELS) as ZonaKey[]).map((key) => (
            <Button
              key={key}
              onClick={() => abrirConsumo(key)}
              className="h-32 rounded-2xl text-lg font-semibold shadow-lg"
              disabled={!zonas[key] || guardando}
            >
              {ZONA_LABELS[key]}
            </Button>
          ))}
        </div>
      </div>

      <ConsumoManualDialog
        open={showConsumo}
        material={materialConsumo}
        value={valorConsumo}
        onClose={() => {
          if (guardando) return;
          setShowConsumo(false);
          setValorConsumo("");
        }}
        onChange={setValorConsumo}
        onSubmit={() => {
          if (!guardando) void guardarConsumoManual();
        }}
      />
    </PageContainer>
  );
}
