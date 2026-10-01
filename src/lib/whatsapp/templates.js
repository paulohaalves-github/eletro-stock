import { INBOX_PROVIDERS } from "../constants";

export const WHATSAPP_CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isOfficialWhatsApp(channel) {
  return channel?.provider === INBOX_PROVIDERS.DIALOG_360;
}

export function getCustomerServiceWindow(conversation, at = new Date()) {
  const applies = isOfficialWhatsApp(conversation?.channel);
  if (!applies) {
    return { applies: false, open: true, expiresAt: null, requiresTemplate: false };
  }
  const last = conversation?.lastCustomerMessageAt ? new Date(conversation.lastCustomerMessageAt) : null;
  if (!last || Number.isNaN(last.getTime())) {
    return { applies: true, open: false, expiresAt: null, requiresTemplate: true };
  }
  const expiresAt = new Date(last.getTime() + WHATSAPP_CUSTOMER_WINDOW_MS);
  const open = expiresAt.getTime() > at.getTime();
  return { applies: true, open, expiresAt, requiresTemplate: !open };
}

export function templateKey(template) {
  return `${template.name}::${template.language}`;
}

function extractPlaceholders(text) {
  const source = String(text || "");
  const named = [...source.matchAll(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g)].map((match) => match[1]);
  const positional = [...source.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((match) => Number(match[1]));
  return {
    named: [...new Set(named)],
    positional: [...new Set(positional)].sort((a, b) => a - b),
  };
}

function exampleValues(example, component) {
  if (!example || typeof example !== "object") return [];
  if (component === "BODY") {
    if (Array.isArray(example.body_text?.[0])) return example.body_text[0].map(String);
    if (Array.isArray(example.body_text)) return example.body_text.map(String);
    if (Array.isArray(example.body_text_named_params)) {
      return example.body_text_named_params.map((item) => String(item.example || item.example_text || ""));
    }
  }
  if (component === "HEADER") {
    if (Array.isArray(example.header_text)) return example.header_text.map(String);
    if (Array.isArray(example.header_text_named_params)) {
      return example.header_text_named_params.map((item) => String(item.example || item.example_text || ""));
    }
  }
  return [];
}

function pushTextFields(fields, component, text, example) {
  const { named, positional } = extractPlaceholders(text);
  const samples = exampleValues(example, component);
  if (named.length) {
    named.forEach((name, index) => {
      fields.push({
        key: `${component}:${name}`,
        component,
        kind: "named",
        name,
        label: component === "HEADER" ? `Cabeçalho (${name})` : `Variável ${name}`,
        example: samples[index] || "",
      });
    });
    return;
  }
  positional.forEach((slot, index) => {
    fields.push({
      key: `${component}:${slot}`,
      component,
      kind: "positional",
      index: slot,
      label: component === "HEADER" ? `Cabeçalho {{${slot}}}` : `Variável {{${slot}}}`,
      example: samples[index] || samples[slot - 1] || "",
    });
  });
}

export function describeTemplate(template) {
  const components = Array.isArray(template?.components) ? template.components : [];
  const fields = [];
  let unsupported = null;
  const header = components.find((item) => String(item.type || "").toUpperCase() === "HEADER") || null;
  const body = components.find((item) => String(item.type || "").toUpperCase() === "BODY") || null;
  const footer = components.find((item) => String(item.type || "").toUpperCase() === "FOOTER") || null;
  const buttonsBlock = components.find((item) => String(item.type || "").toUpperCase() === "BUTTONS") || null;
  const buttons = Array.isArray(buttonsBlock?.buttons) ? buttonsBlock.buttons : [];

  if (header) {
    const format = String(header.format || "TEXT").toUpperCase();
    if (format !== "TEXT") {
      unsupported = "Este modelo usa mídia ou localização no cabeçalho e ainda não é suportado.";
    } else {
      pushTextFields(fields, "HEADER", header.text, header.example);
    }
  }
  if (body) pushTextFields(fields, "BODY", body.text, body.example);

  buttons.forEach((button, buttonIndex) => {
    const type = String(button.type || "").toUpperCase();
    if (type === "URL" && extractPlaceholders(button.url || "").positional.length) {
      fields.push({
        key: `BUTTON:${buttonIndex}`,
        component: "BUTTON",
        kind: "url",
        buttonIndex,
        subType: "url",
        label: `Variável do botão "${button.text || "Link"}"`,
        example: Array.isArray(button.example) ? String(button.example[0] || "") : "",
      });
    }
    if (type === "COPY_CODE" || type === "OTP") {
      fields.push({
        key: `BUTTON:${buttonIndex}`,
        component: "BUTTON",
        kind: "copy_code",
        buttonIndex,
        subType: "copy_code",
        label: `Código do botão "${button.text || "Copiar"}"`,
        example: "",
      });
    }
  });

  return {
    id: templateKey(template),
    name: template.name,
    language: template.language,
    status: template.status,
    category: template.category || null,
    headerText: header?.text || "",
    bodyText: body?.text || "",
    footerText: footer?.text || "",
    buttons: buttons.map((button) => ({
      type: button.type,
      text: button.text || "",
      url: button.url || "",
    })),
    fields,
    unsupported,
  };
}

function replacePlaceholder(text, field, value) {
  const fallback = field.kind === "named" ? field.name : field.index;
  const filled = String(value || "").trim() || `{{${fallback}}}`;
  if (field.kind === "named") {
    return String(text || "").replace(new RegExp(`\\{\\{\\s*${field.name}\\s*\\}\\}`, "g"), filled);
  }
  if (field.kind === "positional") {
    return String(text || "").replace(new RegExp(`\\{\\{\\s*${field.index}\\s*\\}\\}`, "g"), filled);
  }
  return String(text || "");
}

export function renderTemplatePreview(described, values = {}) {
  let header = described.headerText || "";
  let body = described.bodyText || "";
  for (const field of described.fields || []) {
    const value = values[field.key];
    if (field.component === "HEADER") header = replacePlaceholder(header, field, value);
    if (field.component === "BODY") body = replacePlaceholder(body, field, value);
  }
  const parts = [header, body, described.footerText].map((item) => String(item || "").trim()).filter(Boolean);
  const buttonLabels = (described.buttons || []).map((button) => button.text).filter(Boolean);
  if (buttonLabels.length) parts.push(buttonLabels.map((label) => `[${label}]`).join(" · "));
  return parts.join("\n\n") || described.name;
}

function textParameter(field, values) {
  const text = String(values[field.key] || "").trim();
  if (field.kind === "named") {
    return { type: "text", parameter_name: field.name, text };
  }
  return { type: "text", text };
}

export function buildTemplateComponents(described, values = {}) {
  const components = [];
  const headerFields = (described.fields || []).filter((field) => field.component === "HEADER");
  const bodyFields = (described.fields || []).filter((field) => field.component === "BODY");
  const buttonFields = (described.fields || []).filter((field) => field.component === "BUTTON");

  if (headerFields.length) {
    components.push({ type: "header", parameters: headerFields.map((field) => textParameter(field, values)) });
  }
  if (bodyFields.length) {
    components.push({ type: "body", parameters: bodyFields.map((field) => textParameter(field, values)) });
  }
  for (const field of buttonFields) {
    const value = String(values[field.key] || "").trim();
    if (field.kind === "copy_code") {
      components.push({
        type: "button",
        sub_type: "copy_code",
        index: String(field.buttonIndex),
        parameters: [{ type: "coupon_code", coupon_code: value }],
      });
    } else {
      components.push({
        type: "button",
        sub_type: "url",
        index: String(field.buttonIndex),
        parameters: [{ type: "text", text: value }],
      });
    }
  }
  return components;
}

export function assertTemplateVariables(described, values = {}) {
  if (described.unsupported) return described.unsupported;
  for (const field of described.fields || []) {
    if (!String(values[field.key] || "").trim()) return `Preencha ${field.label}.`;
  }
  return null;
}

export function serializeTemplate(template) {
  const described = describeTemplate(template);
  return {
    ...described,
    rawComponents: template.components || [],
  };
}
