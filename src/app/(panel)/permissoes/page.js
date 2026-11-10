"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, PageHeader, Select } from "@/components/ui";
import { ROLES } from "@/lib/constants";

function PermissionChecklist({ groups, permissionLabels, selected, locked, onToggle }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.id}>
          <h3 className="mb-2 text-sm font-semibold">{group.label}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.permissions.map((permission) => (
              <label
                key={permission}
                className={`flex items-start gap-3 rounded-xl border border-border px-3.5 py-3 ${locked ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  checked={selected.includes(permission)}
                  disabled={locked}
                  onChange={() => onToggle(permission)}
                />
                <span>
                  <span className="block text-sm font-medium">{permissionLabels[permission] || permission}</span>
                  <span className="mt-0.5 block text-xs text-muted">{permission}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PermissoesPage() {
  const [catalog, setCatalog] = useState(null);
  const [role, setRole] = useState(ROLES.CASHIER);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentRole = useMemo(
    () => catalog?.roles?.find((item) => item.role === role) || null,
    [catalog, role],
  );

  async function load() {
    setLoading(true);
    try {
      const data = await api("/api/permissions/roles");
      setCatalog(data);
      const nextRole = data.roles?.find((item) => item.role === role) || data.roles?.[0];
      if (nextRole) {
        setRole(nextRole.role);
        setSelected([...(nextRole.permissions || [])]);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeRole(next) {
    setRole(next);
    const found = catalog?.roles?.find((item) => item.role === next);
    setSelected([...(found?.permissions || [])]);
  }

  function toggle(permission) {
    setSelected((current) => (
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    ));
  }

  async function save() {
    setSaving(true);
    try {
      const data = await api("/api/permissions/roles", {
        method: "PUT",
        json: { role, permissions: selected },
      });
      setCatalog(data);
      const found = data.roles?.find((item) => item.role === role);
      setSelected([...(found?.permissions || [])]);
      toast.success("Permissões do perfil atualizadas.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Permissões"
        subtitle="Defina o que cada perfil acessa por padrão. Exceções por colaborador ficam em Usuários."
        actions={
          <Button onClick={save} disabled={saving || loading || currentRole?.locked}>
            {saving ? "Salvando..." : "Salvar perfil"}
          </Button>
        }
      />

      <Card className="mb-4 space-y-3">
        <div className="max-w-sm">
          <label className="mb-1.5 block text-sm font-medium">Perfil</label>
          <Select value={role} onChange={(event) => changeRole(event.target.value)} disabled={loading || !catalog}>
            {(catalog?.roles || []).map((item) => (
              <option key={item.role} value={item.role}>{item.label}</option>
            ))}
          </Select>
        </div>
        {currentRole?.locked ? (
          <p className="text-sm text-muted">O Administrador sempre tem todas as permissões.</p>
        ) : role === ROLES.CASHIER ? (
          <p className="text-sm text-muted">
            O Caixa padrão fica só com visualização de vendas e baixa no caixa. Libere extras por usuário em Usuários → Exceções.
          </p>
        ) : null}
      </Card>

      <Card>
        {loading || !catalog ? (
          <p className="text-sm text-muted">Carregando permissões...</p>
        ) : (
          <PermissionChecklist
            groups={catalog.groups}
            permissionLabels={catalog.permissionLabels}
            selected={selected}
            locked={Boolean(currentRole?.locked)}
            onToggle={toggle}
          />
        )}
      </Card>
    </div>
  );
}
