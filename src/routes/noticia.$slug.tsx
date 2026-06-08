import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { SmartNewsImage } from "@/components/news/SmartNewsImage";
import { getNewsItem, getNewsSources } from "@/lib/news-data";

export const Route = createFileRoute("/noticia/$slug")({
  loader: ({ params }) => {
    const item = getNewsItem(params.slug);
    if (!item) throw notFound();
    return { item };
  },
  component: NewsArticle,
});

function NewsArticle() {
  const { item } = Route.useLoaderData();
  const sources = getNewsSources(item);

  return (
    <main className="mx-auto max-w-[980px] bg-background pb-16 md:bg-[#f7f4ee]">
      <div className="px-4 pb-8 pt-6 md:px-6 md:pt-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <article>
        <header className="px-4 text-center md:px-6">
          <p className="mb-4 inline-flex bg-primary px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary-foreground">
            {item.category}
          </p>
          <h1 className="mx-auto max-w-[12ch] font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-[clamp(3.2rem,14vw,8rem)] font-black uppercase leading-[0.82] tracking-normal text-foreground md:text-neutral-950">
            {item.title}
          </h1>
          <div className="mx-auto mt-7 max-w-2xl space-y-2 text-sm uppercase tracking-[0.16em] text-muted-foreground md:text-base md:text-neutral-500">
            <p>
              By <span className="font-bold text-primary">BuzzPop Staff</span>
            </p>
            <p>{item.publishedAt}</p>
            {item.updatedAt ? <p>{item.updatedAt}</p> : null}
            <p>{sources.length > 1 ? `${sources.length} fontes consultadas` : item.sourceLabel}</p>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-lg font-bold text-primary">
            <MessageCircle
              aria-hidden
              className="h-5 w-5 text-muted-foreground md:text-neutral-500"
            />{" "}
            Comentários
          </div>
        </header>

        <figure className="mt-10">
          <div className="relative bg-secondary md:aspect-auto md:bg-transparent md:overflow-visible">
            <SmartNewsImage
              src={item.image}
              alt={item.title}
              width={1400}
              height={900}
              objectPosition={item.articleImagePosition ?? item.imagePosition}
              fit={item.articleImageFit ?? item.imageFit}
            />
          </div>
          <figcaption className="px-4 pt-3 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:px-6 md:text-neutral-500">
            {item.imageCredit}
          </figcaption>
        </figure>

        <div className="mx-auto mt-10 max-w-2xl px-4 md:px-6">
          <p className="text-xl font-bold leading-snug text-foreground md:text-2xl md:text-neutral-950">
            {item.excerpt}
          </p>
          <div className="mt-8 space-y-6 text-lg leading-8 text-foreground/88 md:text-neutral-800">
            {item.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-10 border-t border-border pt-6 text-sm uppercase tracking-[0.14em] text-muted-foreground md:border-neutral-300 md:text-neutral-500">
            <p>{item.rankLabel}</p>
            <div className="mt-3 space-y-2">
              <p>{sources.length > 1 ? "Fontes consultadas" : "Fonte consultada"}</p>
              <ul className="space-y-2 normal-case tracking-normal">
                {sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
