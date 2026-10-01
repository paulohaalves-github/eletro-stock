import { forbidden, validationError } from "../errors";
import { INBOX_PROVIDERS } from "../constants";
import { getAgentTeamIds } from "./inbox-access";
import { getInboxChannelRecord } from "./inbox-channels";
import { listDialog360Templates } from "../whatsapp/dialog360";
import {
  assertTemplateVariables,
  buildTemplateComponents,
  describeTemplate,
  renderTemplatePreview,
  serializeTemplate,
} from "../whatsapp/templates";

export async function listChannelTemplates(channelId, session) {
  const channel = await getInboxChannelRecord(channelId);
  if (channel.provider !== INBOX_PROVIDERS.DIALOG_360) {
    throw validationError("Modelos só estão disponíveis no WhatsApp oficial.");
  }
  const teamIds = await getAgentTeamIds(session);
  if (!teamIds.length) throw forbidden();
  const templates = await listDialog360Templates(channel);
  return templates.map(serializeTemplate);
}

export async function resolveTemplateSend(channel, payload) {
  const name = String(payload.templateName || "").trim();
  const language = String(payload.templateLanguage || "pt_BR").trim();
  if (!name) throw validationError("Selecione um modelo.");
  const templates = await listDialog360Templates(channel);
  const template = templates.find((item) => item.name === name && item.language === language);
  if (!template) throw validationError("Modelo não encontrado ou não aprovado neste canal.");
  const described = describeTemplate(template);
  const missing = assertTemplateVariables(described, payload.templateVariables || {});
  if (missing) throw validationError(missing);
  return {
    name: template.name,
    language: template.language,
    components: buildTemplateComponents(described, payload.templateVariables || {}),
    preview: renderTemplatePreview(described, payload.templateVariables || {}),
  };
}
