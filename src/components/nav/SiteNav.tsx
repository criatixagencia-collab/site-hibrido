import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";

const CATEGORIES = [
  { label: "News", to: "/" },
  { label: "Celebridades", to: "/" },
  { label: "Música", to: "/" },
  { label: "TV", to: "/" },
  { label: "Cinema", to: "/" },
  { label: "Fotos", to: "/" },
];

function BrandLogo() {
  return (
    <svg viewBox="0 0 320 72" className="w-auto h-10 md:h-[48px]" aria-label="BuzzPop Brasil">
      <text x="2" y="44" fontFamily="Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif" fontSize="46" fontWeight="900" fill="#000" letterSpacing="2">BUZZ</text>
      <text x="168" y="44" fontFamily="Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif" fontSize="46" fontWeight="900" fill="#cc0000" letterSpacing="2">POP</text>
      <text x="85" y="66" fontFamily="Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif" fontSize="18" fontWeight="900" fill="#000" letterSpacing="3.5">BRASIL</text>
    </svg>
  );
}

export function SiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-300 bg-[#f7f4ee] text-neutral-950">
      <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between px-3 md:h-20 md:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="inline-flex h-11 w-11 items-center justify-center hover:bg-neutral-200 md:hidden"
        >
          <Menu className="h-7 w-7" />
        </button>

        <Link to="/" aria-label="BuzzPop Brasil">
          <BrandLogo />
        </Link>

        <nav aria-label="Categorias" className="hidden md:block">
          <ul className="flex items-center gap-5">
            {CATEGORIES.map((cat) => (
              <li key={cat.label}>
                <Link
                  to={cat.to}
                  className="text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent"
                >
                  {cat.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          aria-label="Buscar"
          className="inline-flex h-11 w-11 items-center justify-center hover:bg-neutral-200"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      <div className="border-t border-neutral-300 md:hidden">
        <ul className="flex gap-1 overflow-x-auto px-2 py-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <li key={cat.label} className="shrink-0">
              <Link
                to={cat.to}
                className="block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide hover:text-nav-accent"
              >
                {cat.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={`fixed inset-0 z-[60] md:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/70 transition-opacity duration-250 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        <aside
          className={`absolute left-0 top-0 h-full w-[84%] max-w-sm bg-[#f7f4ee] text-neutral-950 shadow-2xl transition-transform duration-250 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-neutral-300 px-4">
            <BrandLogo />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="inline-flex h-11 w-11 items-center justify-center hover:bg-neutral-200"
            >
              <X className="h-7 w-7" />
            </button>
          </div>
          <ul className="flex flex-col">
            {CATEGORIES.map((cat) => (
              <li key={cat.label}>
                <Link
                  to={cat.to}
                  onClick={() => setOpen(false)}
                  className="flex h-14 items-center border-b border-neutral-300 px-5 text-base font-black uppercase tracking-wide hover:bg-neutral-200 hover:text-nav-accent"
                >
                  {cat.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </header>
  );
}
