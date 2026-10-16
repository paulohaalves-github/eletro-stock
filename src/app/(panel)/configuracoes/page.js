"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

const SYNC_INTERVALS = [
  [15, "15 minutos"],
  [30, "30 minutos"],
  [60, "1 hora"],
  [120, "2 horas"],
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

function SectionHeading({ title, description }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

function CheckOption({ checked, disabled, onChange, title, hint }) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border border-border px-3.5 py-3 ${disabled ? "opacity-60" : ""}`}>
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

function SystemSettings() {
  const [form, setForm] = useState(emptyCare);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/api/settings/care")
      .then((data) => {
        setUnits(data.units || []);
        setForm({
          ...emptyCare,
          ...data.settings,
          password: "",
          syncUnitId: data.settings?.syncUnitId ? String(data.settings.syncUnitId) : "",
        });
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

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
      setForm({
        ...emptyCare,
        ...data.settings,
        password: "",
        syncUnitId: data.settings?.syncUnitId ? String(data.settings.syncUnitId) : "",
      });
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Sistema"
        description="Acesso interno ao Care, usado para buscar o cliente pela OV. Esses dados não aparecem para o cliente."
      />
      <Card>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="E-mail do Care" required>
              <Input
                type="email"
                value={form.user}
                disabled={loading}
                autoComplete="off"
                onChange={(event) => setForm({ ...form, user: event.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Senha do Care"
              required={!form.passwordSet}
              hint={form.passwordSet ? "Deixe em branco para manter a senha já salva." : "A senha fica só no servidor."}
            >
              <Input
                type="password"
                value={form.password}
                disabled={loading}
                autoComplete="new-password"
                placeholder={form.passwordSet ? "••••••••" : ""}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Cliente ID" required>
            <Input
              inputMode="numeric"
              value={form.clienteId}
              disabled={loading}
              onChange={(event) => setForm({ ...form, clienteId: event.target.value })}
            />
          </Field>
          <Field label="Cliente config ID" required>
            <Input
              inputMode="numeric"
              value={form.clienteConfigId}
              disabled={loading}
              onChange={(event) => setForm({ ...form, clienteConfigId: event.target.value })}
            />
          </Field>
          <div className="sm:col-span-2 space-y-4 border-t border-border pt-4">
            <CheckOption
              checked={form.syncEnabled}
              disabled={loading}
              onChange={(syncEnabled) => setForm({ ...form, syncEnabled })}
              title="Sincronizar automaticamente"
              hint="No intervalo escolhido, as OVs finalizadas do Care entram na unidade selecionada. O botão em Vendas continua disponível."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Intervalo">
                <Select
                  value={String(form.syncIntervalMinutes)}
                  disabled={loading || !form.syncEnabled}
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
                  disabled={loading || !form.syncEnabled}
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
            <p className="text-sm text-muted">
              {form.lastRun?.at
                ? `Última sincronização: ${formatDateTime(form.lastRun.at)}. ${form.lastRun.error || form.lastRun.message || ""}`
                : "Ainda não houve sincronização."}
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading || saving}>{saving ? "Salvando..." : "Salvar sistema"}</Button>
          </div>
        </form>
      </Card>
    </section>
  );
}

const emptyIcecat = {
  username: "",
  apiToken: "",
  tokenSet: false,
  configured: false,
};

function IcecatSettings() {
  const [form, setForm] = useState(emptyIcecat);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/api/settings/icecat")
      .then((data) => setForm({ ...emptyIcecat, ...data.settings, apiToken: "" }))
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/settings/icecat", { method: "PUT", json: form });
      setForm({ ...emptyIcecat, ...data.settings, apiToken: "" });
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Icecat"
        description="Conta gratuita do Open Icecat. Sem usuário e chave, a ficha e as fotos continuam manuais. A consulta pelo EAN só começa depois que estes dados forem salvos."
      />
      <Card>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Usuário" hint={form.configured ? "A consulta pelo EAN está ativa." : "A consulta fica desligada até a chave ser salva."}>
              <Input
                value={form.username}
                disabled={loading}
                autoComplete="off"
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Chave de acesso"
              required={!form.tokenSet && Boolean(form.username.trim())}
              hint={form.tokenSet ? "Deixe em branco para manter a chave já salva. Ela não volta para a tela." : "A chave fica só no servidor."}
            >
              <Input
                type="password"
                value={form.apiToken}
                disabled={loading}
                autoComplete="new-password"
                placeholder={form.tokenSet ? "••••••••" : ""}
                onChange={(event) => setForm({ ...form, apiToken: event.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading || saving}>{saving ? "Salvando..." : "Salvar Icecat"}</Button>
          </div>
        </form>
      </Card>
    </section>
  );
}

const emptyOpenAI = {
  model: "",
  apiKey: "",
  tokenSet: false,
  configured: false,
};

function OpenAISettings() {
  const [form, setForm] = useState(emptyOpenAI);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/api/settings/openai")
      .then((data) => setForm({ ...emptyOpenAI, ...data.settings, apiKey: "" }))
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/settings/openai", { method: "PUT", json: form });
      setForm({ ...emptyOpenAI, ...data.settings, apiKey: "" });
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Consulta por IA"
        description="Pesquisa a ficha na web. Sem a chave, essa opção não consulta. O resultado só entra no produto depois que alguém marca o que pode mudar."
      />
      <Card>
        <form onSubmit={save} className="grid gap-4">
          <Field
            label="Chave de acesso"
            hint={form.tokenSet ? "Deixe em branco para manter a chave já salva. Ela não volta para a tela." : "A chave fica só no servidor. Use uma chave da OpenAI com pesquisa na web."}
          >
            <Input
              type="password"
              value={form.apiKey}
              disabled={loading}
              autoComplete="new-password"
              placeholder={form.tokenSet ? "••••••••" : ""}
              onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
            />
          </Field>
          <Field label="Modelo" hint={form.configured ? "A consulta por IA está ativa." : "Em branco, o sistema usa gpt-4.1-mini."}>
            <Input
              value={form.model}
              disabled={loading}
              placeholder="gpt-4.1-mini"
              autoComplete="off"
              onChange={(event) => setForm({ ...form, model: event.target.value })}
            />
          </Field>
          <Button type="submit" disabled={loading || saving}>{saving ? "Salvando..." : "Salvar consulta por IA"}</Button>
        </form>
      </Card>
    </section>
  );
}

function CatalogSettings() {
  const [form, setForm] = useState(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/api/settings/catalog")
      .then((data) => setForm({ ...emptyCatalog, ...data.settings }))
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/settings/catalog", { method: "PUT", json: form });
      setForm({ ...emptyCatalog, ...data.settings });
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Catálogo"
        description="O que a vitrine pública mostra. Tirar o catálogo do ar não altera o estoque nem o acesso da equipe."
      />
      <Card>
        <form onSubmit={save} className="space-y-4">
          <CheckOption
            checked={form.online}
            disabled={loading}
            onChange={(online) => setForm({ ...form, online })}
            title="Catálogo no ar"
            hint="Desmarque para tirar a vitrine do ar. O cliente vê só a mensagem abaixo."
          />
          <Field
            label="Mensagem fora do ar"
            required={!form.online}
            hint="Aparece no lugar dos produtos enquanto o catálogo estiver fora do ar."
          >
            <Textarea
              value={form.offlineMessage}
              disabled={loading}
              onChange={(event) => setForm({ ...form, offlineMessage: event.target.value })}
            />
          </Field>
          <Field label="Retirada na loja" hint="Texto geral da empresa. O endereço de cada loja continua no cadastro da unidade.">
            <Textarea
              value={form.pickupNote}
              disabled={loading}
              onChange={(event) => setForm({ ...form, pickupNote: event.target.value })}
            />
          </Field>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Formas de pagamento</p>
            <div className="grid gap-2">
              <CheckOption checked={form.payCash} disabled={loading} onChange={(payCash) => setForm({ ...form, payCash })} title="Dinheiro" />
              <CheckOption checked={form.payCard} disabled={loading} onChange={(payCard) => setForm({ ...form, payCard })} title="Cartão de crédito e débito" hint="No catálogo, aparece como cartão em até 10x." />
              <CheckOption checked={form.payPix} disabled={loading} onChange={(payPix) => setForm({ ...form, payPix })} title="Pix" hint="No catálogo, aparece com 5% de desconto à vista." />
            </div>
          </div>
          <Button type="submit" disabled={loading || saving}>{saving ? "Salvando..." : "Salvar catálogo"}</Button>
        </form>
      </Card>
    </section>
  );
}

export default function ConfiguracoesPage() {
  return (
    <div className="w-full max-w-3xl space-y-10">
      <PageHeader
        title="Configurações"
        subtitle="Sistema é o acesso interno. Catálogo é a vitrine que o cliente vê. Icecat e a consulta por IA completam a ficha."
      />
      <SystemSettings />
      <CatalogSettings />
      <IcecatSettings />
      <OpenAISettings />
    </div>
  );
}
