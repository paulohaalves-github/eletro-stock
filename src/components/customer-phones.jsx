"use client";

import { Button, Field, Input } from "@/components/ui";

export function emptyPhoneRow() {
  return { phone: "", label: "" };
}

export function phonesFromCustomer(customer) {
  if (customer?.phones?.length) {
    return customer.phones.map((item) => ({
      phone: item.phone || "",
      label: item.label || "",
    }));
  }
  if (customer?.phone) return [{ phone: customer.phone, label: "" }];
  return [emptyPhoneRow()];
}

export function CustomerPhonesFields({ value, onChange }) {
  const phones = value?.length ? value : [emptyPhoneRow()];

  function update(index, patch) {
    onChange(phones.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function add() {
    onChange([...phones, emptyPhoneRow()]);
  }

  function remove(index) {
    const next = phones.filter((_, i) => i !== index);
    onChange(next.length ? next : [emptyPhoneRow()]);
  }

  return (
    <div className="space-y-3">
      {phones.map((row, index) => (
        <div key={index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
          <Field label={index === 0 ? "Telefone" : `Telefone ${index + 1}`} required={index === 0}>
            <Input
              value={row.phone}
              onChange={(e) => update(index, { phone: e.target.value })}
              placeholder="(11) 90000-0000"
              inputMode="tel"
            />
          </Field>
          <Field label="Rótulo">
            <Input
              value={row.label}
              onChange={(e) => update(index, { label: e.target.value })}
              placeholder={index === 0 ? "Principal" : "WhatsApp"}
            />
          </Field>
          <div className="flex h-[42px] items-center">
            {phones.length > 1 ? (
              <Button type="button" variant="ghost" className="px-2" onClick={() => remove(index)}>
                Remover
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={add}>
        Adicionar telefone
      </Button>
    </div>
  );
}
