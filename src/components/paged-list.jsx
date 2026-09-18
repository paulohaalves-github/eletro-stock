"use client";

import { Button } from "@/components/ui";

export function SearchActions({ onSearch, onClear, loading, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {children || <span />}
      <div className="flex flex-wrap gap-2">
        {onClear ? (
          <Button type="button" variant="secondary" onClick={onClear} disabled={loading}>
            Limpar filtros
          </Button>
        ) : null}
        <Button type="button" onClick={onSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </div>
    </div>
  );
}

export function LoadMore({ shown, total, hasMore, loading, onClick }) {
  if (!shown && total === 0) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <p className="text-sm text-muted">
        Exibindo {shown} de {total}
      </p>
      {hasMore ? (
        <Button type="button" variant="secondary" disabled={loading} onClick={onClick}>
          {loading ? "Carregando..." : "Carregar mais"}
        </Button>
      ) : null}
    </div>
  );
}
