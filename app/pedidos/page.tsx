"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import PedidosZona from "./pedidoszonas";

  type Zona = {
    id: string;
    nombre: string;
  };

export default function PedidosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZona, setSelectedZona] = useState<string | undefined>(undefined);
  const zonaFromQuery = searchParams.get("zonaId");

  useEffect(() => {
    const fetchZonas = async () => {
      const { data, error } = await supabase
        .from("zonas")
        .select("id, nombre")
        .eq("activo", true);

      if (error) {
        console.error("Error cargando zonas:", error);
      } else {
        // ✅ Filtramos Inventario General (solo queremos plantas)
        const zonasOrdenadas = (data || [])
          .filter((z) => z.nombre !== "Inventario General")
          .sort((a, b) => {
            const orden = ["Desposte", "Desprese", "Panificadora"];
            return orden.indexOf(a.nombre) - orden.indexOf(b.nombre);
          });

        setZonas(zonasOrdenadas);
        setSelectedZona((prev) => prev ?? zonasOrdenadas[0]?.id);
      }
      setLoading(false);
    };

    fetchZonas();
  }, []);

  useEffect(() => {
    if (zonas.length === 0) return;
    const zonaValida = zonas.find((z) => z.id === zonaFromQuery)?.id || zonas[0].id;
    if (zonaValida !== selectedZona) {
      setSelectedZona(zonaValida);
    }
  }, [zonas, zonaFromQuery, selectedZona]);

  if (loading) {
    return <div className="p-6">Cargando zonas...</div>;
  }

  if (zonas.length === 0) {
    return <div className="p-6">No hay zonas disponibles.</div>;
  }

  if (!selectedZona) {
    return <div className="p-6">Cargando zonas...</div>;
  }

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Gestión de Pedidos</h1>

      </header>

      <Tabs
        value={selectedZona}
        onValueChange={(value) => {
          setSelectedZona(value);
          router.replace(`/pedidos?zonaId=${value}`);
        }}
        className="w-full"
      >
        {/* ✅ Tabs estilo pill */}
        <TabsList className="flex space-x-2">
          {zonas.map((zona) => (
            <TabsTrigger
              key={zona.id}
              value={zona.id}
              className="px-6 py-2 text-sm font-medium rounded-full
                         data-[state=active]:bg-blue-600 
                         data-[state=active]:text-white 
                         data-[state=inactive]:bg-gray-200 
                         data-[state=inactive]:text-gray-700"
            >
              {zona.nombre}
            </TabsTrigger>
          ))}
        </TabsList>

        {zonas.map((zona) => (
          <TabsContent key={zona.id} value={zona.id}>
            <PedidosZona zonaId={zona.id} nombre={zona.nombre} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
