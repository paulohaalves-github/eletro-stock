"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import {
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  BarChart3,
  Tags,
  Layers3,
  MapPin,
  Users,
  ScrollText,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { can, PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/format";
import { GlobalSearch } from "./global-search";
import { ROLE_LABELS } from "@/lib/constants";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  { href: "/estoque", label: "Estoque", icon: Boxes, permission: PERMISSIONS.PRODUCT_VIEW },
  { href: "/entrada", label: "Entrada", icon: ArrowDownToLine, permission: PERMISSIONS.STOCK_ENTRY },
  { href: "/saida", label: "Saída", icon: ArrowUpFromLine, permission: PERMISSIONS.STOCK_EXIT },
  { href: "/movimentacoes", label: "Movimentações", icon: History, permission: PERMISSIONS.HISTORY_VIEW },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, permission: PERMISSIONS.REPORT_VIEW },
  { href: "/categorias", label: "Categorias", icon: Tags, permission: PERMISSIONS.CATEGORY_MANAGE },
  { href: "/linhas", label: "Linhas", icon: Layers3, permission: PERMISSIONS.LINE_MANAGE },
  { href: "/localizacoes", label: "Localizações", icon: MapPin, permission: PERMISSIONS.LOCATION_MANAGE },
  { href: "/usuarios", label: "Usuários", icon: Users, permission: PERMISSIONS.USER_MANAGE },
  { href: "/auditoria", label: "Auditoria", icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
];

export function AppShell({ user, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((item) => can(user.role, item.permission));

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-accent/15 text-accent glow-border" : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="relative z-10 min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print hidden border-r border-border bg-surface/80 p-4 backdrop-blur lg:flex lg:flex-col">
        <Link href="/" className="mb-8 flex items-center gap-3 px-2">
          <img src="/logo.svg" alt="Eletro-Stock" className="h-10 w-10" />
          <div>
            <p className="text-sm font-semibold tracking-wide">ELETRO-STOCK</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Eletromall</p>
          </div>
        </Link>
        {nav}
        <div className="mt-auto rounded-xl border border-border p-3 text-xs">
          <p className="font-medium">{user.name}</p>
          <p className="text-muted">{ROLE_LABELS[user.role]}</p>
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative z-10 flex h-full w-72 flex-col border-r border-border bg-surface p-4">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-semibold">Menu</span>
              <button onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-bg/85 px-4 py-3 backdrop-blur">
          <button className="rounded-lg p-2 hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={18} />
          </button>
          <GlobalSearch />
          <button
            className="ml-auto rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" onClick={logout} aria-label="Sair">
            <LogOut size={18} />
          </button>
        </header>
        <main className="flex-1 p-4 pb-24 sm:p-6 lg:p-8">{children}</main>
        <nav className="no-print fixed bottom-0 left-0 right-0 z-20 grid grid-cols-4 border-t border-border bg-surface/95 p-2 lg:hidden">
          {[
            { href: "/", label: "Home", icon: LayoutDashboard },
            { href: "/estoque", label: "Estoque", icon: Boxes },
            { href: "/entrada", label: "Entrada", icon: ArrowDownToLine },
            { href: "/saida", label: "Saída", icon: ArrowUpFromLine },
          ].map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-1 rounded-xl py-2 text-[11px]", active ? "text-accent" : "text-muted")}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
