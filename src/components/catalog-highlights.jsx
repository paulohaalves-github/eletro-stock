"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard, Package, ShieldCheck, Star, Wrench } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Star, title: "4,9/5 no Google", detail: "(880 avaliações)" },
  { icon: ShieldCheck, title: "180 dias de garantia própria" },
  { icon: Wrench, title: "Parceria com assistência autorizada Samsung" },
  { icon: Package, title: "Pronta-entrega: retire na loja" },
  { icon: CreditCard, title: "5% de desconto no Pix" },
];

export function CatalogHighlights() {
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    function update() {
      setEdges({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  function scrollBy(direction) {
    scroller.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  }

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-[#0b1220] text-white">
      <div className="relative mx-auto max-w-6xl">
        {edges.left ? (
          <button
            type="button"
            aria-label="Destaques anteriores"
            onClick={() => scrollBy(-1)}
            className="absolute top-1/2 left-2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div
          ref={scroller}
          className="flex gap-8 overflow-x-auto scroll-smooth px-12 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex min-w-56 shrink-0 items-center gap-3 lg:min-w-0 lg:flex-1">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#f5c451] ring-1 ring-[#f5c451]/30">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <p className="text-sm font-medium leading-snug">
                  {item.title}
                  {item.detail ? <span className="mt-0.5 block text-xs font-normal text-white/70">{item.detail}</span> : null}
                </p>
              </div>
            );
          })}
        </div>
        {edges.right ? (
          <button
            type="button"
            aria-label="Próximos destaques"
            onClick={() => scrollBy(1)}
            className="absolute top-1/2 right-2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
