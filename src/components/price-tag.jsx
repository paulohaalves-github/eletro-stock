import { formatCurrency, formatDate } from "@/lib/format";
import { LABEL_MODELS, resolveLabelModel } from "@/lib/constants";

function productName(product) {
  return String(product.commercialName || product.supplierModelCode || product.category?.name || "Produto")
    .trim()
    .toUpperCase();
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

export function PriceTagSheet({ products, printedAt, model }) {
  const resolved = resolveLabelModel(model);

  if (resolved === LABEL_MODELS.PRECOS_02) {
    return null;
  }

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

/** Campos mínimos para o Modelo 02 (serializável no client). */
export function toModelo2Product(product) {
  return {
    id: product.id,
    commercialName: product.commercialName || null,
    supplierModelCode: product.supplierModelCode || null,
    capacitySizeType: product.capacitySizeType || null,
    ean: product.ean || null,
    serialOnyx: product.serialOnyx || null,
    cashPrice: Number(product.cashPrice ?? 0),
    installmentPrice: Number(product.installmentPrice ?? 0),
    category: product.category ? { name: product.category.name || null } : null,
  };
}
