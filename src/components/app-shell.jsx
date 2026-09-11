"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  History,
  BarChart3,
  Tags,
  Layers3,
  MapPin,
  Store,
  Users,
  ScrollText,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
  ChevronDown,
  Shield,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { can, PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/format";
import { GlobalSearch } from "./global-search";
import { ROLE_LABELS, UNIT_TYPE_LABELS } from "@/lib/constants";

const NAV_GROUPS = [
  {
    id: "estoque",
    label: "Estoque",
    icon: Boxes,
    items: [
      { href: "/estoque", label: "Produtos", icon: Boxes, permission: PERMISSIONS.PRODUCT_VIEW },
      { href: "/entrada", label: "Entrada", icon: ArrowDownToLine, permission: PERMISSIONS.STOCK_ENTRY },
      { href: "/saida", label: "Saída", icon: ArrowUpFromLine, permission: PERMISSIONS.STOCK_EXIT },
      { href: "/transferencias", label: "Transferências", icon: ArrowRightLeft, permission: PERMISSIONS.STOCK_TRANSFER },
      { href: "/movimentacoes", label: "Movimentações", icon: History, permission: PERMISSIONS.HISTORY_VIEW },
      { href: "/categorias", label: "Categorias", icon: Tags, permission: PERMISSIONS.CATEGORY_MANAGE },
      { href: "/linhas", label: "Linhas", icon: Layers3, permission: PERMISSIONS.LINE_MANAGE },
      { href: "/localizacoes", label: "Localizações", icon: MapPin, permission: PERMISSIONS.LOCATION_MANAGE },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: LayoutDashboard,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3, permission: PERMISSIONS.REPORT_VIEW },
    ],
  },
  {
    id: "administrador",
    label: "Administrador",
    icon: Shield,
    items: [
      { href: "/unidades", label: "Unidades", icon: Store, permission: PERMISSIONS.UNIT_MANAGE },
      { href: "/usuarios", label: "Usuários", icon: Users, permission: PERMISSIONS.USER_MANAGE },
      { href: "/auditoria", label: "Auditoria", icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
    ],
  },
  {
    id: "reparo",
    label: "Reparo Técnico",
    icon: Wrench,
    items: [],
  },
];

const MOBILE_SHORTCUTS = [
  { href: "/", label: "Home", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  { href: "/estoque", label: "Produtos", icon: Boxes, permission: PERMISSIONS.PRODUCT_VIEW },
  { href: "/entrada", label: "Entrada", icon: ArrowDownToLine, permission: PERMISSIONS.STOCK_ENTRY },
  { href: "/saida", label: "Saída", icon: ArrowUpFromLine, permission: PERMISSIONS.STOCK_EXIT },
  { href: "/transferencias", label: "Troca", icon: ArrowRightLeft, permission: PERMISSIONS.STOCK_TRANSFER },
];

function isItemActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function visibleGroups(role) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(role, item.permission)),
  })).filter((group) => group.items.length > 0);
}

function SideNav({ groups, expanded, activeGroupId, pathname, onToggle, onNavigate }) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {groups.map((group) => {
        const GroupIcon = group.icon;
        const isOpen = expanded.has(group.id);
        const groupActive = group.id === activeGroupId;
        return (
          <div key={group.id} className="mb-1">
            <button
              type="button"
              onClick={() => onToggle(group.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                groupActive ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
              aria-expanded={isOpen}
            >
              <GroupIcon size={18} />
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDown size={16} className={cn("shrink-0 transition", isOpen ? "rotate-0" : "-rotate-90")} />
            </button>
            {isOpen ? (
              <div className="mt-1 ml-3 space-y-0.5 border-l border-border pl-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                        active ? "bg-accent/15 text-accent glow-border" : "text-muted hover:bg-surface-2 hover:text-text",
                      )}
                    >
                      <Icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({ user, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const groups = useMemo(() => visibleGroups(user.role), [user.role]);
  const activeGroupId = groups.find((group) => group.items.some((item) => isItemActive(pathname, item.href)))?.id ?? null;
  const [expanded, setExpanded] = useState(() => new Set(activeGroupId ? [activeGroupId] : []));
  const units = user.units || [];
  const activeUnit = user.activeUnit;

  useEffect(() => {
    if (!activeGroupId) return;
    setExpanded((current) => {
      if (current.has(activeGroupId)) return current;
      const next = new Set(current);
      next.add(activeGroupId);
      return next;
    });
  }, [activeGroupId]);

  function toggleGroup(id) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function switchUnit(unitId) {
    if (Number(unitId) === Number(user.activeUnitId) || switching) return;
    setSwitching(true);
    try {
      const data = await api("/api/auth/unit", { method: "POST", json: { unitId: Number(unitId) } });
      toast.success(data.message);
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSwitching(false);
    }
  }

  const unitPicker = units.length ? (
    <select
      value={activeUnit?.id || ""}
      disabled={switching || units.length === 1}
      onChange={(event) => switchUnit(event.target.value)}
      className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
      aria-label="Unidade ativa"
    >
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.name} ({UNIT_TYPE_LABELS[unit.type] || unit.type})
        </option>
      ))}
    </select>
  ) : (
    <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
      Nenhuma unidade vinculada
    </p>
  );

  return (
    <div className="relative z-10 min-h-screen">
      {open ? (
        <div className="fixed inset-0 z-40">
          <button className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <aside className="relative z-10 flex h-full w-72 flex-col overflow-y-auto border-r border-border bg-surface p-4 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
                <img src="/logo.svg" alt="Eletro-Stock" className="h-10 w-10" />
                <div>
                  <p className="text-sm font-semibold tracking-wide">ELETRO-STOCK</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{activeUnit?.name || "Selecione a unidade"}</p>
                </div>
              </Link>
              <button className="rounded-lg p-2 hover:bg-surface-2" onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X size={18} />
              </button>
            </div>
            <div className="mb-4">{unitPicker}</div>
            <SideNav
              groups={groups}
              expanded={expanded}
              activeGroupId={activeGroupId}
              pathname={pathname}
              onToggle={toggleGroup}
              onNavigate={() => setOpen(false)}
            />
            <div className="mt-auto rounded-xl border border-border p-3 text-xs">
              <p className="font-medium">{user.name}</p>
              <p className="text-muted">{ROLE_LABELS[user.role]}</p>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-bg/85 px-4 py-3 backdrop-blur">
          <button className="rounded-lg p-2 hover:bg-surface-2" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu size={18} />
          </button>
          <Link href="/" className="hidden min-w-0 items-center gap-2 sm:flex">
            <img src="/logo.svg" alt="" className="h-8 w-8 shrink-0" />
            <span className="truncate text-sm font-semibold">{activeUnit?.name || "Eletro-Stock"}</span>
          </Link>
          <GlobalSearch />
          <div className="hidden min-w-48 sm:block">{unitPicker}</div>
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
        <main key={user.activeUnitId || "none"} className="flex-1 p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
          {children}
        </main>
        <nav className="no-print fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t border-border bg-surface/95 p-2 lg:hidden">
          {MOBILE_SHORTCUTS.filter((item) => can(user.role, item.permission)).map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item.href);
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
