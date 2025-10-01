"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onChange: (
    materialId: string,
    meta?: { nombre: string; presentacion_kg_por_bulto: number }
  ) => void;
}) {
  const [items, setItems] = useState<Material[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!zonaId) {
        setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from("materiales")
        .select("id,nombre,presentacion_kg_por_bulto")
        .eq("zona_id", zonaId)
        .eq("activo", true)
        .order("nombre");
      if (error) {
        console.error("Error cargando materiales:", error);
        return;
      }
      setItems(data ?? []);
    })();
  }, [zonaId]);

  const selected = useMemo(
    () => items.find((m) => m.id === value),
    [items, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selected ? selected.nombre : "Selecciona…"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0">
        <Command>
          <CommandInput placeholder="Buscar material…" />
          <CommandList>
            <CommandEmpty>No hay resultados.</CommandEmpty>
            <CommandGroup>
              {items.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.nombre}
                  onSelect={() => {
                    onChange(m.id, {
                      nombre: m.nombre,
                      presentacion_kg_por_bulto: m.presentacion_kg_por_bulto,
                    });
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      m.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {m.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
