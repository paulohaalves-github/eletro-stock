"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Field, Input } from "@/components/ui";
import { digitsOnly } from "@/lib/phone";

export function CustomerAddressFields({ address, onAddressChange, disabled = false }) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);

  async function searchCep() {
    const digits = digitsOnly(cep);
    if (digits.length !== 8) {
      toast.error("Informe um CEP com 8 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const data = await api(`/api/cep/${digits}`);
      const next = String(data.formatted || "").trim();
      if (!next) {
        toast.error("CEP encontrado, mas sem endereço para preencher.");
        return;
      }
      onAddressChange(next);
      toast.success("Endereço preenchido pelo CEP. Complete o número se precisar.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="CEP" hint="Busca o endereço automaticamente.">
        <div className="flex flex-wrap gap-2">
          <Input
            value={cep}
            disabled={disabled || loading}
            onChange={(e) => setCep(e.target.value)}
            placeholder="00000-000"
            inputMode="numeric"
            className="min-w-[10rem] flex-1"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchCep();
              }
            }}
          />
          <Button type="button" variant="secondary" disabled={disabled || loading} onClick={() => void searchCep()}>
            {loading ? "Buscando..." : "Buscar CEP"}
          </Button>
        </div>
      </Field>
      <Field label="Endereço" hint="Opcional. Use o CEP para preencher e complete com o número.">
        <Input
          value={address}
          disabled={disabled}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Rua, número, bairro, cidade"
        />
      </Field>
    </div>
  );
}
