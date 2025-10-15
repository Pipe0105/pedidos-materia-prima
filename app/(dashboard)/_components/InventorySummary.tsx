"use client";

import { Info, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { COBERTURA_TONO } from "@/app/(dashboard)/_components/dashboard";

type InventoryCard = {
  key: keyof typeof COBERTURA_TONO;
  value: number;
  gradient: string;
};

type InventorySummaryProps = {
  cards: InventoryCard[];
  isUpdating: boolean;
  isLoadingInventory: boolean;
  hasMateriales: boolean;
  error: string | null;
};

export function InventorySummary({
  cards,
  isUpdating,
  isLoadingInventory,
  hasMateriales,
  error,
}: InventorySummaryProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Estado de Cobertura
          </h2>
          <p className="text-sm text-slate-500">
            Seguimiento de materiales segun dias disponibles
          </p>
        </div>
        {isUpdating && (
          <span className="flex items-center gap-2 text-xs font-medium text-[#1F4F9X]">
            <Loader2 className="h-4 w-4 animate-spin" /> Actualizando datos
          </span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ key, value, gradient }) => {
          const tone = COBERTURA_TONO[key];
          return (
            <Card
              key={String(key)}
              className="relative overflow-hidden border-none bg-[#F4f6FB]"
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                  gradient
                )}
              />
              <CardHeader className="relative flex items-center justify-between">
                <CardTitle className="text-2xl font-semibold text-slate-900">
                  {value}
                </CardTitle>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                    tone.badge
                  )}
                >
                  {tone.label}
                </span>
              </CardHeader>
              <CardContent className="relative space-y-3">
                {isLoadingInventory && !hasMateriales ? (
                  <Skeleton className="h-6 w-24 bg-white/40" />
                ) : (
                  <p className="text-sm text-slate-700">{tone.description}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[#F5A623]/40 bg-[#F5A623]/10 p-3 text-sm text-[#92400E]">
          <Info className="h-4 w-4" /> {error}
        </div>
      )}
    </section>
  );
}
