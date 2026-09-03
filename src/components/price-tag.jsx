import { formatCurrency, formatDate } from "@/lib/format";

export function PriceTag({ product, printedAt }) {
  const name = String(product.commercialName || product.supplierModelCode || product.category?.name || "Produto")
    .trim()
    .toUpperCase();

  return (
    <article className="price-tag">
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

export function PriceTagSheet({ products, printedAt }) {
  return (
    <div className="price-tag-sheet">
      {products.map((product) => (
        <PriceTag key={product.id} product={product} printedAt={printedAt} />
      ))}
    </div>
  );
}
