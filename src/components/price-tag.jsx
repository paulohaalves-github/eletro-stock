import { formatCurrency, formatDate } from "@/lib/format";
import { LABEL_MODELS, resolveLabelModel } from "@/lib/constants";

/** Rolo modelo 02: 2 etiquetas por linha (50 + 3 + 50) × 25 mm */
export const LABEL_02 = {
  widthMm: 50,
  heightMm: 25,
  gapMm: 3,
  get pageWidthMm() {
    return this.widthMm * 2 + this.gapMm;
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

function chunkPairs(items) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

function svgText(value, max = 42) {
  const text = String(value || "—");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function PriceTag({ product, printedAt }) {
  const name = productName(product);

  return (
    <article className="price-tag price-tag--modelo-1">
      <div className="price-tag-body">
        <header className="price-tag-header">
          <div className="price-tag-id">
            <img src="/logo.svg" alt="Eletromall" className="price-tag-logo" />
            <div>
              <p>MODELO: {product.supplierModelCode || "—"}</p>
              <p>EAN: {product.ean || "—"}</p>
            </div>
          </div>
          <div className="price-tag-meta">
            <p className="price-tag-serial">{product.serialOnyx || "—"}</p>
            <p className="price-tag-date">{formatDate(printedAt)}</p>
          </div>
        </header>
        <div className="price-tag-name-wrap">
          <h1 className="price-tag-name">{name}</h1>
        </div>
        <div className="price-tag-prices">
          <p className="price-tag-market">MÉDIA DE PREÇO: {formatCurrency(product.marketPrice)}</p>
          <p className="price-tag-installment">VALOR: {formatCurrency(product.installmentPrice)}</p>
        </div>
      </div>
      <footer className="price-tag-cash">
        <span className="price-tag-discount">DESCONTO</span>
        <span className="price-tag-avista">À VISTA: {formatCurrency(product.cashPrice)}</span>
      </footer>
    </article>
  );
}

/** Etiqueta 50×25 mm em SVG — rotação 180° dentro do viewBox (estável na impressão térmica). */
export function PriceTagCompact({ product }) {
  const name = svgText(productName(product), 36);
  const capacity = capacityLine(product);
  const ean = svgText(`EAN:${product.ean || "—"}`, 22);
  const model = svgText(product.supplierModelCode || "—", 22);
  const serial = svgText(product.serialOnyx || "—", 14);
  const cash = svgText(`A VISTA ${formatCurrency(product.cashPrice)}`, 28);
  const valor = svgText(`VALOR: ${formatCurrency(product.installmentPrice)}`, 28);

  return (
    <svg
      className="price-tag price-tag--modelo-2"
      width={`${LABEL_02.widthMm}mm`}
      height={`${LABEL_02.heightMm}mm`}
      viewBox="0 0 50 25"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={name}
    >
      <rect width="50" height="25" fill="#fff" />
      {/* Conteúdo girado 180° em torno do centro da etiqueta */}
      <g transform="rotate(180 25 12.5)">
        {/* Logo marca */}
        <rect x="1.2" y="1.1" width="4" height="4" fill="#111" />
        <text x="6" y="2.55" fontFamily="Arial, Helvetica, sans-serif" fontSize="1.55" fontWeight="700" fill="#111">
          {ean}
        </text>
        <text x="6" y="4.45" fontFamily="Arial, Helvetica, sans-serif" fontSize="1.55" fontWeight="700" fill="#111">
          {model}
        </text>
        <text
          x="48.8"
          y="3.3"
          textAnchor="end"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="1.9"
          fontWeight="800"
          fill="#111"
        >
          {serial}
        </text>

        <text
          x="25"
          y={capacity ? "9.2" : "10.2"}
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="2.55"
          fontWeight="800"
          fill="#111"
        >
          {name}
        </text>
        {capacity ? (
          <text
            x="25"
            y="11.6"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="1.9"
            fontWeight="700"
            fill="#111"
          >
            {svgText(capacity, 28)}
          </text>
        ) : null}

        <rect x="1.2" y="13.4" width="47.6" height="6.2" fill="#111" />
        <text
          x="25"
          y="15.55"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="1.35"
          fontWeight="800"
          fill="#fff"
          letterSpacing="0.12"
        >
          DESCONTO
        </text>
        <text
          x="25"
          y="18.55"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="2.7"
          fontWeight="800"
          fill="#fff"
        >
          {cash}
        </text>

        <text
          x="25"
          y="22.8"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="1.85"
          fontWeight="700"
          fill="#111"
        >
          {valor}
        </text>
      </g>
    </svg>
  );
}

export function PriceTagSheet({ products, printedAt, model }) {
  const resolved = resolveLabelModel(model);
  const isCompact = resolved === LABEL_MODELS.PRECOS_02;

  if (!isCompact) {
    return (
      <div className="price-tag-sheet price-tag-sheet--modelo-1" data-modelo={resolved}>
        <style>{`
          @media print {
            @page { size: 90mm 45mm; margin: 0; }
            html, body { margin: 0 !important; padding: 0 !important; }
          }
        `}</style>
        {products.map((product) => (
          <PriceTag key={product.id} product={product} printedAt={printedAt} />
        ))}
      </div>
    );
  }

  const rows = chunkPairs(products);

  return (
    <div className="price-tag-sheet price-tag-sheet--modelo-2" data-modelo={resolved}>
      <style>{`
        @media print {
          @page {
            size: ${LABEL_02.pageWidthMm}mm ${LABEL_02.heightMm}mm;
            margin: 0;
          }
          html, body {
            width: ${LABEL_02.pageWidthMm}mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
      {rows.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className="price-tag-row">
          {row.map((product) => (
            <PriceTagCompact key={product.id} product={product} />
          ))}
          {row.length === 1 ? (
            <svg
              className="price-tag price-tag--modelo-2 price-tag--empty"
              width={`${LABEL_02.widthMm}mm`}
              height={`${LABEL_02.heightMm}mm`}
              viewBox="0 0 50 25"
              aria-hidden="true"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
