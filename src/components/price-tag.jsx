import { formatCurrency, formatDate } from "@/lib/format";
import { LABEL_MODELS, resolveLabelModel } from "@/lib/constants";

/** Rolo modelo 02: 2 etiquetas por linha (50mm + 3mm + 50mm) × 25mm */
const LABEL_02_WIDTH_MM = 50;
const LABEL_02_HEIGHT_MM = 25;
const LABEL_02_GAP_MM = 3;
const LABEL_02_PAGE_WIDTH_MM = LABEL_02_WIDTH_MM * 2 + LABEL_02_GAP_MM;

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

export function PriceTagCompact({ product }) {
  const name = productName(product);
  const capacity = capacityLine(product);

  return (
    <article className="price-tag price-tag--modelo-2">
      <div className="price-tag-m2-inner">
        <header className="price-tag-m2-header">
          <div className="price-tag-m2-id">
            <img src="/logo.svg" alt="Eletromall" className="price-tag-m2-logo" />
            <div>
              <p>EAN:{product.ean || "—"}</p>
              <p>{product.supplierModelCode || "—"}</p>
            </div>
          </div>
          <p className="price-tag-m2-serial">{product.serialOnyx || "—"}</p>
        </header>

        <div className="price-tag-m2-product">
          <h1>{name}</h1>
          {capacity ? <p>{capacity}</p> : null}
        </div>

        <div className="price-tag-m2-cash">
          <span className="price-tag-m2-discount">DESCONTO</span>
          <span className="price-tag-m2-avista">A VISTA {formatCurrency(product.cashPrice)}</span>
        </div>

        <p className="price-tag-m2-valor">VALOR: {formatCurrency(product.installmentPrice)}</p>
      </div>
    </article>
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
            @page {
              size: 90mm 45mm;
              margin: 0;
            }
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
            size: ${LABEL_02_PAGE_WIDTH_MM}mm ${LABEL_02_HEIGHT_MM}mm;
            margin: 0;
          }
        }
      `}</style>
      {rows.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className="price-tag-row">
          {row.map((product) => (
            <PriceTagCompact key={product.id} product={product} />
          ))}
          {row.length === 1 ? <div className="price-tag price-tag--modelo-2 price-tag--empty" aria-hidden="true" /> : null}
        </div>
      ))}
    </div>
  );
}
