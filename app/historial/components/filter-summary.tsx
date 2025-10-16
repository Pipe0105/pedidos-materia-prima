import { Fragment } from "react";

type FilterSummaryProps = {
  filters: {
    label: string;
    value: string;
    onRemove: () => void;
  }[];
  onClearAll: () => void;
};

export function FilterSummary({ filters, onClearAll }: FilterSummaryProps) {
  if (!filters.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-700">
      <span className="font-medium">Filtros activos:</span>
      {filters.map((filter) => (
        <Fragment key={`${filter.label}-${filter.value}`}>
          <button
            type="button"
            onClick={filter.onRemove}
            className="flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
          >
            <span className="text-[11px] uppercase tracking-wide text-blue-400">
              {filter.label}
            </span>
            {filter.value}
            <span className="text-blue-300">×</span>
          </button>
        </Fragment>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-auto text-xs font-medium text-blue-600 underline-offset-2 transition hover:underline"
      >
        Limpiar filtros
      </button>
    </div>
  );
}
