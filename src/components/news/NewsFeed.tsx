import { useEffect, useState } from "react";
import { RefreshCw, Radio, TrendingUp } from "lucide-react";
import { getNewsPage, type NewsItem } from "@/lib/news-data";
import { SmartNewsImage } from "./SmartNewsImage";

type HybridNewsItem = NewsItem & {
  score?: number;
  sourceCount?: number;
  trendBoost?: boolean;
  trendMatches?: string[];
};

type HybridResponse = {
  ok?: boolean;
  generatedAt?: string | null;
  items?: HybridNewsItem[];
};

function formatGeneratedAt(value: string | null) {
  if (!value) return "Conteudo local";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function itemHref(item: HybridNewsItem) {
  return item.timeAgo === "Radar ao vivo" ? item.sourceUrl : `/noticia/${item.slug}`;
}

function sourceCount(item: HybridNewsItem) {
  return item.sourceCount || item.sources?.length || 1;
}

export function NewsFeed() {
  const [items, setItems] = useState<HybridNewsItem[]>(() => getNewsPage(0));
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"static" | "live" | "loading">("static");

  async function loadHybridFeed() {
    setLiveStatus((status) => (status === "live" ? "live" : "loading"));
    try {
      const response = await fetch("/api/news");
      if (!response.ok) throw new Error("API indisponivel");
      const data = (await response.json()) as HybridResponse;
      if (!data.items?.length) {
        setLiveStatus("static");
        return;
      }
      setItems(data.items);
      setGeneratedAt(data.generatedAt ?? null);
      setLiveStatus("live");
    } catch {
      setLiveStatus("static");
    }
  }

  async function refreshHybridFeed() {
    setLiveStatus("loading");
    try {
      const response = await fetch("/api/refresh", { method: "POST" });
      if (!response.ok) throw new Error("Refresh indisponivel");
      const data = (await response.json()) as HybridResponse;
      if (data.items?.length) {
        setItems(data.items);
        setGeneratedAt(data.generatedAt ?? new Date().toISOString());
        setLiveStatus("live");
      }
    } catch {
      setLiveStatus("static");
    }
  }

  useEffect(() => {
    void loadHybridFeed();
  }, []);

  const lead = items[0];
  const secondary = items.slice(1);

  return (
    <div className="mx-auto w-full max-w-[1120px] bg-background md:bg-[#f7f4ee]">
      <section className="border-b border-border bg-background px-4 py-4 md:border-neutral-300 md:bg-[#f7f4ee] md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground md:text-neutral-600">
            <span className="inline-flex items-center gap-2 bg-primary px-3 py-1.5 text-primary-foreground">
              <Radio className="h-3.5 w-3.5" />
              {liveStatus === "live" ? "Radar ao vivo" : "BuzzPop local"}
            </span>
            <span>{formatGeneratedAt(generatedAt)}</span>
            <span>{items.length} destaques</span>
          </div>
          <button
            type="button"
            onClick={() => void refreshHybridFeed()}
            disabled={liveStatus === "loading"}
            className="inline-flex h-10 items-center justify-center gap-2 border border-border px-4 text-xs font-black uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary disabled:opacity-60 md:border-neutral-300 md:text-neutral-950 md:hover:bg-neutral-200"
          >
            <RefreshCw className={`h-4 w-4 ${liveStatus === "loading" ? "animate-spin" : ""}`} />
            Atualizar radar
          </button>
        </div>
      </section>

      {lead ? (
        <section className="grid gap-0 border-b border-border md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] md:border-neutral-300">
          <a
            href={itemHref(lead)}
            target={lead.timeAgo === "Radar ao vivo" ? "_blank" : undefined}
            rel={lead.timeAgo === "Radar ao vivo" ? "noreferrer" : undefined}
            className="group flex min-w-0 flex-col justify-center px-4 py-8 md:px-6 md:py-12"
          >
            <p className="mb-4 inline-flex w-fit bg-primary px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-primary-foreground">
              {lead.category}
            </p>
            <h1 className="max-w-[760px] break-words font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-[clamp(2.6rem,10vw,6.2rem)] font-black uppercase leading-[0.88] tracking-normal text-foreground [overflow-wrap:anywhere] group-hover:text-primary md:text-neutral-950">
              {lead.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg md:text-neutral-700">
              {lead.excerpt}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground md:text-neutral-600">
              <span className="border border-border px-2.5 py-1 md:border-neutral-300">
                {sourceCount(lead)} fontes
              </span>
              {lead.score ? (
                <span className="border border-border px-2.5 py-1 md:border-neutral-300">
                  Forca {lead.score}
                </span>
              ) : null}
              {lead.trendBoost ? (
                <span className="inline-flex items-center gap-1 bg-primary px-2.5 py-1 text-primary-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Trends
                </span>
              ) : null}
            </div>
          </a>
          <figure className="px-4 pb-8 md:px-6 md:py-12">
            <div className="aspect-[4/5] overflow-hidden bg-secondary md:bg-neutral-200">
              <SmartNewsImage
                src={lead.image}
                alt={lead.title}
                width={1024}
                height={1280}
                loading="eager"
                objectPosition={lead.imagePosition}
                fit={lead.imageFit}
                className="h-full w-full object-cover"
              />
            </div>
            <figcaption className="pt-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground md:text-neutral-500">
              {lead.imageCredit}
            </figcaption>
          </figure>
        </section>
      ) : null}

      <section className="grid gap-0 md:grid-cols-2">
        {secondary.map((item, index) => (
          <a
            key={item.id}
            href={itemHref(item)}
            target={item.timeAgo === "Radar ao vivo" ? "_blank" : undefined}
            rel={item.timeAgo === "Radar ao vivo" ? "noreferrer" : undefined}
            className="group grid min-w-0 grid-cols-[112px_minmax(0,1fr)] gap-4 border-b border-border px-4 py-5 md:grid-cols-[150px_minmax(0,1fr)] md:border-neutral-300 md:px-6 md:py-6 odd:md:border-r"
          >
            <div className="aspect-[4/5] overflow-hidden bg-secondary md:bg-neutral-200">
              <SmartNewsImage
                src={item.image}
                alt={item.title}
                width={600}
                height={750}
                loading={index < 2 ? "eager" : "lazy"}
                objectPosition={item.imagePosition}
                fit={item.imageFit}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                {item.category}
              </p>
              <h2 className="break-words text-xl font-black uppercase leading-tight text-foreground [overflow-wrap:anywhere] group-hover:text-primary md:text-2xl md:text-neutral-950">
                {item.title}
              </h2>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground md:text-neutral-700">
                {item.excerpt}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground md:text-neutral-600">
                <span>{sourceCount(item)} fontes</span>
                {item.trendBoost ? <span>Google Trends</span> : null}
              </div>
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}
