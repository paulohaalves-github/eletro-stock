import { validationError } from "../errors";
import { getCareSettings } from "./settings";

const CARE_ORIGIN = "https://websolution.care-br.com";

async function careConfig() {
  const settings = await getCareSettings();
  if (!settings.user || !settings.password) {
    throw validationError("A integração com o Care não está configurada.");
  }
  return settings;
}

function joinParts(parts) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(", ");
}

function mapCareCustomer(raw) {
  const city = joinParts([raw.city, raw.state]).replace(", ", " - ");
  const address = joinParts([
    joinParts([raw.street, raw.number]),
    raw.complement,
    raw.district,
    city,
    raw.zip ? `CEP ${raw.zip}` : "",
  ]);
  const notes = [
    raw.coverage && `Cobertura Eletromall: ${raw.coverage}`,
    raw.stateRegistration && `Inscrição estadual: ${raw.stateRegistration}`,
    raw.deliveryForecast && `Data previsão entrega: ${raw.deliveryForecast}`,
    raw.approvalUser && `Usuário aprovação venda: ${raw.approvalUser}`,
    raw.howFound && `Como conheceu a loja: ${raw.howFound}`,
    raw.customerOrder && `Pedido cliente: ${raw.customerOrder}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    name: raw.name,
    document: raw.document,
    email: raw.email,
    address,
    notes,
    phones: raw.phone ? [{ phone: raw.phone, label: "" }] : [],
  };
}

export async function fetchCareCustomer(ov, onStep = () => {}) {
  const code = String(ov || "").trim();
  if (!/^\d+$/.test(code)) throw validationError("Informe a OV do Care, somente números.");

  const config = await careConfig();
  const puppeteer = (await import("puppeteer")).default;
  const loginUrl = `${CARE_ORIGIN}/login.php`;
  onStep(`Acessando endereço: ${loginUrl}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    page.on("dialog", (dialog) => {
      void dialog.dismiss();
    });

    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email");
    onStep("Efetuando login.");
    await page.type("#email", config.user);
    await page.type("#senha", config.password);
    await page.click("#btn-login");
    try {
      await page.waitForFunction(() => !window.location.href.includes("login.php"), { timeout: 20000 });
    } catch {
      throw validationError("Não foi possível entrar no Care. Confira as credenciais.");
    }
    onStep("Login efetuado com sucesso.");

    const url = new URL(`${CARE_ORIGIN}/os_venda_edicao.php`);
    url.searchParams.set("acao", "passoN");
    url.searchParams.set("passo", "3");
    url.searchParams.set("cliente_id", config.clienteId);
    url.searchParams.set("clienteconfig_id", config.clienteConfigId);
    url.searchParams.set("os_id", code);

    onStep(`Acessando a OV ${code}: ${url.toString()}`);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    if (page.url().includes("login.php")) {
      throw validationError("A sessão do Care expirou antes de abrir a OV.");
    }

    onStep("Página da OV carregada. Lendo os dados do cliente.");
    await page.waitForSelector("input.os_solicitante", { timeout: 20000 });
    const raw = await page.evaluate(() => {
      const read = (selector) => document.querySelector(selector)?.value?.trim() || "";
      return {
        document: read("input.os_solicitante_cpf"),
        name: read("input.os_solicitante"),
        email: read("input.os_solicitante_email"),
        phone: read("input.os_solicitante_telefone"),
        zip: read("input.os_solicitante_cep"),
        number: read("input.os_solicitante_numero"),
        street: read("input.os_solicitante_endereco"),
        district: read("input.os_solicitante_bairro"),
        complement: read("input.os_solicitante_compl"),
        city: read("input.os_solicitante_cidade"),
        state: read("input.os_solicitante_uf"),
        coverage: read("input.os_cobertura"),
        stateRegistration: read("input.os_solicitante_inscricao_estadual"),
        deliveryForecast: read("input.os_data_venda"),
        approvalUser: read("input.os_usuario_tecnico2"),
        howFound: read("input.codigo_acordo"),
        customerOrder: read("input.os_chamado_atendimento"),
      };
    });

    if (!raw.name) throw validationError("A OV informada não trouxe os dados do cliente.");
    onStep("Dados do cliente encontrados.");
    return mapCareCustomer(raw);
  } finally {
    onStep("Encerrando o navegador.");
    await browser.close();
  }
}
