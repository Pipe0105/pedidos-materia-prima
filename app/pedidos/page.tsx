"use client";

import Link from "next/link";
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
import { Button } from "@/components/ui/button";

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
          <CardTitle>Pedidos de materia prima</CardTitle>
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

  const zonaActual =
    zonas.find((zona) => zona.id === selectedZona) ?? zonas[0] ?? null;

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex flex-col gap-6 rounded-2xl border bg-gradient-to-r from-[#1F4F9C] via-[#1F4F9C]/90 to-[#29B8A6]/80 p-6 text-white shadow-lg lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-white/80">
            Pedidos
          </p>
          <h1 className="text-3xl font-semibold">Pedidos de materia prima</h1>
          <p className="text-sm text-white/80">
            {zonaActual
              ? `Trabajando en la planta ${zonaActual.nombre}`
              : "Selecciona una planta para comenzar"}
          </p>
          <p className="text-xs text-white/60">
            {zonas.length
              ? `${zonas.length} ${
                  zonas.length === 1 ? "planta" : "plantas"
                } activas`
              : "Sin plantas activas"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25"
          >
            <Link href="/">Volver al panel</Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25"
          >
            <Link href="/historial">Ver historial</Link>
          </Button>
          <Button
            variant="secondary"
            className="border-none bg-white text-primary hover:bg-white/90 hover:text-primary"
            onClick={() => {
              if (!zonaActual) return;
              router.push(
                `/pedidos/nuevo?zonaId=${
                  zonaActual.id
                }&zonaNombre=${encodeURIComponent(zonaActual.nombre)}`
              );
            }}
            disabled={!zonaActual}
          >
            Crear nuevo pedido
          </Button>
        </div>
      </header>

      <section className="space-y-6">
        <Tabs
          value={selectedZona}
          onValueChange={(value) => {
            setSelectedZona(value);
            router.replace(`/pedidos?zonaId=${value}`);
          }}
          className="space-y-6"
        >
          <TabsList className="flex w-full flex-wrap justify-start gap-2 rounded-xl bg-muted/95 p-1 sm:gap-3 sm:p-2">
            {" "}
            {zonas.map((zona) => (
              <TabsTrigger
                key={zona.id}
                value={zona.id}
                className="rounded-lg border border-transparent px-6 py-3 text-sm font-semibold text-muted-foreground transition data-[state=active]:border-b-2 data-[state=active]:border-b-[#3e74cc] data-[state=active]:bg-white data-[state=active]:text-[#1F4F9C] data-[state=inactive]:hover:text-[#1F4F9C]"
              >
                {zona.nombre}
              </TabsTrigger>
            ))}
          </TabsList>
          {zonas.map((zona) => (
            <TabsContent key={zona.id} value={zona.id} className="space-y-6">
              <PedidosZona zonaId={zona.id} nombre={zona.nombre} />
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </main>
  );
}
