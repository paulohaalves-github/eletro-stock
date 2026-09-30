import { prisma } from "../db";
import { AppError, forbidden } from "../errors";
import { SALE_ORDER_CLOSED_STATUSES, SALE_ORDER_ITEM_STATUSES, STATUSES, STATUS_LABELS } from "../constants";
import { digitsOnly } from "../phone";
import { can, canManageAllSaleOrders, PERMISSIONS } from "../permissions";
import { requireActiveUnit } from "../units";
import { createCustomer } from "./customers";
import {
  addSaleOrderItem,
  checkoutSaleOrder,
  createSaleOrder,
  deleteSaleOrder,
  generateSaleOrder,
  releaseReservationForCareImport,
  reserveSaleOrderItem,
} from "./sale-orders";

const WARRANTY_MONTHS = 6;

function errorMessage(error) {
  if (error instanceof AppError) return error.message;
  console.error(error);
  return "Não foi possível importar esta OV.";
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanEmail(value) {
  const email = String(value || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

async function findCustomerByDocument(document) {
  const doc = digitsOnly(document);
  if (doc.length < 11) return null;
  const candidates = await prisma.customer.findMany({
    where: {
      document: { not: null },
      OR: [{ document: doc }, { document: { contains: doc } }],
    },
    select: { id: true, name: true, document: true },
  });
  return candidates.find((item) => digitsOnly(item.document) === doc) || null;
}

function matchSeller(name, users) {
  const needle = normalizeName(name);
  if (!needle) return { error: "A OV não tem usuário de aprovação da venda." };
  const eligible = users.filter((user) => can(user.role, PERMISSIONS.SALE_CREATE));
  const exact = eligible.filter((user) => normalizeName(user.name) === needle);
  if (exact.length === 1) return { seller: exact[0] };
  if (exact.length > 1) return { error: `Mais de um usuário ativo tem o nome ${name.trim()}.` };
  const partial = eligible.filter((user) => {
    const current = normalizeName(user.name);
    return current.startsWith(`${needle} `) || needle.startsWith(`${current} `);
  });
  if (partial.length === 1) return { seller: partial[0] };
  if (!partial.length) return { error: `Nenhum usuário corresponde a ${name.trim()}.` };
  return { error: `Mais de um usuário corresponde a ${name.trim()}.` };
}

async function resolveCustomer(entry, user, warnings) {
  const customer = entry.customer || {};
  const document = digitsOnly(customer.document);
  if (document.length < 11) {
    return { error: "A OV não tem CPF/CNPJ." };
  }
  const existing = await findCustomerByDocument(customer.document);
  if (existing) return { customer: existing };

  const name = String(customer.name || "").trim();
  if (!name) return { error: "A OV não trouxe o nome do cliente." };
  const phone = customer.phones?.[0]?.phone;
  if (!phone) return { error: "A OV não trouxe o telefone do cliente." };

  let address = String(customer.address || "").trim();
  if (!address) {
    address = "Não informado no Care";
    warnings.push(`OV ${entry.ov}: cliente cadastrado sem endereço no Care.`);
  }

  const created = await createCustomer({
    name,
    document: customer.document,
    email: cleanEmail(customer.email),
    address,
    notes: customer.notes || "",
    phones: [{ phone, label: "" }],
  }, user);
  if (created.warning) warnings.push(`OV ${entry.ov}: ${created.warning}`);
  return { customer: created.customer };
}

async function eligibleProducts(entry, unitId) {
  const ready = [];
  const reasons = [];
  const seen = new Set();

  for (const row of entry.products || []) {
    const serial = String(row.serialOnyx || "").trim();
    if (!serial || seen.has(serial.toUpperCase())) continue;
    seen.add(serial.toUpperCase());

    let product = await prisma.product.findUnique({
      where: { serialOnyx: serial },
      select: {
        id: true,
        serialOnyx: true,
        status: true,
        unitId: true,
        deletedAt: true,
        unit: { select: { name: true } },
      },
    });
    if (!product && serial !== serial.toUpperCase()) {
      product = await prisma.product.findUnique({
        where: { serialOnyx: serial.toUpperCase() },
        select: {
          id: true,
          serialOnyx: true,
          status: true,
          unitId: true,
          deletedAt: true,
          unit: { select: { name: true } },
        },
      });
    }
    if (!product || product.deletedAt) {
      reasons.push(`${serial} não encontrado no estoque`);
      continue;
    }
    if (product.unitId !== unitId) {
      reasons.push(`${product.serialOnyx} está na unidade ${product.unit?.name || "outra"}`);
      continue;
    }
    const soldPrice = row.soldPrice == null ? null : Number(row.soldPrice);
    if (product.status === STATUSES.RESERVED) {
      ready.push({ product, release: true, soldPrice });
      continue;
    }
    if (product.status === STATUSES.AVAILABLE) {
      ready.push({ product, release: false, soldPrice });
      continue;
    }
    reasons.push(`${product.serialOnyx} está ${STATUS_LABELS[product.status] || product.status}`);
  }

  return { ready, reasons };
}

export async function importCareSales(entries, user, onStep = () => {}) {
  if (!canManageAllSaleOrders(user.role) || !can(user.role, PERMISSIONS.SALE_CHECKOUT)) {
    throw forbidden("Somente o gestor ou o administrador pode sincronizar as vendas do Care.");
  }
  const unitId = requireActiveUnit(user);
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
  });
  const reservedUntil = todayKey();
  const imported = [];
  const skipped = [];
  const warnings = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const ov = String(entry.ov || "").trim();
    const invoiceNumber = String(entry.invoiceNumber || "").trim();
    onStep(`Importando a OV ${ov}.`, {
      phase: "import",
      current: index + 1,
      total: entries.length,
      label: `Importando OV ${index + 1} de ${entries.length}`,
    });
    let order = null;
    let generated = false;
    let added = [];
    let reasons = [];
    try {
      const already = await prisma.saleOrder.findUnique({
        where: { ov },
        select: { id: true, number: true },
      });
      if (already) {
        skipped.push({ ov, reason: "Já importada." });
        onStep(`OV ${ov} já está no sistema. Pulando.`);
        continue;
      }

      if (!invoiceNumber) {
        skipped.push({ ov, reason: "A coluna Nota Fiscal está vazia." });
        onStep(`OV ${ov} ignorada: a coluna Nota Fiscal está vazia.`);
        continue;
      }

      const sellerMatch = matchSeller(entry.sellerName, users);
      if (!sellerMatch.seller) {
        skipped.push({ ov, reason: sellerMatch.error });
        onStep(`OV ${ov} ignorada: ${sellerMatch.error}`);
        continue;
      }

      const customerMatch = await resolveCustomer(entry, user, warnings);
      if (!customerMatch.customer) {
        skipped.push({ ov, reason: customerMatch.error });
        onStep(`OV ${ov} ignorada: ${customerMatch.error}`);
        continue;
      }

      const eligible = await eligibleProducts(entry, unitId);
      reasons = eligible.reasons;
      const ready = eligible.ready;
      if (!ready.length) {
        const reason = reasons.join("; ") || "Nenhum produto com serial ON.";
        skipped.push({ ov, reason });
        onStep(`OV ${ov} ignorada: ${reason}`);
        continue;
      }

      order = await createSaleOrder({
        customerId: customerMatch.customer.id,
        sellerId: sellerMatch.seller.id,
        observation: `Importada do Care. OV ${ov}. NF ${invoiceNumber}.`,
      }, user);
      try {
        await prisma.saleOrder.update({ where: { id: order.id }, data: { ov } });
      } catch (error) {
        await deleteSaleOrder(order.id, user);
        order = null;
        if (error?.code === "P2002") {
          skipped.push({ ov, reason: "Já importada." });
          continue;
        }
        throw error;
      }

      for (const row of ready) {
        try {
          if (row.release) {
            const interest = await prisma.saleOrderItem.findFirst({
              where: {
                productId: row.product.id,
                status: SALE_ORDER_ITEM_STATUSES.INTEREST,
                saleOrder: { closedAt: null, status: { notIn: SALE_ORDER_CLOSED_STATUSES } },
              },
              select: { saleOrder: { select: { number: true } } },
            });
            if (interest) {
              reasons.push(`${row.product.serialOnyx} também está como interesse na venda ${interest.saleOrder?.number || "aberta"}`);
              continue;
            }
            await releaseReservationForCareImport(row.product.id, user);
          }
          const withItem = await addSaleOrderItem(order.id, row.product.id, user);
          const item = withItem.items.find((current) =>
            current.productId === row.product.id && current.status !== SALE_ORDER_ITEM_STATUSES.REMOVED,
          );
          if (!item) throw new AppError(`Não foi possível incluir ${row.product.serialOnyx}.`);
          await reserveSaleOrderItem(order.id, item.id, reservedUntil, user);
          const onlyProduct = (entry.products || []).length === 1;
          const soldPrice = row.soldPrice != null
            ? row.soldPrice
            : (onlyProduct && entry.orderTotal != null ? entry.orderTotal : null);
          added.push({ itemId: item.id, serial: row.product.serialOnyx, soldPrice });
        } catch (error) {
          reasons.push(`${row.product.serialOnyx}: ${errorMessage(error)}`);
        }
      }

      if (!added.length) {
        await deleteSaleOrder(order.id, user);
        order = null;
        const reason = reasons.join("; ") || "Nenhum produto pôde ser incluído.";
        skipped.push({ ov, reason });
        onStep(`OV ${ov} ignorada: ${reason}`);
        continue;
      }

      await generateSaleOrder(order.id, user);
      generated = true;
      const fresh = await prisma.saleOrder.findUnique({
        where: { id: order.id },
        select: { items: { select: { id: true, status: true } } },
      });
      const checkoutItems = added
        .map((row) => fresh?.items?.find((item) => item.id === row.itemId))
        .filter((item) => item && [SALE_ORDER_ITEM_STATUSES.ORDERED, SALE_ORDER_ITEM_STATUSES.RESERVED].includes(item.status));
      if (!checkoutItems.length) throw new AppError("Nenhum produto ficou pronto para baixa.");
      await checkoutSaleOrder(order.id, {
        invoiceNumber,
        soldAt: new Date().toISOString(),
        items: checkoutItems.map((item) => {
          const addedRow = added.find((row) => row.itemId === item.id);
          return {
            itemId: item.id,
            warrantyMonths: WARRANTY_MONTHS,
            invoiceNumber,
            ...(addedRow?.soldPrice != null ? { cashPrice: addedRow.soldPrice } : {}),
          };
        }),
      }, user);

      imported.push({
        ov,
        id: order.id,
        number: order.number,
        products: added.map((row) => row.serial),
        pending: reasons,
      });
      const pending = reasons.length ? ` Pendências: ${reasons.join("; ")}.` : "";
      const priced = added.filter((row) => row.soldPrice != null);
      const priceNote = priced.length
        ? ` Valor vendido: ${priced.map((row) => `${row.serial} ${row.soldPrice.toFixed(2)}`).join(", ")}.`
        : " Valor vendido não informado no Care; a baixa usou o preço à vista do estoque.";
      onStep(`OV ${ov} importada como ${order.number}, com NF ${invoiceNumber} e garantia de ${WARRANTY_MONTHS} meses.${priceNote}${pending}`);
    } catch (error) {
      const reason = errorMessage(error);
      if (order?.id && generated) {
        imported.push({
          ov,
          id: order.id,
          number: order.number,
          products: added.map((row) => row.serial),
          pending: [...reasons, reason],
        });
        onStep(`OV ${ov} ficou como ${order.number}, mas a baixa não foi concluída: ${reason}`);
        continue;
      }
      if (order?.id) await deleteSaleOrder(order.id, user).catch(() => {});
      skipped.push({ ov, reason });
      onStep(`OV ${ov} ignorada: ${reason}`);
    }
  }

  onStep(`Importação concluída. ${imported.length} venda(s) gravada(s) nesta etapa.`);
  return { imported, skipped, warnings };
}
