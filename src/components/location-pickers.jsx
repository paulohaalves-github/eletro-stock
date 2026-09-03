"use client";

import { Field, Select } from "@/components/ui";

export function LocationPickers({
  typeId,
  locationId,
  types = [],
  locations = [],
  onChange,
  required = false,
}) {
  const typeOptions = types.filter((item) => item.active || String(item.id) === String(typeId));
  const locationOptions = locations.filter(
    (item) =>
      String(item.locationTypeId) === String(typeId) &&
      (item.active || String(item.id) === String(locationId)),
  );

  return (
    <>
      <Field label="Tipo de localização" required={required}>
        <Select
          value={typeId || ""}
          onChange={(event) => onChange({ locationTypeId: event.target.value, locationId: "" })}
        >
          <option value="">Selecione</option>
          {typeOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.active ? "" : " (inativo)"}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Localização" required={required}>
        <Select
          value={locationId || ""}
          disabled={!typeId}
          onChange={(event) => onChange({ locationTypeId: typeId, locationId: event.target.value })}
        >
          <option value="">{typeId ? "Selecione" : "Selecione o tipo primeiro"}</option>
          {locationOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.active ? "" : " (inativa)"}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
