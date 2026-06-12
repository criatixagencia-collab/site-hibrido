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
    <span className="block h-12 w-[146px] overflow-hidden leading-none md:h-[58px] md:w-[176px]">
      <picture>
        <source media="(min-width: 768px)" srcSet="/images/buzzpop-logo-desktop.png" />
        <img
          src="/images/buzzpop-logo-compact.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-center"
        />
      </picture>
    </span>
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
    <header className="sticky top-0 z-50 w-full border-b border-nav-border bg-nav text-nav-foreground md:border-neutral-300 md:bg-[#f7f4ee] md:text-neutral-950">
      <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between px-3 md:h-20 md:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="inline-flex h-11 w-11 items-center justify-center hover:bg-nav-hover md:hidden"
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
          className="inline-flex h-11 w-11 items-center justify-center hover:bg-nav-hover md:hover:bg-neutral-200"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      <div className="border-t border-nav-border md:hidden">
        <ul className="flex gap-1 overflow-x-auto px-2 py-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <li key={cat.label} className="shrink-0">
              <Link
                to={cat.to}
                className="block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide text-nav-foreground hover:text-nav-accent"
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
          className={`absolute left-0 top-0 h-full w-[84%] max-w-sm bg-nav text-nav-foreground shadow-2xl transition-transform duration-250 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-nav-border px-4">
            <BrandLogo />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="inline-flex h-11 w-11 items-center justify-center hover:bg-nav-hover"
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
                  className="flex h-14 items-center border-b border-nav-border px-5 text-base font-black uppercase tracking-wide hover:bg-nav-hover hover:text-nav-accent"
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
