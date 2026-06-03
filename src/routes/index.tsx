import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/nav/SiteNav";
import { NewsFeed } from "@/components/news/NewsFeed";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background md:bg-[#f7f4ee]">
      <SiteNav />
      <main>
        <NewsFeed />
      </main>
    </div>
  );
}
