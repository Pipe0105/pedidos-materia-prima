"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [selectedZona, setSelectedZona] = useState<string | undefined>(
    undefined
  );
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
    const zonaValida =
      zonas.find((z) => z.id === zonaFromQuery)?.id || zonas[0].id;
    if (zonaValida !== selectedZona) {
      setSelectedZona(zonaValida);
    }
  }, [zonas, zonaFromQuery, selectedZona]);

  const renderLoading = (mensaje: string) => (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de pedidos</CardTitle>
          <CardDescription>{mensaje}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );

  if (loading || !selectedZona) {
    return renderLoading("Cargando zonas disponibles...");
  }

  if (zonas.length === 0) {
    return renderLoading(
      "No hay plantas activas. Activa una zona para comenzar a tomar pedidos."
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <section className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gestión de pedidos
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Explora los pedidos por planta con un flujo guiado. Selecciona una
            zona, revisa el resumen paso a paso y completa o crea solicitudes en
            segundos.
          </p>
        </div>
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Plantas operativas</CardTitle>
              <CardDescription>
                Cambia de pestaña para ver los pedidos correspondientes a cada
                zona.
              </CardDescription>
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {zonas.length} zonas activas
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={selectedZona}
              onValueChange={(value) => {
                setSelectedZona(value);
                router.replace(`/pedidos?zonaId=${value}`);
              }}
              className="w-full"
            >
              <TabsList className="flex flex-wrap gap-2">
                {zonas.map((zona) => (
                  <TabsTrigger
                    key={zona.id}
                    value={zona.id}
                    className="rounded-full px-6 py-2 text-sm font-medium
                               data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
                               data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground/70"
                  >
                    {zona.nombre}
                  </TabsTrigger>
                ))}
              </TabsList>
              {zonas.map((zona) => (
                <TabsContent key={zona.id} value={zona.id} className="pt-6">
                  <PedidosZona zonaId={zona.id} nombre={zona.nombre} />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
