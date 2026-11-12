import { digitsOnly } from "@/lib/phone";
import { validationError } from "@/lib/errors";

export function normalizeCep(value) {
  const digits = digitsOnly(value);
  if (!digits) return null;
  if (digits.length !== 8) throw validationError("CEP inválido. Informe 8 dígitos.");
  return digits;
}

export function formatCep(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 8) return String(value || "").trim();
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatAddressFromCep(data) {
  if (!data) return "";
  const street = [data.street, data.complement].filter(Boolean).join(", ");
  const cityLine = [data.neighborhood, data.city && data.state ? `${data.city}/${data.state}` : data.city || data.state]
    .filter(Boolean)
    .join(" · ");
  const zip = data.zipCode ? `CEP ${formatCep(data.zipCode)}` : "";
  return [street, cityLine, zip].filter(Boolean).join(" — ");
}

export async function lookupCep(value) {
  const cep = normalizeCep(value);
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw validationError("Não foi possível consultar o CEP agora.");
  const raw = await response.json();
  if (!raw || raw.erro) throw validationError("CEP não encontrado.");
  return {
    zipCode: formatCep(cep),
    street: String(raw.logradouro || "").trim(),
    complement: String(raw.complemento || "").trim(),
    neighborhood: String(raw.bairro || "").trim(),
    city: String(raw.localidade || "").trim(),
    state: String(raw.uf || "").trim().toUpperCase(),
  };
}
