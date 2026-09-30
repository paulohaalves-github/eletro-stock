import { validationError } from "../errors";
import { getCareSettings } from "./settings";

const CARE_ORIGIN = "https://websolution.care-br.com";

function careBrowserOptions() {
  return {
    headless: true,
    defaultViewport: { width: 1280, height: 800 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  };
}

async function launchCareBrowser(puppeteer) {
  try {
    return await puppeteer.launch(careBrowserOptions());
  } catch (error) {
    console.error(error);
    throw validationError("Não foi possível abrir o navegador do Care neste servidor.");
  }
}

async function loginCare(page, config, onStep) {
  const loginUrl = `${CARE_ORIGIN}/login.php`;
  onStep(`Acessando endereço: ${loginUrl}`);
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
}

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
  onStep("Abrindo o navegador.");
  const puppeteer = (await import("puppeteer")).default;
  const browser = await launchCareBrowser(puppeteer);

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    page.on("dialog", (dialog) => {
      void dialog.dismiss();
    });
    await loginCare(page, config, onStep);

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
    const raw = await readCareCustomerPage(page);

    if (!raw.name) throw validationError("A OV informada não trouxe os dados do cliente.");
    onStep("Dados do cliente encontrados.");
    return mapCareCustomer(raw);
  } finally {
    onStep("Encerrando o navegador.");
    await browser.close();
  }
}

function careStepUrl(config, ov, passo) {
  const url = new URL(`${CARE_ORIGIN}/os_venda_edicao.php`);
  url.searchParams.set("acao", "passoN");
  url.searchParams.set("passo", String(passo));
  url.searchParams.set("cliente_id", config.clienteId);
  url.searchParams.set("clienteconfig_id", config.clienteConfigId);
  url.searchParams.set("os_id", ov);
  return url.toString();
}

async function readCareCustomerPage(page) {
  await page.waitForSelector("input.os_solicitante", { timeout: 20000 });
  return page.evaluate(() => {
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
}

function parseCareMoney(value) {
  const cleaned = String(value || "").replace(/[^\d,.-]/g, "").trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(",", ".");
  }
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

async function readCareProducts(page) {
  await page.waitForFunction(() => {
    return [...document.querySelectorAll("th")].some((cell) => (cell.textContent || "").replace(/\s+/g, " ").trim().toUpperCase() === "ON");
  }, { timeout: 20000 });
  const rows = await page.evaluate(() => {
    const header = [...document.querySelectorAll("th")].find((cell) => (cell.textContent || "").replace(/\s+/g, " ").trim().toUpperCase() === "ON");
    const table = header?.closest("table");
    if (!table || header.cellIndex < 0) return [];
    const totalHeader = [...table.querySelectorAll("th")].find((cell) => (cell.textContent || "").replace(/\s+/g, " ").trim().toUpperCase() === "TOTAL");
    const products = [];
    const seen = new Set();
    for (const row of table.querySelectorAll("tbody tr")) {
      if (/totais/i.test(row.textContent || "")) continue;
      const serial = (row.cells[header.cellIndex]?.textContent || "").replace(/\s+/g, "").toUpperCase();
      if (!/^ON\d+$/.test(serial) || seen.has(serial)) continue;
      seen.add(serial);
      const soldPriceText = totalHeader && totalHeader.cellIndex >= 0
        ? (row.cells[totalHeader.cellIndex]?.textContent || "").replace(/\s+/g, " ").trim()
        : "";
      products.push({ serialOnyx: serial, soldPriceText });
    }
    return products;
  });
  return rows.map((row) => ({
    serialOnyx: row.serialOnyx,
    soldPrice: parseCareMoney(row.soldPriceText),
  }));
}

async function collectListOvs(page) {
  const rows = await page.evaluate(() => {
    const root = document.querySelector("#grid");
    if (!root) return [];
    const rows = [];
    const seen = new Set();
    const labelOf = (cell) => {
      const direct = [...cell.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (direct) return direct;
      return (cell.innerText || "").replace(/\s+/g, " ").trim().toLowerCase();
    };
    const findHeader = (table, label, onclick) => {
      const headers = [...table.querySelectorAll("th")].filter((cell) => labelOf(cell) === label);
      return headers.find((cell) => cell.querySelector(`a[onclick*="${onclick}"]`)) || headers[0] || null;
    };

    for (const table of root.querySelectorAll("table")) {
      const vendaHeader = findHeader(table, "venda", "os_id");
      const invoiceHeader = findHeader(table, "nota fiscal", "os_nf_numero");
      const totalHeader = findHeader(table, "valor total", "os_valor_total");
      if (!vendaHeader || vendaHeader.cellIndex < 0) continue;
      const bodyRows = [...table.querySelectorAll("tbody tr")];
      const source = bodyRows.length ? bodyRows : [...table.querySelectorAll("tr")].slice(1);
      for (const row of source) {
        if (row.contains(vendaHeader)) continue;
        const cell = row.cells?.[vendaHeader.cellIndex];
        if (!cell) continue;
        const ov = (cell.innerText || "").replace(/\s+/g, "");
        if (!/^\d{3,}$/.test(ov) || seen.has(ov)) continue;
        const invoiceCell = invoiceHeader ? row.cells?.[invoiceHeader.cellIndex] : null;
        const invoiceNumber = (invoiceCell?.innerText || "").replace(/\s+/g, " ").trim();
        const totalCell = totalHeader ? row.cells?.[totalHeader.cellIndex] : null;
        const orderTotalText = (totalCell?.innerText || "").replace(/\s+/g, " ").trim();
        seen.add(ov);
        rows.push({ ov, invoiceNumber, orderTotalText });
      }
      if (rows.length) break;
    }
    return rows;
  });
  return rows.map((row) => ({
    ov: row.ov,
    invoiceNumber: row.invoiceNumber,
    orderTotal: parseCareMoney(row.orderTotalText),
  }));
}

async function readGridMeta(page) {
  return page.evaluate(() => {
    const text = document.querySelector("#grid")?.innerText || "";
    const match = text.match(/p[aá]gina\s+(\d+)\s+de\s+(\d+)/i);
    const notice = (document.querySelector("#apresentaFiltros")?.innerText || "").replace(/\s+/g, " ").trim();
    return {
      page: match ? Number(match[1]) : null,
      pages: match ? Number(match[2]) : null,
      notice,
    };
  });
}

async function openFinalizedGrid(page) {
  await page.waitForFunction(() => document.querySelector("#frm_grid"), { timeout: 20000 });
  await page.waitForFunction(() => {
    const link = document.querySelector('a[title="Finalizado"], a[alt="Finalizado"]');
    const grid = document.querySelector("#grid");
    return !!(link || (grid && grid.querySelector("table")));
  }, { timeout: 30000 }).catch(() => null);

  const before = await page.evaluate(() => document.querySelector("#grid")?.innerHTML || "");
  const navigation = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => null);
  await page.evaluate(() => {
    const link = document.querySelector('a[title="Finalizado"][onclick*="setaStatus"], a[alt="Finalizado"][onclick*="setaStatus"], a[title="Finalizado"], a[alt="Finalizado"]');
    if (link) {
      link.click();
      return;
    }
    if (typeof setaStatus === "function") {
      setaStatus("28", "os_venda.php");
      return;
    }
    const status = document.querySelector("#status_id");
    if (status) status.value = "28";
    if (typeof loadGrid === "function") loadGrid();
  }).catch(() => null);

  await Promise.race([
    navigation,
    page.waitForFunction((previous) => {
      const grid = document.querySelector("#grid");
      const html = grid?.innerHTML || "";
      return html.length > 40 && html !== previous;
    }, { timeout: 8000 }, before).catch(() => null),
  ]);

  if (page.url().includes("login.php")) {
    throw validationError("A sessão do Care expirou antes de abrir os finalizados.");
  }

  await page.waitForFunction(() => {
    const grid = document.querySelector("#grid");
    if (!grid) return false;
    if (grid.querySelector("table tbody tr td")) return true;
    return /nenhum|n[aã]o h[aá]|sem registro|finaliz/i.test(grid.innerText || "");
  }, { timeout: 25000 });
}

async function listKey(page) {
  const found = await collectListOvs(page);
  return found.map((row) => row.ov).join(",");
}

async function clickListControl(page, mode) {
  return page.evaluate((mode) => {
    const textOf = (element) => (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    const isDisabled = (element) => {
      if (!element) return true;
      if (element.classList.contains("disabled") || element.getAttribute("aria-disabled") === "true") return true;
      if (element.closest("li")?.classList.contains("disabled")) return true;
      const style = window.getComputedStyle(element);
      return style.display === "none" || style.visibility === "hidden";
    };
    const click = (element) => {
      element.scrollIntoView({ block: "center" });
      if (window.jQuery) window.jQuery(element).trigger("click");
      else element.click();
    };
    const zones = [
      ...document.querySelectorAll("#grid .pagination, #grid .care-pagination, #grid .paginacao, #grid .pageNext, .pagination, .care-pagination, .paginacao"),
      document.querySelector("#grid"),
    ].filter(Boolean);
    const seenZones = new Set();

    for (const zone of zones) {
      if (seenZones.has(zone)) continue;
      seenZones.add(zone);
      const controls = [...zone.querySelectorAll("a, button")].filter((element) => !isDisabled(element));
      const next = controls.find((element) => {
        const text = textOf(element);
        const pageValue = String(element.getAttribute("data-page") || "");
        return pageValue === "+1" || text === "next" || text === "próximo" || text === "proximo";
      });
      if (mode === "next" && next) {
        click(next);
        return "next";
      }
      if (mode !== "number" || (!next && zone.id === "grid")) continue;
      const pager = next?.closest("ul, nav, .pagination, .care-pagination, .paginacao, .pageNext") || zone;
      const active = pager.querySelector("li.active, a.active, button.active");
      const current = Number((textOf(active) || "").match(/\d+/)?.[0]);
      if (!Number.isInteger(current)) continue;
      const target = [...pager.querySelectorAll("a, button")].find((element) => {
        if (isDisabled(element) || element.closest("li.active, .active")) return false;
        const text = textOf(element);
        const pageValue = String(element.getAttribute("data-page") || "");
        return text === String(current + 1) || pageValue === String(current + 1);
      });
      if (target) {
        click(target);
        return String(current + 1);
      }
    }
    return "";
  }, mode);
}

async function waitForNewList(page, previousKey) {
  const started = Date.now();
  while (Date.now() - started < 12000) {
    const key = await listKey(page);
    if (key && key !== previousKey) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

async function isLastListPage(page) {
  return page.evaluate(() => {
    const zone = document.querySelector("#grid .pagination, #grid .care-pagination, #grid .paginacao, .pagination, .care-pagination, .paginacao");
    if (!zone) return false;
    const textOf = (element) => (element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim();
    const active = zone.querySelector("li.active, a.active, button.active");
    const current = Number((textOf(active).match(/\d+/) || [])[0]);
    const numbers = [...zone.querySelectorAll("a, button, span")]
      .map((element) => Number(textOf(element)))
      .filter((value) => Number.isInteger(value) && value > 0 && value < 500);
    const last = numbers.length ? Math.max(...numbers) : 0;
    if (current && last && current >= last) return true;
    const next = [...zone.querySelectorAll("a, button, span")].find((element) => /^(next|próximo|proximo)$/i.test(textOf(element)));
    if (!next) return false;
    if (next.tagName === "SPAN") return true;
    return next.classList.contains("disabled") || Boolean(next.closest("li")?.classList.contains("disabled"));
  }).catch(() => false);
}

async function goToNextGridPage(page) {
  try {
    const previousKey = await listKey(page);
    if (!previousKey) return false;
    if (await isLastListPage(page)) return false;

    const nextClicked = await clickListControl(page, "next");
    if (nextClicked && await waitForNewList(page, previousKey)) return true;

    const numberClicked = await clickListControl(page, "number");
    if (numberClicked && await waitForNewList(page, previousKey)) return true;
    return false;
  } catch {
    return false;
  }
}

async function closeCareBrowser(browser) {
  if (!browser) return;
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);
  const child = typeof browser.process === "function" ? browser.process() : null;
  if (child && child.exitCode == null && !child.killed) {
    try { child.kill(); } catch { /* o processo já encerrou */ }
  }
}

export async function collectCareFinalizedSales(onStep = () => {}, { skipOvs = [] } = {}) {
  const config = await careConfig();
  const known = new Set(skipOvs.map((value) => String(value)));
  onStep("Abrindo o navegador.", { phase: "list", current: 0, total: 0, label: "Abrindo o navegador" });
  const puppeteer = (await import("puppeteer")).default;
  const browser = await launchCareBrowser(puppeteer);

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    page.on("dialog", (dialog) => {
      void dialog.dismiss();
    });
    await loginCare(page, config, onStep);

    const listUrl = new URL(`${CARE_ORIGIN}/os_venda.php`);
    listUrl.searchParams.set("cliente_id", config.clienteId);
    listUrl.searchParams.set("clienteconfig_id", config.clienteConfigId);
    listUrl.searchParams.set("status_id", "28");
    onStep("Acessando a lista de OV.", { phase: "list", current: 0, total: 0, label: "Abrindo a lista de OV" });
    await page.goto(listUrl.toString(), { waitUntil: "domcontentloaded" });
    if (page.url().includes("login.php")) {
      throw validationError("A sessão do Care expirou antes de abrir os atendimentos.");
    }
    onStep("Selecionando o status Finalizado.", { phase: "list", current: 0, total: 0, label: "Selecionando Finalizado" });
    await openFinalizedGrid(page);
    const firstMeta = await readGridMeta(page);
    if (firstMeta.notice) onStep(firstMeta.notice);

    const listed = [];
    const seen = new Set();
    let previousKey = "";
    for (let pageNumber = 1; pageNumber <= 200; pageNumber += 1) {
      const found = await collectListOvs(page);
      const key = found.map((row) => row.ov).join(",");
      if (pageNumber > 1 && key === previousKey) break;
      previousKey = key;
      let added = 0;
      for (const row of found) {
        if (seen.has(row.ov)) continue;
        seen.add(row.ov);
        listed.push(row);
        added += 1;
      }
      const meta = await readGridMeta(page);
      const pages = meta.pages || 0;
      const first = found[0];
      onStep(`Página ${meta.page || pageNumber}${pages ? ` de ${pages}` : ""}: ${found.length} OV(s) na coluna Venda${first ? `, a partir de ${first.ov} (NF ${first.invoiceNumber || "sem número"})` : ""}. Total acumulado: ${listed.length}.`, {
        phase: "list",
        current: meta.page || pageNumber,
        total: pages,
        label: pages
          ? `Lista de finalizados, página ${meta.page || pageNumber} de ${pages}`
          : `Lista de finalizados, página ${pageNumber}`,
      });
      if (!added && pageNumber > 1) break;
      const moved = await goToNextGridPage(page);
      if (!moved) break;
    }

    const sales = [];
    const skipped = [];
    const pendingRows = listed.filter((row) => !known.has(row.ov));
    onStep(`Lista concluída com ${listed.length} OV(s). Lendo os detalhes.`, {
      phase: "read",
      current: 0,
      total: pendingRows.length,
      label: pendingRows.length ? `Lendo OV 0 de ${pendingRows.length}` : "Lista concluída",
    });
    const alreadyImported = listed.length - pendingRows.length;
    if (alreadyImported) {
      onStep(`${alreadyImported} OV(s) já importadas foram puladas.`);
      skipped.push({ ov: "", reason: `${alreadyImported} OV(s) já estavam no sistema.` });
    }
    for (let index = 0; index < pendingRows.length; index += 1) {
      const { ov, invoiceNumber, orderTotal } = pendingRows[index];
      onStep(`Lendo a OV ${ov}.`, {
        phase: "read",
        current: index + 1,
        total: pendingRows.length,
        label: `Lendo OV ${index + 1} de ${pendingRows.length}`,
      });
      try {
        const customerUrl = careStepUrl(config, ov, 3);
        await page.goto(customerUrl, { waitUntil: "domcontentloaded" });
        if (page.url().includes("login.php")) {
          for (const pendingRow of pendingRows.slice(index)) {
            skipped.push({ ov: pendingRow.ov, reason: "A sessão do Care expirou." });
            onStep(`OV ${pendingRow.ov} ignorada: a sessão do Care expirou.`);
          }
          break;
        }
        const raw = await readCareCustomerPage(page);
        const productUrl = careStepUrl(config, ov, 4);
        await page.goto(productUrl, { waitUntil: "domcontentloaded" });
        if (page.url().includes("login.php")) {
          for (const pendingRow of pendingRows.slice(index)) {
            skipped.push({ ov: pendingRow.ov, reason: "A sessão do Care expirou." });
            onStep(`OV ${pendingRow.ov} ignorada: a sessão do Care expirou.`);
          }
          break;
        }
        const products = await readCareProducts(page);
        sales.push({
          ov,
          invoiceNumber,
          orderTotal,
          customer: mapCareCustomer(raw),
          sellerName: raw.approvalUser || "",
          products,
        });
        onStep(`OV ${ov}: ${raw.name || "cliente sem nome"}, ${products.length} produto(s).`);
      } catch (error) {
        const reason = error instanceof Error && error.status
          ? error.message
          : "Não foi possível ler esta OV no Care.";
        if (!(error instanceof Error) || !error.status) console.error(error);
        skipped.push({ ov, reason });
        onStep(`OV ${ov} ignorada: ${reason}`);
      }
    }

    return { sales, skipped };
  } finally {
    onStep("Encerrando o navegador.");
    await closeCareBrowser(browser);
  }
}
