import { prisma } from "../db";
import { AppError, forbidden } from "../errors";
import { SALE_ORDER_CLOSED_STATUSES, SALE_ORDER_EVENT_TYPES, SALE_ORDER_ITEM_STATUSES, STATUSES, STATUS_LABELS } from "../constants";
import { digitsOnly } from "../phone";
import { formatDateTime } from "../format";
import { can, canManageAllSaleOrders, PERMISSIONS } from "../permissions";
import { requireActiveUnit } from "../units";
import { createCustomer } from "./customers";
import {
  addSaleOrderItem,
  addSaleOrderNote,
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

function carePayment(payment) {
  const methods = (payment?.methods || []).map((value) => String(value || "").trim());
  const count = Number(payment?.installmentCount || 0);
  const filled = methods.filter(Boolean);
  const unique = new Set(filled.map((value) => value.toLocaleLowerCase("pt-BR")));
  if (!count || filled.length !== count || unique.size !== 1) {
    return { paymentMethod: null, installmentCount: null };
  }
  return { paymentMethod: filled[0], installmentCount: count };
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

function holdUntilKey() {
  const [year, month, day] = todayKey().split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + 365));
  const nextMonth = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${nextMonth}-${nextDay}`;
}

function missingStockNote(serial) {
  return `${serial} não encontrado no estoque.`;
}

function careSerialsOf(entry) {
  return [...new Set((entry.products || [])
    .map((row) => String(row.serialOnyx || "").trim().toUpperCase())
    .filter(Boolean))];
}

async function findOpenReservedSale(customerId, unitId, serials) {
  const wanted = new Set(serials);
  if (!customerId || !wanted.size) return { order: null, ambiguous: [] };
  const orders = await prisma.saleOrder.findMany({
    where: {
      customerId,
      unitId,
      ov: null,
      closedAt: null,
      status: { notIn: SALE_ORDER_CLOSED_STATUSES },
    },
    select: {
      id: true,
      number: true,
      status: true,
      closedAt: true,
      items: {
        where: {
          status: { in: [SALE_ORDER_ITEM_STATUSES.RESERVED, SALE_ORDER_ITEM_STATUSES.ORDERED] },
        },
        select: { product: { select: { serialOnyx: true } } },
      },
    },
  });
  const matches = orders.filter((order) => order.items.some((item) =>
    wanted.has(String(item.product?.serialOnyx || "").toUpperCase()),
  ));
  if (matches.length === 1) return { order: matches[0], ambiguous: [] };
  if (matches.length > 1) return { order: null, ambiguous: matches };
  return { order: null, ambiguous: [] };
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
  const missing = [];
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
      const label = serial.toUpperCase();
      missing.push(label);
      reasons.push(`${label} não encontrado no estoque`);
      continue;
    }
    if (product.unitId !== unitId) {
      reasons.push(`${product.serialOnyx} está na unidade ${product.unit?.name || "outra"}`);
      continue;
    }
    if (row.soldPrice == null) {
      reasons.push(`${product.serialOnyx} não tem Valor Venda no Care`);
      continue;
    }
    const soldPrice = Number(row.soldPrice);
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

  return { ready, reasons, missing };
}

async function orderItems(orderId) {
  return prisma.saleOrderItem.findMany({
    where: { saleOrderId: orderId, status: { not: SALE_ORDER_ITEM_STATUSES.REMOVED } },
    select: {
      id: true,
      status: true,
      productId: true,
      product: { select: { serialOnyx: true } },
    },
  });
}

async function noteMissingSerial(orderId, serial, user) {
  const message = missingStockNote(serial);
  const existing = await prisma.saleOrderEvent.findFirst({
    where: { saleOrderId: orderId, type: SALE_ORDER_EVENT_TYPES.NOTE, message },
    select: { id: true },
  });
  if (existing) return;
  await addSaleOrderNote(orderId, message, user);
}

async function keepReservationOpen(orderId) {
  await prisma.saleOrderItem.updateMany({
    where: {
      saleOrderId: orderId,
      status: { in: [SALE_ORDER_ITEM_STATUSES.RESERVED, SALE_ORDER_ITEM_STATUSES.ORDERED] },
    },
    data: { reservedUntil: new Date(`${holdUntilKey()}T23:59:59.999-03:00`) },
  });
}

export async function careOvsAwaitingProducts() {
  const orders = await prisma.saleOrder.findMany({
    where: {
      ov: { not: null },
      closedAt: null,
      status: { notIn: SALE_ORDER_CLOSED_STATUSES },
    },
    select: { ov: true },
  });
  return orders.map((order) => order.ov).filter(Boolean);
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
  const reservedUntil = holdUntilKey();
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
    let createdNow = false;
    let linked = false;
    let generated = false;
    let added = [];
    let reasons = [];
    try {
      const already = await prisma.saleOrder.findUnique({
        where: { ov },
        select: { id: true, number: true, status: true, closedAt: true },
      });
      const closed = already && (already.closedAt || SALE_ORDER_CLOSED_STATUSES.includes(already.status));
      if (closed) {
        skipped.push({ ov, reason: "Já importada." });
        onStep(`OV ${ov} já está no sistema. Pulando.`);
        continue;
      }
      if (already) {
        order = already;
        onStep(`OV ${ov} já está reservada em ${already.number}. Conferindo os produtos.`);
      }

      const { paymentMethod, installmentCount } = carePayment(entry.payment);
      const eligible = await eligibleProducts(entry, unitId);
      reasons = eligible.reasons;
      const ready = eligible.ready;
      const careSerials = careSerialsOf(entry);

      if (!order) {
        const knownCustomer = await findCustomerByDocument(entry.customer?.document);
        if (knownCustomer) {
          const reservedMatch = await findOpenReservedSale(knownCustomer.id, unitId, careSerials);
          if (reservedMatch.ambiguous.length > 1) {
            const numbers = reservedMatch.ambiguous.map((item) => item.number).join(", ");
            const reason = `Há mais de uma venda reservada deste cliente com produtos desta OV: ${numbers}.`;
            skipped.push({ ov, reason });
            onStep(`OV ${ov} ignorada: ${reason}`);
            continue;
          }
          if (reservedMatch.order) {
            order = reservedMatch.order;
            linked = true;
            try {
              await prisma.saleOrder.update({
                where: { id: order.id },
                data: {
                  ov,
                  ...(paymentMethod && installmentCount ? { paymentMethod, installmentCount } : {}),
                },
              });
            } catch (error) {
              order = null;
              linked = false;
              if (error?.code === "P2002") {
                skipped.push({ ov, reason: "Já importada." });
                onStep(`OV ${ov} já está no sistema. Pulando.`);
                continue;
              }
              throw error;
            }
            await addSaleOrderNote(order.id, `OV ${ov} do Care vinculada a esta venda.`, user);
            onStep(`OV ${ov} corresponde à venda reservada ${order.number}.`);
          }
        }
      }

      if (!order && !invoiceNumber) {
        skipped.push({ ov, reason: "A coluna Nota Fiscal está vazia." });
        onStep(`OV ${ov} ignorada: a coluna Nota Fiscal está vazia.`);
        continue;
      }

      if (!order) {
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

        if (!ready.length) {
          const reason = reasons.join("; ") || "Nenhum produto com serial ON.";
          skipped.push({ ov, reason });
          onStep(`OV ${ov} ignorada: ${reason}`);
          continue;
        }

        order = await createSaleOrder({
          customerId: customerMatch.customer.id,
          sellerId: sellerMatch.seller.id,
          observation: `Importada do Care. OV ${ov}. NF ${invoiceNumber}.${paymentMethod && installmentCount ? ` ${paymentMethod}, ${installmentCount}x.` : ""}`,
        }, user);
        createdNow = true;
        try {
          await prisma.saleOrder.update({
            where: { id: order.id },
            data: { ov, paymentMethod, installmentCount },
          });
        } catch (error) {
          await deleteSaleOrder(order.id, user);
          order = null;
          createdNow = false;
          if (error?.code === "P2002") {
            skipped.push({ ov, reason: "Já importada." });
            continue;
          }
          throw error;
        }
      }

      for (const row of ready) {
        try {
          const current = (await orderItems(order.id)).find((item) => item.productId === row.product.id);
          if (current?.status === SALE_ORDER_ITEM_STATUSES.SOLD) {
            added.push({ itemId: current.id, serial: row.product.serialOnyx, soldPrice: row.soldPrice, fresh: false });
            continue;
          }
          if (current && [SALE_ORDER_ITEM_STATUSES.INTEREST, SALE_ORDER_ITEM_STATUSES.RESERVED, SALE_ORDER_ITEM_STATUSES.ORDERED].includes(current.status)) {
            if (current.status === SALE_ORDER_ITEM_STATUSES.INTEREST) {
              await reserveSaleOrderItem(order.id, current.id, reservedUntil, user);
            }
            added.push({
              itemId: current.id,
              serial: row.product.serialOnyx,
              soldPrice: row.soldPrice,
              fresh: current.status === SALE_ORDER_ITEM_STATUSES.INTEREST,
            });
            continue;
          }
          if (row.release) {
            const interest = await prisma.saleOrderItem.findFirst({
              where: {
                productId: row.product.id,
                status: SALE_ORDER_ITEM_STATUSES.INTEREST,
                saleOrderId: { not: order.id },
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
          const item = withItem.items.find((currentItem) =>
            currentItem.productId === row.product.id && currentItem.status !== SALE_ORDER_ITEM_STATUSES.REMOVED,
          );
          if (!item) throw new AppError(`Não foi possível incluir ${row.product.serialOnyx}.`);
          await reserveSaleOrderItem(order.id, item.id, reservedUntil, user);
          added.push({ itemId: item.id, serial: row.product.serialOnyx, soldPrice: row.soldPrice, fresh: true });
        } catch (error) {
          reasons.push(`${row.product.serialOnyx}: ${errorMessage(error)}`);
        }
      }

      const itemsNow = await orderItems(order.id);
      const present = new Set(itemsNow.map((item) => String(item.product?.serialOnyx || "").toUpperCase()));
      const absent = careSerials.filter((serial) => !present.has(serial));

      if (!added.length && createdNow) {
        await deleteSaleOrder(order.id, user);
        order = null;
        createdNow = false;
        const reason = reasons.join("; ") || "Nenhum produto pôde ser incluído.";
        skipped.push({ ov, reason });
        onStep(`OV ${ov} ignorada: ${reason}`);
        continue;
      }

      if (absent.length) {
        for (const serial of eligible.missing) {
          if (absent.includes(serial)) await noteMissingSerial(order.id, serial, user);
        }
        await keepReservationOpen(order.id);
        const fresh = added.filter((row) => row.fresh);
        const missingNow = eligible.missing.filter((serial) => absent.includes(serial));
        const waiting = missingNow.length ? `${missingNow.join(", ")} não encontrado no estoque.` : `${absent.join(", ")} ainda não entrou nesta venda.`;
        if (createdNow || fresh.length) {
          imported.push({
            ov,
            id: order.id,
            number: order.number,
            products: added.map((row) => row.serial),
            pending: reasons,
          });
          const included = fresh.length ? ` ${fresh.map((row) => row.serial).join(", ")} reservado.` : "";
          onStep(`OV ${ov} ficou reservada em ${order.number}.${included} ${waiting}`);
        } else {
          onStep(`OV ${ov} continua reservada em ${order.number}. ${waiting}`);
        }
        continue;
      }

      if (!invoiceNumber) {
        skipped.push({ ov, reason: "A coluna Nota Fiscal está vazia." });
        onStep(`OV ${ov} continua em ${order.number}: a coluna Nota Fiscal está vazia.`);
        continue;
      }

      const careOnSale = itemsNow.filter((item) => careSerials.includes(String(item.product?.serialOnyx || "").toUpperCase()));
      const careStillOpen = careOnSale.some((item) => [
        SALE_ORDER_ITEM_STATUSES.INTEREST,
        SALE_ORDER_ITEM_STATUSES.RESERVED,
        SALE_ORDER_ITEM_STATUSES.ORDERED,
      ].includes(item.status));
      if (!careStillOpen && careOnSale.some((item) => item.status === SALE_ORDER_ITEM_STATUSES.SOLD)) {
        const extras = itemsNow.some((item) =>
          !careSerials.includes(String(item.product?.serialOnyx || "").toUpperCase())
          && [SALE_ORDER_ITEM_STATUSES.RESERVED, SALE_ORDER_ITEM_STATUSES.ORDERED].includes(item.status),
        );
        onStep(extras
          ? `OV ${ov} já foi concretizada em ${order.number}. Os demais produtos reservados permanecem nesta venda.`
          : `OV ${ov} já foi concretizada em ${order.number}.`);
        continue;
      }

      const outsideCare = itemsNow
        .filter((item) => !careSerials.includes(String(item.product?.serialOnyx || "").toUpperCase()))
        .filter((item) => [SALE_ORDER_ITEM_STATUSES.RESERVED, SALE_ORDER_ITEM_STATUSES.ORDERED].includes(item.status))
        .map((item) => item.id);

      await generateSaleOrder(order.id, user);
      generated = true;
      if (outsideCare.length) {
        await prisma.saleOrderItem.updateMany({
          where: { id: { in: outsideCare }, status: SALE_ORDER_ITEM_STATUSES.ORDERED },
          data: { status: SALE_ORDER_ITEM_STATUSES.RESERVED },
        });
      }
      const priced = await orderItems(order.id);
      const priceBySerial = new Map((entry.products || []).map((row) => [
        String(row.serialOnyx || "").trim().toUpperCase(),
        row.soldPrice,
      ]));
      const checkoutItems = priced.filter((item) =>
        careSerials.includes(String(item.product?.serialOnyx || "").toUpperCase())
        && [SALE_ORDER_ITEM_STATUSES.ORDERED, SALE_ORDER_ITEM_STATUSES.RESERVED].includes(item.status),
      );
      if (!checkoutItems.length) {
        onStep(`OV ${ov} já está completa em ${order.number}.`);
        continue;
      }
      await checkoutSaleOrder(order.id, {
        invoiceNumber,
        soldAt: entry.soldAt || new Date().toISOString(),
        items: checkoutItems.map((item) => ({
          itemId: item.id,
          warrantyMonths: WARRANTY_MONTHS,
          invoiceNumber,
          cashPrice: priceBySerial.get(String(item.product?.serialOnyx || "").toUpperCase()),
          paymentMethod,
          installmentCount,
        })),
      }, user);

      imported.push({
        ov,
        id: order.id,
        number: order.number,
        products: added.map((row) => row.serial),
        pending: reasons,
      });
      const pending = reasons.length ? ` Pendências: ${reasons.join("; ")}.` : "";
      const paymentNote = paymentMethod && installmentCount ? ` ${paymentMethod}, ${installmentCount}x.` : "";
      const priceNote = ` Valor vendido: ${added.map((row) => `${row.serial} ${Number(row.soldPrice).toFixed(2)}`).join(", ")}.${paymentNote}`;
      const soldNote = ` Data da venda: ${formatDateTime(entry.soldAt || new Date())}.`;
      const origin = linked
        ? `concretizada na venda ${order.number}, que já estava reservada`
        : `importada como ${order.number}`;
      onStep(`OV ${ov} ${origin}, com NF ${invoiceNumber} e garantia de ${WARRANTY_MONTHS} meses.${soldNote}${priceNote}${pending}`);
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
      if (order?.id && createdNow) await deleteSaleOrder(order.id, user).catch(() => {});
      skipped.push({ ov, reason });
      onStep(`OV ${ov} ignorada: ${reason}`);
    }
  }

  onStep(`Importação concluída. ${imported.length} venda(s) gravada(s) nesta etapa.`);
  return { imported, skipped, warnings };
}

function saleDateLooksLikeImport(soldAt, createdAt) {
  if (!soldAt || !createdAt) return true;
  return Math.abs(new Date(soldAt).getTime() - new Date(createdAt).getTime()) < 2 * 60 * 1000;
}

export async function careOvsNeedingSaleDate() {
  const orders = await prisma.saleOrder.findMany({
    where: { ov: { not: null } },
    select: {
      ov: true,
      items: {
        where: { status: SALE_ORDER_ITEM_STATUSES.SOLD, saleId: { not: null } },
        select: { soldAt: true, sale: { select: { soldAt: true, createdAt: true } } },
      },
    },
  });
  return orders
    .filter((order) => order.items.some((item) => saleDateLooksLikeImport(item.sale?.soldAt || item.soldAt, item.sale?.createdAt)))
    .map((order) => order.ov);
}

export async function applyCareSaleDates(updates, onStep = () => {}) {
  let updated = 0;
  for (const entry of updates || []) {
    const soldAt = new Date(entry.soldAt);
    if (!entry.ov || Number.isNaN(soldAt.getTime())) continue;
    const order = await prisma.saleOrder.findUnique({
      where: { ov: String(entry.ov) },
      select: { id: true, number: true, items: { select: { saleId: true } } },
    });
    if (!order) continue;
    const saleIds = [...new Set(order.items.map((item) => item.saleId).filter(Boolean))];
    if (saleIds.length) {
      await prisma.sale.updateMany({ where: { id: { in: saleIds } }, data: { soldAt } });
    }
    await prisma.saleOrderItem.updateMany({
      where: { saleOrderId: order.id, status: SALE_ORDER_ITEM_STATUSES.SOLD },
      data: { soldAt },
    });
    updated += 1;
    onStep(`OV ${entry.ov}: data da venda gravada em ${order.number}.`);
  }
  return updated;
}
