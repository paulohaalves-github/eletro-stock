"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, PageHeader } from "@/components/ui";
import { ConfirmDialog } from "@/components/modal";
import { ScanField } from "@/components/scan-field";
import { InventoryScanBadge, InventoryStatusBadge, StatusBadge } from "@/components/badges";
import { INVENTORY_SCAN_KINDS } from "@/lib/constants";
import { cn, formatDateTime, formatProductId } from "@/lib/format";

export default function InventarioDetailPage() {
  const { id } = useParams();
  const [inventory, setInventory] = useState(null);
  const [code, setCode] = useState("");
  const [refocusKey, setRefocusKey] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [acting, setActing] = useState(false);
  const [showMatched, setShowMatched] = useState(false);
  const [filter, setFilter] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [missingRecord, setMissingRecord] = useState(false);

  async function load() {
    const data = await api(`/api/inventories/${id}`);
    setInventory(data.inventory);
  }

  useEffect(() => {
    setMissingRecord(false);
    load().catch((error) => {
      toast.error(error.message);
      setMissingRecord(true);
    });
  }, [id]);

  async function submitScan(parsed) {
    const value = String(parsed?.query || code || "").trim();
    if (!value || scanning) return;
    setScanning(true);
    try {
      const data = await api(`/api/inventories/${id}/scan`, { method: "POST", json: { code: value } });
      if (data.scan.kind === INVENTORY_SCAN_KINDS.MATCHED) toast.success(data.message);
      else toast.warning(data.message);
      setCode("");
      setRefocusKey((current) => current + 1);
      await load();
    } catch (error) {
      toast.error(error.message);
      setRefocusKey((current) => current + 1);
    } finally {
      setScanning(false);
    }
  }

  async function removeScan(scanId) {
    try {
      const data = await api(`/api/inventories/${id}/scans/${scanId}`, { method: "DELETE" });
      toast.success(data.message);
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const blob = await api(`/api/inventories/${id}/export`, { blob: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${inventory?.number || "inventario"}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  }

  function selectFilter(next) {
    setFilter((current) => (current === next ? null : next));
  }

  async function runConfirm() {
    if (!confirm) return;
    setActing(true);
    try {
      const data = await api(`/api/inventories/${id}/${confirm}`, { method: "POST" });
      toast.success(data.message);
      setInventory(data.inventory);
      setConfirm(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActing(false);
    }
  }

  if (missingRecord) {
    return (
      <div>
        <PageHeader title="Inventário" subtitle="Não foi possível abrir este inventário." />
        <Link href="/inventarios"><Button variant="secondary">Voltar</Button></Link>
      </div>
    );
  }

  if (!inventory) return <p className="text-sm text-muted">Carregando inventário...</p>;

  const open = inventory.status === "ABERTO";
  const done = inventory.status === "CONCLUIDO";
  const matchedScans = inventory.matched || inventory.scans.filter((scan) => scan.kind === INVENTORY_SCAN_KINDS.MATCHED);
  const filterMeta = {
    expected: {
      title: "Esperados",
      empty: "Nenhum produto entrou na foto deste inventário.",
      items: inventory.expected || [],
      renderItem: (item) => <ProductRow item={item} />,
    },
    matched: {
      title: "Conferidos",
      empty: "Nenhum produto foi conferido.",
      items: inventory.matched || [],
      renderItem: (item) => (
        <div className="flex items-start justify-between gap-3">
          <ScanRow scan={item} />
          {open && inventory.access?.canScan ? (
            <Button variant="ghost" onClick={() => removeScan(item.id)}>Desfazer</Button>
          ) : null}
        </div>
      ),
    },
    missing: {
      title: "Faltantes",
      empty: "Nenhum produto esperado ficou sem bipagem.",
      items: inventory.missing || [],
      renderItem: (item) => <ProductRow item={item} />,
    },
    surplus: {
      title: "Sobrantes",
      empty: "Nenhum produto bipado ficou fora do estoque esperado.",
      items: inventory.surplus || [],
      renderItem: (item) => (
        <div className="flex items-start justify-between gap-3">
          <ScanRow scan={item} />
          {open && inventory.access?.canScan ? (
            <Button variant="ghost" onClick={() => removeScan(item.id)}>Desfazer</Button>
          ) : null}
        </div>
      ),
    },
  };

  return (
    <div>
      <PageHeader
        kicker={inventory.number}
        title="Inventário de estoque"
        subtitle={`${inventory.unit?.name} · ${inventory.scopeLabel}`}
        actions={
          <>
            <Link href="/inventarios"><Button variant="secondary">Voltar</Button></Link>
            <Button variant="secondary" onClick={() => void exportExcel()} disabled={exporting}>
              {exporting ? "Exportando..." : "Exportar Excel"}
            </Button>
            {inventory.access?.canCancel ? (
              <Button variant="danger" onClick={() => setConfirm("cancel")}>Cancelar</Button>
            ) : null}
          </>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <InventoryStatusBadge status={inventory.status} />
          <p className="text-sm text-muted">
            Aberto em {formatDateTime(inventory.createdAt)} por {inventory.createdBy?.name}
          </p>
        </div>
        <p className="mt-2 text-sm">Designado para {inventory.assignedTo?.name}</p>
        {inventory.completedAt ? (
          <p className="mt-1 text-sm text-muted">
            Concluído em {formatDateTime(inventory.completedAt)} por {inventory.completedBy?.name}
          </p>
        ) : null}
        {inventory.cancelledAt ? (
          <p className="mt-1 text-sm text-muted">
            Cancelado em {formatDateTime(inventory.cancelledAt)} por {inventory.cancelledBy?.name}
          </p>
        ) : null}
        {inventory.notes ? <p className="mt-3 text-sm">{inventory.notes}</p> : null}
        {open ? (
          <p className="mt-3 text-sm text-amber-300">
            Entrada, saída, transferência e reparo desta unidade estão bloqueados até a conclusão. O saldo não muda sozinho.
          </p>
        ) : null}
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Count label="Esperados" value={inventory.counts.expected} active={filter === "expected"} onClick={() => selectFilter("expected")} />
        <Count label="Conferidos" value={inventory.counts.matched} active={filter === "matched"} onClick={() => selectFilter("matched")} />
        <Count label="Faltantes" value={inventory.counts.missing} active={filter === "missing"} onClick={() => selectFilter("missing")} />
        <Count label="Sobrantes" value={inventory.counts.surplus} active={filter === "surplus"} onClick={() => selectFilter("surplus")} />
      </div>
      <p className="mb-4 text-sm text-muted">Clique em um total para filtrar a lista. Clique de novo para ver tudo.</p>

      {open && inventory.access?.canScan ? (
        <Card className="mb-4">
          <p className="mb-3 text-sm font-medium">Bipe cada produto. Use o serial Onyx ou o código da etiqueta da unidade.</p>
          <ScanField
            value={code}
            onChange={setCode}
            onScan={submitScan}
            autoFocus
            refocusKey={refocusKey}
            disabled={scanning}
            placeholder="Serial, código interno ou QR"
          />
          <div className="mt-4">
            <Button onClick={() => setConfirm("conclude")} disabled={scanning}>Concluir inventário</Button>
          </div>
        </Card>
      ) : null}

      {open && !inventory.access?.canScan ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">A bipagem está com {inventory.assignedTo?.name}. Clique em um total para filtrar a lista.</p>
        </Card>
      ) : null}

      {filter ? (
        <FilteredList
          title={filterMeta[filter].title}
          empty={filterMeta[filter].empty}
          items={filterMeta[filter].items}
          renderItem={filterMeta[filter].renderItem}
          onClear={() => setFilter(null)}
        />
      ) : null}

      {!filter && done ? (
        <div className="grid gap-4">
          <Divergence
            title="Faltantes"
            empty="Nenhum produto esperado ficou sem bipagem."
            items={inventory.missing || []}
            renderItem={(item) => <ProductRow item={item} />}
          />
          <Divergence
            title="Sobrantes"
            empty="Nenhum produto bipado ficou fora do estoque esperado."
            items={inventory.surplus || []}
            renderItem={(item) => <ScanRow scan={item} />}
          />
          <Card>
            <button type="button" className="text-sm font-semibold text-accent" onClick={() => setShowMatched((value) => !value)}>
              {showMatched ? "Ocultar conferidos" : `Ver conferidos (${inventory.counts.matched})`}
            </button>
            {showMatched ? (
              <div className="mt-3 grid gap-3">
                {matchedScans.length === 0 ? <p className="text-sm text-muted">Nenhum produto foi conferido.</p> : null}
                {matchedScans.map((scan) => <ScanRow key={scan.id} scan={scan} />)}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {!filter && open ? (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Bipagens</h2>
          {inventory.scans.length === 0 ? <p className="text-sm text-muted">Nenhum produto bipado ainda.</p> : null}
          <div className="grid gap-3">
            {inventory.scans.map((scan) => (
              <div key={scan.id} className="flex items-start justify-between gap-3">
                <ScanRow scan={scan} />
                {inventory.access?.canScan ? (
                  <Button variant="ghost" onClick={() => removeScan(scan.id)}>Desfazer</Button>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirm === "conclude"}
        title="Concluir inventário"
        message="A bipagem será encerrada. O sistema mostra os faltantes e os sobrantes e registra data, hora e usuário. O estoque do sistema não será alterado."
        confirmLabel="Concluir"
        loading={acting}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        title="Cancelar inventário"
        message="A conferência será descartada e a unidade volta a movimentar estoque. As bipagens deixam de valer."
        confirmLabel="Cancelar inventário"
        danger
        loading={acting}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function Count({ label, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("card p-3 text-center transition hover:border-accent/50", active && "border-accent ring-1 ring-accent")}
    >
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </button>
  );
}

function FilteredList({ title, empty, items, renderItem, onClear }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title} ({items.length})</h2>
        <button type="button" className="text-sm font-semibold text-accent" onClick={onClear}>Ver tudo</button>
      </div>
      {items.length === 0 ? <p className="text-sm text-muted">{empty}</p> : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.id || item.productId}>{renderItem(item)}</div>
        ))}
      </div>
    </Card>
  );
}

function ProductRow({ item }) {
  return (
    <div>
      <Link href={`/estoque/${item.productId}`} className="font-medium text-accent">{item.serialOnyx}</Link>
      <p className="text-sm text-muted">
        {formatProductId(item.productId)} · {item.commercialName || "Sem nome comercial"}
        {item.locationLabel ? ` · ${item.locationLabel}` : ""}
      </p>
      <div className="mt-1"><StatusBadge status={item.status} /></div>
    </div>
  );
}

function Divergence({ title, empty, items, renderItem }) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">{title} ({items.length})</h2>
      {items.length === 0 ? <p className="text-sm text-muted">{empty}</p> : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.id || item.productId}>{renderItem(item)}</div>
        ))}
      </div>
    </Card>
  );
}

function ScanRow({ scan }) {
  const title = scan.serialOnyx || scan.rawCode;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {scan.productId ? (
          <Link href={`/estoque/${scan.productId}`} className="font-medium text-accent">{title}</Link>
        ) : (
          <p className="font-medium">{title}</p>
        )}
        <InventoryScanBadge kind={scan.kind} />
      </div>
      <p className="text-sm text-muted">
        {scan.commercialName || "Sem nome comercial"}
        {scan.productId ? ` · ${formatProductId(scan.productId)}` : ""}
        {" · "}
        {formatDateTime(scan.scannedAt)}
        {scan.scannedBy?.name ? ` · ${scan.scannedBy.name}` : ""}
      </p>
      {scan.note ? <p className="text-sm">{scan.note}</p> : null}
    </div>
  );
}
