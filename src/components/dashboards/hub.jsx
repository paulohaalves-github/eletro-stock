"use client";

import { useRouter } from "next/navigation";
import { Boxes, Handshake, Headset } from "lucide-react";
import { cn } from "@/lib/format";
import { ProductsDashboard } from "./products-dashboard";
import { SalesDashboard } from "./sales-dashboard";
import { InboxDashboard } from "./inbox-dashboard";

const ICONS = {
  produtos: Boxes,
  comercial: Handshake,
  "contact-center": Headset,
};

export function DashboardsHub({ view, views }) {
  const router = useRouter();
  const current = views.find((item) => item.id === view) || views[0];

  function selectView(id) {
    if (id === view) return;
    router.push(`/dashboards?view=${id}`);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Gestão</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Dashboards</h1>
          <p className="mt-1 text-sm text-muted">Escolha a visão de Produtos, Comercial ou Contact Center.</p>
        </div>
        <div className="flex w-full flex-col gap-1 rounded-2xl border border-border bg-surface p-1 sm:w-auto sm:flex-row" role="tablist" aria-label="Selecionar dashboard">
          {views.map((item) => {
            const Icon = ICONS[item.id];
            const active = item.id === current.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectView(item.id)}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                  active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                {Icon ? <Icon size={16} /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {current.id === "produtos" ? <ProductsDashboard embedded /> : null}
      {current.id === "comercial" ? <SalesDashboard embedded /> : null}
      {current.id === "contact-center" ? <InboxDashboard embedded /> : null}
    </div>
  );
}
