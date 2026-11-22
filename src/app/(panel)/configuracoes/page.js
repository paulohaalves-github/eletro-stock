"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/format";

const SYNC_INTERVALS = [
  [15, "15 minutos"],
  [30, "30 minutos"],
  [60, "1 hora"],
  [120, "2 horas"],
];

const SECTIONS = [
  { id: "care", label: "Care / OV", group: "Operação" },
  { id: "catalogo", label: "Catálogo", group: "Operação" },
  { id: "icecat", label: "Icecat", group: "Ficha" },
  { id: "ia", label: "Consulta por IA", group: "Ficha" },
  { id: "instagram", label: "Instagram", group: "Canais" },
];

const emptyCare = {
  user: "",
  password: "",
  clienteId: "116",
  clienteConfigId: "249",
  passwordSet: false,
  syncEnabled: false,
  syncIntervalMinutes: 60,
  syncUnitId: "",
  lastRun: null,
};

const emptyCatalog = {
  online: true,
  offlineMessage: "Catálogo temporariamente indisponível.",
  pickupNote: "Todos os produtos adquiridos deverão ser retirados pelo comprador, ou por pessoa por ele autorizada, no prazo máximo de até 5 (cinco) dias úteis contados a partir da data da compra. Embora todos os itens sejam devidamente embalados para transporte, o deslocamento, o manuseio e eventuais danos ocorridos após a retirada são de inteira responsabilidade do cliente.",
  payCash: true,
  payCard: true,
  payPix: true,
};

const emptyIcecat = {
  username: "",
  apiToken: "",
  tokenSet: false,
  configured: false,
};

const emptyOpenAI = {
  model: "",
  apiKey: "",
  tokenSet: false,
  configured: false,
};

const emptyInstagram = {
  appId: "",
  appSecret: "",
  verifyToken: "",
  secretSet: false,
  configured: false,
  webhookUrl: "",
  redirectUrl: "",
};

function statusTone(tone) {
  if (tone === "ok") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (tone === "warn") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-border bg-surface-2 text-muted";
}

function StatusBadge({ tone = "off", children }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusTone(tone))}>
      {children}
    </span>
  );
}

function CheckOption({ checked, disabled, onChange, title, hint }) {
  return (
    <label className={cn("flex items-start gap-3 rounded-xl border border-border px-3 py-2.5", disabled && "opacity-60")}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

function SettingsSection({ id, title, description, badge, dirty, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
              {badge}
              {dirty ? <StatusBadge tone="warn">Alterações não salvas</StatusBadge> : null}
            </div>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
        </div>
        {children}
      </Card>
    </section>
  );
}

function SettingsSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-xl bg-surface-2" />
      ))}
    </div>
  );
}

function CopyField({ label, value, hint, emptyHint }) {
  const canCopy = Boolean(value);

  function copy() {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => toast.success("URL copiada.")).catch(() => toast.error("Não foi possível copiar."));
  }

  return (
    <Field label={label} hint={value ? hint : emptyHint}>
      <div className="flex gap-2">
        <Input value={value || ""} readOnly placeholder="—" />
        <Button type="button" variant="secondary" onClick={copy} disabled={!canCopy} className="shrink-0 px-3" title="Copiar">
          <Copy className="h-4 w-4" />
          <span className="sr-only">Copiar</span>
        </Button>
      </div>
    </Field>
  );
}

function CollapsibleHelp({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left text-sm font-medium"
        onClick={() => setOpen((current) => !current)}
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 text-muted transition", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t border-border px-3.5 py-3 text-xs leading-relaxed text-muted">{children}</div> : null}
    </div>
  );
}

function SectionNav({ activeId, statuses, onSelect }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const section of SECTIONS) {
      if (!map.has(section.group)) map.set(section.group, []);
      map.get(section.group).push(section);
    }
    return [...map.entries()];
  }, []);

  return (
    <>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
        {SECTIONS.map((section) => {
          const status = statuses[section.id];
          const active = activeId === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                active ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-surface-2 text-muted hover:text-text",
              )}
            >
              {section.label}
              {status ? <span className={cn("h-1.5 w-1.5 rounded-full", status.tone === "ok" ? "bg-emerald-500" : status.tone === "warn" ? "bg-amber-500" : "bg-muted")} /> : null}
            </button>
          );
        })}
      </div>

      <nav className="hidden lg:block">
        <Card className="sticky top-20 space-y-3 p-3">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Seções</p>
          {groups.map(([group, items]) => (
            <div key={group} className="space-y-0.5">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wide text-muted/80">{group}</p>
              {items.map((section) => {
                const status = statuses[section.id];
                const active = activeId === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onSelect(section.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                      active ? "bg-accent/10 font-semibold text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    <span>{section.label}</span>
                    {status ? (
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.tone === "ok" ? "bg-emerald-500" : status.tone === "warn" ? "bg-amber-500" : "bg-muted")} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </Card>
      </nav>
    </>
  );
}

function StatusOverview({ statuses, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SECTIONS.map((section) => {
        const status = statuses[section.id];
        if (!status) {
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted"
            >
              {section.label}
              <span className="text-muted/70">…</span>
            </button>
          );
        }
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:brightness-110", statusTone(status.tone))}
          >
            <span>{section.label}</span>
            <span className="opacity-80">{status.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function CareSettings({ onStatus }) {
  const [form, setForm] = useState(emptyCare);
  const [baseline, setBaseline] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const report = useCallback((settings) => {
    if (settings.syncEnabled) {
      onStatus?.({ id: "care", tone: settings.lastRun?.error ? "warn" : "ok", label: settings.lastRun?.error ? "Sync com erro" : "Sync ativo" });
    } else if (settings.user || settings.passwordSet) {
      onStatus?.({ id: "care", tone: "warn", label: "Manual" });
    } else {
      onStatus?.({ id: "care", tone: "off", label: "Não configurado" });
    }
  }, [onStatus]);

  useEffect(() => {
    api("/api/settings/care")
      .then((data) => {
        const next = {
          ...emptyCare,
          ...data.settings,
          password: "",
          syncUnitId: data.settings?.syncUnitId ? String(data.settings.syncUnitId) : "",
        };
        setUnits(data.units || []);
        setForm(next);
        setBaseline({ ...next, password: "" });
        report(next);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [report]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return (
      form.user !== baseline.user
      || Boolean(form.password)
      || form.clienteId !== baseline.clienteId
      || form.clienteConfigId !== baseline.clienteConfigId
      || form.syncEnabled !== baseline.syncEnabled
      || Number(form.syncIntervalMinutes) !== Number(baseline.syncIntervalMinutes)
      || form.syncUnitId !== baseline.syncUnitId
    );
  }, [baseline, form]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/settings/care", {
        method: "PUT",
        json: {
          user: form.user,
          password: form.password,
          clienteId: form.clienteId,
          clienteConfigId: form.clienteConfigId,
          syncEnabled: form.syncEnabled,
          syncIntervalMinutes: Number(form.syncIntervalMinutes),
          syncUnitId: form.syncUnitId ? Number(form.syncUnitId) : null,
        },
      });
      const next = {
        ...emptyCare,
        ...data.settings,
        password: "",
        syncUnitId: data.settings?.syncUnitId ? String(data.settings.syncUnitId) : "",
      };
      setForm(next);
      setBaseline({ ...next, password: "" });
      report(next);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      id="care"
      title="Care / OV"
      description="Acesso interno ao Care, usado para buscar o cliente pela OV. Esses dados não aparecem para o cliente."
      badge={form.syncEnabled ? <StatusBadge tone={form.lastRun?.error ? "warn" : "ok"}>Sync automático</StatusBadge> : <StatusBadge tone="off">Só manual</StatusBadge>}
      dirty={dirty}
    >
      {loading ? <SettingsSkeleton rows={4} /> : (
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Credenciais</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="E-mail do Care" required>
                <Input
                  type="email"
                  value={form.user}
                  autoComplete="off"
                  onChange={(event) => setForm({ ...form, user: event.target.value })}
                />
              </Field>
              <Field
                label="Senha do Care"
                required={!form.passwordSet}
                hint={form.passwordSet ? "Deixe em branco para manter a senha já salva." : "A senha fica só no servidor."}
              >
                <Input
                  type="password"
                  value={form.password}
                  autoComplete="new-password"
                  placeholder={form.passwordSet ? "••••••••" : ""}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </Field>
              <Field label="Cliente ID" required>
                <Input
                  inputMode="numeric"
                  value={form.clienteId}
                  onChange={(event) => setForm({ ...form, clienteId: event.target.value })}
                />
              </Field>
              <Field label="Cliente config ID" required>
                <Input
                  inputMode="numeric"
                  value={form.clienteConfigId}
                  onChange={(event) => setForm({ ...form, clienteConfigId: event.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sincronização</p>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <CheckOption
                checked={form.syncEnabled}
                onChange={(syncEnabled) => setForm({ ...form, syncEnabled })}
                title="Sincronizar automaticamente"
                hint="OVs finalizadas entram na unidade escolhida. O botão em Vendas continua disponível."
              />
              <Field label="Intervalo">
                <Select
                  value={String(form.syncIntervalMinutes)}
                  disabled={!form.syncEnabled}
                  onChange={(event) => setForm({ ...form, syncIntervalMinutes: Number(event.target.value) })}
                >
                  {SYNC_INTERVALS.map(([minutes, label]) => (
                    <option key={minutes} value={minutes}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Unidade da baixa" required={form.syncEnabled}>
                <Select
                  value={form.syncUnitId}
                  disabled={!form.syncEnabled}
                  onChange={(event) => setForm({ ...form, syncUnitId: event.target.value })}
                >
                  <option value="">Selecione a unidade</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}{UNIT_TYPE_LABELS[unit.type] ? ` (${UNIT_TYPE_LABELS[unit.type]})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="text-xs text-muted">
              {form.lastRun?.at
                ? `Última sincronização: ${formatDateTime(form.lastRun.at)}. ${form.lastRun.error || form.lastRun.message || ""}`
                : "Ainda não houve sincronização."}
            </p>
          </div>

          <Button type="submit" disabled={saving || !dirty}>{saving ? "Salvando..." : "Salvar Care / OV"}</Button>
        </form>
      )}
    </SettingsSection>
  );
}

function CatalogSettings({ onStatus }) {
  const [form, setForm] = useState(emptyCatalog);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const report = useCallback((settings) => {
    onStatus?.({
      id: "catalogo",
      tone: settings.online ? "ok" : "warn",
      label: settings.online ? "No ar" : "Fora do ar",
    });
  }, [onStatus]);

  useEffect(() => {
    api("/api/settings/catalog")
      .then((data) => {
        const next = { ...emptyCatalog, ...data.settings };
        setForm(next);
        setBaseline(next);
        report(next);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [report]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [baseline, form]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/settings/catalog", { method: "PUT", json: form });
      const next = { ...emptyCatalog, ...data.settings };
      setForm(next);
      setBaseline(next);
      report(next);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      id="catalogo"
      title="Catálogo"
      description="O que a vitrine pública mostra. Tirar o catálogo do ar não altera o estoque nem o acesso da equipe."
      badge={form.online ? <StatusBadge tone="ok">No ar</StatusBadge> : <StatusBadge tone="warn">Fora do ar</StatusBadge>}
      dirty={dirty}
    >
      {loading ? <SettingsSkeleton rows={3} /> : (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.6fr)_minmax(0,1.6fr)]">
            <CheckOption
              checked={form.online}
              onChange={(online) => setForm({ ...form, online })}
              title="Catálogo no ar"
              hint="Desmarque para tirar a vitrine do ar."
            />
            <Field
              label="Mensagem fora do ar"
              required={!form.online}
              hint="Aparece no lugar dos produtos enquanto o catálogo estiver fora do ar."
            >
              <Textarea
                className="min-h-20"
                rows={3}
                value={form.offlineMessage}
                onChange={(event) => setForm({ ...form, offlineMessage: event.target.value })}
              />
            </Field>
            <Field label="Retirada na loja" hint="Texto geral da empresa. O endereço de cada loja continua no cadastro da unidade.">
              <Textarea
                className="min-h-20"
                rows={3}
                value={form.pickupNote}
                onChange={(event) => setForm({ ...form, pickupNote: event.target.value })}
              />
            </Field>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Formas de pagamento</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <CheckOption checked={form.payCash} onChange={(payCash) => setForm({ ...form, payCash })} title="Dinheiro" />
              <CheckOption checked={form.payCard} onChange={(payCard) => setForm({ ...form, payCard })} title="Cartão de crédito e débito" hint="No catálogo, aparece como cartão em até 10x." />
              <CheckOption checked={form.payPix} onChange={(payPix) => setForm({ ...form, payPix })} title="Pix" hint="No catálogo, aparece com 5% de desconto à vista." />
            </div>
          </div>
          <Button type="submit" disabled={saving || !dirty}>{saving ? "Salvando..." : "Salvar catálogo"}</Button>
        </form>
      )}
    </SettingsSection>
  );
}

function IcecatSettings({ onStatus }) {
  const [form, setForm] = useState(emptyIcecat);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const report = useCallback((settings) => {
    onStatus?.({
      id: "icecat",
      tone: settings.configured ? "ok" : "off",
      label: settings.configured ? "Ativo" : "Desligado",
    });
  }, [onStatus]);

  useEffect(() => {
    api("/api/settings/icecat")
      .then((data) => {
        const next = { ...emptyIcecat, ...data.settings, apiToken: "" };
        setForm(next);
        setBaseline({ ...next, apiToken: "" });
        report(next);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [report]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return form.username !== baseline.username || Boolean(form.apiToken);
  }, [baseline, form]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/settings/icecat", { method: "PUT", json: form });
      const next = { ...emptyIcecat, ...data.settings, apiToken: "" };
      setForm(next);
      setBaseline({ ...next, apiToken: "" });
      report(next);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      id="icecat"
      title="Icecat"
      description="Conta gratuita do Open Icecat. Sem usuário e chave, a ficha e as fotos continuam manuais."
      badge={form.configured ? <StatusBadge tone="ok">Consulta ativa</StatusBadge> : <StatusBadge tone="off">Desligado</StatusBadge>}
      dirty={dirty}
    >
      {loading ? <SettingsSkeleton rows={2} /> : (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Usuário" hint={form.configured ? "A consulta pelo EAN está ativa." : "A consulta fica desligada até a chave ser salva."}>
              <Input
                value={form.username}
                autoComplete="off"
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
            </Field>
            <Field
              label="Chave de acesso"
              required={!form.tokenSet && Boolean(form.username.trim())}
              hint={form.tokenSet ? "Deixe em branco para manter a chave já salva. Ela não volta para a tela." : "A chave fica só no servidor."}
            >
              <Input
                type="password"
                value={form.apiToken}
                autoComplete="new-password"
                placeholder={form.tokenSet ? "••••••••" : ""}
                onChange={(event) => setForm({ ...form, apiToken: event.target.value })}
              />
            </Field>
          </div>
          <Button type="submit" disabled={saving || !dirty}>{saving ? "Salvando..." : "Salvar Icecat"}</Button>
        </form>
      )}
    </SettingsSection>
  );
}

function OpenAISettings({ onStatus }) {
  const [form, setForm] = useState(emptyOpenAI);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const report = useCallback((settings) => {
    onStatus?.({
      id: "ia",
      tone: settings.configured ? "ok" : "off",
      label: settings.configured ? "Ativa" : "Desligada",
    });
  }, [onStatus]);

  useEffect(() => {
    api("/api/settings/openai")
      .then((data) => {
        const next = { ...emptyOpenAI, ...data.settings, apiKey: "" };
        setForm(next);
        setBaseline({ ...next, apiKey: "" });
        report(next);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [report]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return form.model !== baseline.model || Boolean(form.apiKey);
  }, [baseline, form]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/settings/openai", { method: "PUT", json: form });
      const next = { ...emptyOpenAI, ...data.settings, apiKey: "" };
      setForm(next);
      setBaseline({ ...next, apiKey: "" });
      report(next);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      id="ia"
      title="Consulta por IA"
      description="Pesquisa a ficha na web. Sem a chave, essa opção não consulta. O resultado só entra no produto depois que alguém marca o que pode mudar."
      badge={form.configured ? <StatusBadge tone="ok">Ativa</StatusBadge> : <StatusBadge tone="off">Desligada</StatusBadge>}
      dirty={dirty}
    >
      {loading ? <SettingsSkeleton rows={2} /> : (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Chave de acesso"
              hint={form.tokenSet ? "Deixe em branco para manter a chave já salva. Ela não volta para a tela." : "A chave fica só no servidor. Use uma chave da OpenAI com pesquisa na web."}
            >
              <Input
                type="password"
                value={form.apiKey}
                autoComplete="new-password"
                placeholder={form.tokenSet ? "••••••••" : ""}
                onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
              />
            </Field>
            <Field label="Modelo" hint={form.configured ? "A consulta por IA está ativa." : "Em branco, o sistema usa gpt-4.1-mini."}>
              <Input
                value={form.model}
                placeholder="gpt-4.1-mini"
                autoComplete="off"
                onChange={(event) => setForm({ ...form, model: event.target.value })}
              />
            </Field>
          </div>
          <Button type="submit" disabled={saving || !dirty}>{saving ? "Salvando..." : "Salvar consulta por IA"}</Button>
        </form>
      )}
    </SettingsSection>
  );
}

function InstagramSettings({ onStatus }) {
  const [form, setForm] = useState(emptyInstagram);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const report = useCallback((settings) => {
    onStatus?.({
      id: "instagram",
      tone: settings.configured ? "ok" : "off",
      label: settings.configured ? "Pronto" : "Pendente",
    });
  }, [onStatus]);

  useEffect(() => {
    api("/api/settings/instagram")
      .then((data) => {
        const next = { ...emptyInstagram, ...data.settings, appSecret: "" };
        setForm(next);
        setBaseline({ ...next, appSecret: "" });
        report(next);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [report]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return (
      form.appId !== baseline.appId
      || Boolean(form.appSecret)
      || form.verifyToken !== baseline.verifyToken
    );
  }, [baseline, form]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/settings/instagram", { method: "PUT", json: form });
      const next = { ...emptyInstagram, ...data.settings, appSecret: "" };
      setForm(next);
      setBaseline({ ...next, appSecret: "" });
      report(next);
      toast.success(data.message || "Instagram salvo.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      id="instagram"
      title="Instagram"
      description="Aplicativo da Meta usado para receber e responder o Direct no Contact Center."
      badge={form.configured ? <StatusBadge tone="ok">Pronto para conectar</StatusBadge> : <StatusBadge tone="off">Pendente</StatusBadge>}
      dirty={dirty}
    >
      {loading ? <SettingsSkeleton rows={3} /> : (
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Credenciais</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="ID do aplicativo" hint="Número do app em developers.facebook.com.">
                <Input
                  value={form.appId}
                  inputMode="numeric"
                  autoComplete="off"
                  onChange={(event) => setForm({ ...form, appId: event.target.value })}
                />
              </Field>
              <Field
                label="Chave secreta"
                hint={form.secretSet ? "Deixe em branco para manter a chave já salva. Ela não volta para a tela." : "A chave secreta do aplicativo. Não volta para a tela depois de salva."}
              >
                <Input
                  type="password"
                  value={form.appSecret}
                  autoComplete="new-password"
                  placeholder={form.secretSet ? "••••••••" : ""}
                  onChange={(event) => setForm({ ...form, appSecret: event.target.value })}
                />
              </Field>
              <Field label="Token de verificação" hint="O mesmo valor informado no webhook da Meta. Você pode copiar daqui depois de salvar." className="sm:col-span-2 xl:col-span-1">
                <Input
                  value={form.verifyToken}
                  autoComplete="off"
                  onChange={(event) => setForm({ ...form, verifyToken: event.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">URLs da Meta</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyField
                label="URL de redirecionamento"
                value={form.redirectUrl}
                hint="Cadastre esta URL no Facebook Login do aplicativo."
                emptyHint="Defina APP_URL para montar o endereço público."
              />
              <CopyField
                label="URL do webhook"
                value={form.webhookUrl}
                hint="No produto Instagram, assine o campo messages."
                emptyHint="Defina APP_URL para montar o endereço público."
              />
            </div>
          </div>

          <CollapsibleHelp title="Como configurar na Meta">
            <p>
              Permissões do app: pages_show_list, pages_read_engagement, pages_manage_metadata, instagram_basic, instagram_manage_messages e business_management.
              A conta do Instagram precisa ser profissional e estar ligada a uma Página. Depois de conectar o canal, o encaminhamento da conversa no Meta Business Suite deve apontar para este aplicativo.
            </p>
            <p className="mt-2">
              {form.configured ? "O aplicativo está pronto para conectar um canal." : "Sem estes dados, o botão Conectar do canal fica indisponível."}
            </p>
          </CollapsibleHelp>

          <Button type="submit" disabled={saving || !dirty}>{saving ? "Salvando..." : "Salvar Instagram"}</Button>
        </form>
      )}
    </SettingsSection>
  );
}

export default function ConfiguracoesPage() {
  const [statuses, setStatuses] = useState({});
  const [activeId, setActiveId] = useState("care");

  const onStatus = useCallback((status) => {
    setStatuses((current) => ({ ...current, [status.id]: status }));
  }, []);

  function scrollToSection(id) {
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    const nodes = SECTIONS.map((section) => document.getElementById(section.id)).filter(Boolean);
    if (!nodes.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full space-y-4">
      <div className="space-y-3">
        <PageHeader
          title="Configurações"
          subtitle="Operação do Care e do catálogo, fichas de produto e canais do Contact Center."
        />
        <StatusOverview statuses={statuses} onSelect={scrollToSection} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-start xl:grid-cols-[200px_minmax(0,1fr)]">
        <SectionNav activeId={activeId} statuses={statuses} onSelect={scrollToSection} />

        <div className="min-w-0 w-full space-y-5">
          <CareSettings onStatus={onStatus} />
          <CatalogSettings onStatus={onStatus} />
          <IcecatSettings onStatus={onStatus} />
          <OpenAISettings onStatus={onStatus} />
          <InstagramSettings onStatus={onStatus} />
        </div>
      </div>
    </div>
  );
}
