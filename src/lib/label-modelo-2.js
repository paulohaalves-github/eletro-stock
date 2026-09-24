import { formatCurrency } from "@/lib/format";

/**
 * Rolo 2 colunas (Zebra GC420t):
 * - Página na ZDesigner: 10,30 × 2,50 cm
 * - Gap físico entre colunas: 0,4 cm
 * - Cada etiqueta: (10,30 − 0,40) / 2 = 4,95 × 2,50 cm
 *
 * Na ZDesigner: Largura 10,30 | Altura 2,50 | retrato
 * “rotate 180°” só se a etiqueta sair invertida (não giramos no app).
 */
export const LABEL_02_CM = {
  width: 4.95,
  height: 2.5,
  gap: 0.4,
  get pageWidth() {
    return this.width * 2 + this.gap;
  },
};

/** ~32 px/mm (alta resolução) + limiar P/B para térmica sem “tremido” */
export const LABEL_02_PX_PER_MM = 32;
export const LABEL_02_PX = {
  width: Math.round(LABEL_02_CM.width * 10 * LABEL_02_PX_PER_MM),
  height: Math.round(LABEL_02_CM.height * 10 * LABEL_02_PX_PER_MM),
  gap: Math.round(LABEL_02_CM.gap * 10 * LABEL_02_PX_PER_MM),
  get pageWidth() {
    return this.width * 2 + this.gap;
  },
};

function productName(product) {
  return String(product.commercialName || product.supplierModelCode || product.category?.name || "Produto")
    .trim()
    .toUpperCase();
}

function capacityLine(product) {
  return String(product.capacitySizeType || "").trim().toUpperCase();
}

function fitText(ctx, text, maxWidth) {
  const value = String(text || "—");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/** Quebra o texto em linhas sem ultrapassar maxWidth (quebra palavra longa por caractere). */
function wrapText(ctx, text, maxWidth) {
  const value = String(text || "—").trim() || "—";
  const words = value.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  function pushLongWord(word) {
    let chunk = "";
    for (const char of word) {
      const next = chunk + char;
      if (chunk && ctx.measureText(next).width > maxWidth) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = next;
      }
    }
    if (chunk) current = chunk;
  }

  for (const word of words) {
    if (!current) {
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
      } else {
        pushLongWord(word);
      }
      continue;
    }
    const next = `${current} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = "";
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
      } else {
        pushLongWord(word);
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

/**
 * Ajusta o nome comercial: reduz a fonte até caber em maxLines (sem reticências).
 * Em casos extremos (nome enorme), mantém minSize e força o máximo de linhas.
 */
function fitWrappedName(ctx, text, maxWidth, maxLines, startSize, minSize, s) {
  const family = "Arial, Helvetica, sans-serif";
  let size = startSize;
  while (size >= minSize - 0.001) {
    ctx.font = `bold ${fontPx(s, size)} ${family}`;
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length <= maxLines) {
      return { lines, size };
    }
    size = Math.round((size - 0.12) * 100) / 100;
  }

  ctx.font = `bold ${fontPx(s, minSize)} ${family}`;
  const lines = wrapText(ctx, text, maxWidth);
  if (lines.length <= maxLines) return { lines, size: minSize };

  // Último recurso: junta o restante na última linha e encurta só se ainda não couber
  const kept = lines.slice(0, maxLines - 1);
  const rest = lines.slice(maxLines - 1).join(" ");
  kept.push(fitText(ctx, rest, maxWidth));
  return { lines: kept, size: minSize };
}

/** Remove anti-aliasing (cinzas) — causa do texto “tremido” na Zebra. */
function thresholdToBw(ctx, width, height, cutoff = 150) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const v = gray < cutoff ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

export function chunkPairs(items) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

function fontPx(s, size) {
  return `${Math.max(8, Math.round(size * s))}px`;
}

let logoPromise = null;

/** Carrega /logo.svg (cache). */
export function loadLabelLogo() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = "/logo.svg";
    });
  }
  return logoPromise;
}

function drawLogoInverted(ctx, logo, x, y, size) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  const is = Math.max(1, Math.round(size));

  // Fundo branco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(ix, iy, is, is);

  if (!logo) {
    // Fallback: marca preta no fundo branco
    ctx.fillStyle = "#000000";
    const p = Math.max(2, Math.round(is * 0.22));
    ctx.fillRect(ix + p, iy + p, Math.round(is * 0.22), is - p * 2);
    ctx.fillRect(ix + p, iy + p, is - p * 2, Math.round(is * 0.18));
    ctx.fillRect(ix + p, iy + Math.round(is * 0.42), Math.round(is * 0.55), Math.round(is * 0.16));
    return;
  }

  // Desenha o SVG e transforma a marca escura em preto no fundo branco
  const tmp = document.createElement("canvas");
  tmp.width = is;
  tmp.height = is;
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  tctx.fillStyle = "#0481A3";
  tctx.fillRect(0, 0, is, is);
  tctx.drawImage(logo, 0, 0, is, is);

  const imageData = tctx.getImageData(0, 0, is, is);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Marca original quase preta (#05061A); fundo teal (#0481A3) tem G/B altos
    const isMark = g < 90 && b < 110 && r + g + b < 220;
    if (isMark) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    } else {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  tctx.putImageData(imageData, 0, 0);
  ctx.drawImage(tmp, ix, iy);
}

/** Desenha UMA etiqueta 4,95×2,5 cm (orientação normal de leitura). */
export function drawModelo2Label(ctx, product, width = LABEL_02_PX.width, height = LABEL_02_PX.height, logo = null) {
  const mmW = LABEL_02_CM.width * 10; // 49.5 mm
  const mmH = LABEL_02_CM.height * 10; // 25 mm
  const s = width / mmW;
  const cx = mmW / 2;
  // Margem superior maior: impressão física vinha cortando EAN/Serial no topo
  const topPad = 2.8;
  const bottomPad = 0.85;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  drawLogoInverted(ctx, logo, 1.0 * s, (0.85 + topPad) * s, 4.3 * s);

  ctx.fillStyle = "#000000";
  ctx.font = `bold ${fontPx(s, 2.5)} Tahoma, Geneva, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(fitText(ctx, `EAN:${product.ean || "—"}`, 29 * s), Math.round(5.7 * s), Math.round((2.9 + topPad) * s));
  // Negrito + tamanho maior: traço fino some no limiar P/B da térmica e fica borrado
  ctx.font = `bold ${fontPx(s, 2.3)} Tahoma, Geneva, sans-serif`;
  ctx.fillText(fitText(ctx, product.supplierModelCode || "—", 29 * s), Math.round(5.7 * s), Math.round((5.05 + topPad) * s));

  ctx.font = `bold ${fontPx(s, 2.75)} Arial, Helvetica, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(fitText(ctx, product.serialOnyx || "—", 19 * s), Math.round((mmW - 1.1) * s), Math.round((3.55 + topPad) * s));

  const name = productName(product);
  const nameMaxWidth = (mmW - 2.4) * s;
  const { lines: nameLines, size: nameSize } = fitWrappedName(
    ctx,
    name,
    nameMaxWidth,
    2,
    2.2,
    1.4,
    s,
  );

  ctx.textAlign = "center";
  ctx.fillStyle = "#000000";
  ctx.font = `bold ${fontPx(s, nameSize)} Arial, Helvetica, sans-serif`;

  const nameLineHeight = nameSize * 1.05;
  const blockHeight = nameLines.length * nameLineHeight;
  const areaTop = 7.35 + topPad;
  const priceTop = mmH - bottomPad - 8.35;
  const areaBottom = priceTop - 0.45;
  let nameStartY = areaTop + nameLineHeight * 0.82;
  const maxStart = areaBottom - blockHeight + nameLineHeight * 0.8;
  if (nameStartY > maxStart) nameStartY = Math.max(areaTop * 0.95, maxStart);

  nameLines.forEach((line, index) => {
    ctx.fillText(line, Math.round(cx * s), Math.round((nameStartY + index * nameLineHeight) * s));
  });

  const priceBoxH = 5.55;
  ctx.fillStyle = "#000000";
  ctx.fillRect(Math.round(1.0 * s), Math.round(priceTop * s), Math.round((mmW - 2.0) * s), Math.round(priceBoxH * s));

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fontPx(s, 1.6)} Arial, Helvetica, sans-serif`;
  ctx.fillText("DESCONTO", Math.round(cx * s), Math.round((priceTop + 2.0) * s));

  ctx.font = `bold ${fontPx(s, 2.75)} Arial, Helvetica, sans-serif`;
  ctx.fillText(
    fitText(ctx, `A VISTA ${formatCurrency(product.cashPrice)}`, (mmW - 3.2) * s),
    Math.round(cx * s),
    Math.round((priceTop + 4.85) * s),
  );

  ctx.fillStyle = "#000000";
  ctx.font = `bold ${fontPx(s, 2.25)} Arial, Helvetica, sans-serif`;
  ctx.fillText(
    fitText(ctx, `VALOR: ${formatCurrency(product.installmentPrice)}`, (mmW - 2.8) * s),
    Math.round(cx * s),
    Math.round((mmH - bottomPad) * s),
  );

  ctx.restore();

  thresholdToBw(ctx, width, height, 150);
}

/** Uma linha do rolo: 2 etiquetas + gap 0,4 cm → 10,3 × 2,5 cm */
export async function renderModelo2RowDataUrl(productsInRow, logo = null) {
  const logoImg = logo || (await loadLabelLogo());
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_02_PX.pageWidth;
  canvas.height = LABEL_02_PX.height;
  const ctx = canvas.getContext("2d");

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < (productsInRow || []).length; index += 1) {
    const product = productsInRow[index];
    if (!product || index > 1) continue;
    const offscreen = document.createElement("canvas");
    offscreen.width = LABEL_02_PX.width;
    offscreen.height = LABEL_02_PX.height;
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
    drawModelo2Label(offCtx, product, LABEL_02_PX.width, LABEL_02_PX.height, logoImg);
    const x = index === 0 ? 0 : LABEL_02_PX.width + LABEL_02_PX.gap;
    ctx.drawImage(offscreen, x, 0);
  }

  return canvas.toDataURL("image/png");
}

export async function buildModelo2PrintHtml(products) {
  const rows = chunkPairs(products || []);
  const logo = await loadLabelLogo();
  const images = [];
  for (const row of rows) {
    images.push(await renderModelo2RowDataUrl(row, logo));
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiquetas Modelo 02</title>
  <style>
    @page {
      size: ${LABEL_02_CM.pageWidth}cm ${LABEL_02_CM.height}cm;
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: ${LABEL_02_CM.pageWidth}cm;
      background: #fff;
    }
    * { box-sizing: border-box; }
    .row {
      width: ${LABEL_02_CM.pageWidth}cm;
      height: ${LABEL_02_CM.height}cm;
      margin: 0;
      padding: 0;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .row:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .row img {
      display: block;
      width: ${LABEL_02_CM.pageWidth}cm;
      height: ${LABEL_02_CM.height}cm;
      max-width: none;
      max-height: none;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      -ms-interpolation-mode: nearest-neighbor;
    }
  </style>
</head>
<body>
  ${images.map((src) => `<div class="row"><img src="${src}" alt="" /></div>`).join("")}
</body>
</html>`;
}

/** Imprime via iframe oculto — 2 etiquetas por página (10,3 × 2,5 cm). */
export async function printModelo2Labels(products) {
  const html = await buildModelo2PrintHtml(products);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    throw new Error("Não foi possível preparar a impressão.");
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      cleanup();
    }
  };

  const imgs = Array.from(frameDoc.images || []);
  if (!imgs.length) {
    triggerPrint();
    return;
  }

  let pending = imgs.length;
  const done = () => {
    pending -= 1;
    if (pending <= 0) triggerPrint();
  };

  imgs.forEach((img) => {
    if (img.complete) done();
    else {
      img.onload = done;
      img.onerror = done;
    }
  });

  setTimeout(() => triggerPrint(), 1500);
}

export { productName, capacityLine };
