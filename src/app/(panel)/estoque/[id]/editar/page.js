"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { CONDITIONS, CONDITION_LABELS } from "@/lib/constants";
import { can, PERMISSIONS } from "@/lib/permissions";
import { LocationPickers } from "@/components/location-pickers";

export default function EditarProdutoPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [lines, setLines] = useState([]);
  const [locationTypes, setLocationTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [me, setMe] = useState(null);

  useEffect(() => {
    Promise.all([
      api(`/api/products/${id}`),
      api("/api/categories"),
      api("/api/lines"),
      api("/api/location-types"),
      api("/api/locations"),
      api("/api/auth/me"),
    ]).then(([p, c, l, types, locs, auth]) => {
        const product = p.product;
        setMe(auth.user);
        setCategories(c.items || []);
        setLines(l.items || []);
        setLocationTypes(types.items || []);
        setLocations(locs.items || []);
        setForm({
          serialOnyx: product.serialOnyx || "",
          supplierModelCode: product.supplierModelCode || "",
          commercialName: product.commercialName || "",
          ean: product.ean || "",
          categoryId: product.categoryId,
          lineId: product.lineId || "",
          capacitySizeType: product.capacitySizeType || "",
          condition: product.condition,
          damageDescription: product.damageDescription || "",
          description: product.description || "",
          installmentPrice: product.installmentPrice,
          cashPrice: product.cashPrice,
          marketPrice: product.marketPrice,
          locationTypeId: product.location?.locationTypeId || "",
          locationId: product.locationId || "",
        });
      },
    );
  }, [id]);

  useEffect(() => {
    if (!form?.supplierModelCode?.trim()) return undefined;
    const code = form.supplierModelCode.trim();
    const timeout = setTimeout(async () => {
      try {
        const data = await api(`/api/catalog-models?code=${encodeURIComponent(code)}`);
        if (data.item?.commercialName) {
          setForm((current) =>
            current && current.supplierModelCode.trim() === code
              ? { ...current, commercialName: data.item.commercialName }
              : current,
          );
        }
      } catch {
        // busca opcional
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [form?.supplierModelCode]);

  if (!form || !me) return <p className="text-muted">Carregando...</p>;
  if (!can(me.role, PERMISSIONS.PRODUCT_EDIT)) {
    return <p className="text-danger">Você não tem permissão para editar produtos.</p>;
  }

  const canCondition = can(me.role, PERMISSIONS.CONDITION_CHANGE);

  async function save(event) {
    event.preventDefault();
    try {
      const data = await api(`/api/products/${id}`, { method: "PATCH", json: form });
      toast.success(data.message);
      router.push(`/estoque/${id}`);
    } catch (error) {
      toast.error(error.message);
    }
  }

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div>
      <PageHeader title="Editar produto" subtitle={`Unidade #${id}`} />
      <Card>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Serial Onyx" required><Input value={form.serialOnyx} onChange={(e) => set("serialOnyx", e.target.value)} /></Field>
          <Field label="Model Code"><Input value={form.supplierModelCode} onChange={(e) => set("supplierModelCode", e.target.value)} /></Field>
          <Field label="Nome comercial" hint="Alterar este nome atualiza todas as unidades com o mesmo Model Code.">
            <Input value={form.commercialName} onChange={(e) => set("commercialName", e.target.value)} />
          </Field>
          <Field label="EAN"><Input value={form.ean} onChange={(e) => set("ean", e.target.value)} /></Field>
          <Field label="Categoria">
            <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Linha">
            <Select value={form.lineId} onChange={(e) => set("lineId", e.target.value)}>
              <option value="">—</option>
              {lines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <LocationPickers
            typeId={form.locationTypeId}
            locationId={form.locationId}
            types={locationTypes}
            locations={locations}
            onChange={({ locationTypeId, locationId }) => setForm((current) => ({ ...current, locationTypeId, locationId }))}
          />
          <Field label="Capacidade / Tamanho / Tipo"><Input value={form.capacitySizeType} onChange={(e) => set("capacitySizeType", e.target.value)} /></Field>
          <Field label="Condição">
            <Select value={form.condition} disabled={!canCondition} onChange={(e) => set("condition", e.target.value)}>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="À vista"><Input type="number" step="0.01" value={form.cashPrice} onChange={(e) => set("cashPrice", e.target.value)} /></Field>
          <Field label="Parcelado"><Input type="number" step="0.01" value={form.installmentPrice} onChange={(e) => set("installmentPrice", e.target.value)} /></Field>
          <Field label="Mercado"><Input type="number" step="0.01" value={form.marketPrice} onChange={(e) => set("marketPrice", e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Descrição"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Avarias" required={form.condition === CONDITIONS.NEW_DAMAGE}>
              <Textarea value={form.damageDescription} onChange={(e) => set("damageDescription", e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button>Salvar alterações</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
