import { getFormatter } from "next-intl/server";

import { Picture } from "@/components/ui/picture";
import { Link } from "@/i18n/navigation";
import type { PublicNewsSummary } from "@/lib/public/news";

/**
 * An article in a list (reference pyzhevsky-pages.md §3 `/news`): the cover
 * at 440 × 240, the date as a caps label and the title; the whole card is
 * the title's link. A cover is real data, so an article without one shows
 * none rather than a stand-in.
 */
export async function NewsCard({
  article,
  titleAs: Title = "h2",
}: {
  article: PublicNewsSummary;
  titleAs?: "h2" | "h3";
}) {
  const format = await getFormatter();
  return (
    <article className="group relative flex flex-col gap-u">
      {article.cover && (
        <div className="relative order-first aspect-[440/240] overflow-hidden bg-(--t-line)">
          <Picture
            image={article.cover}
            sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 50vw, 100vw"
          />
        </div>
      )}
      <Title
        className="order-2 text-body"
        lang={article.title.fallback ? article.title.locale : undefined}
      >
        <Link
          href={{ pathname: "/xeberler/[slug]", params: { slug: article.slug } }}
          className="underline-offset-4 group-hover:underline after:absolute after:inset-0"
        >
          {article.title.value}
        </Link>
      </Title>
      <time
        dateTime={article.publishedAt}
        className="order-1 text-label text-(--t-small) uppercase"
      >
        {format.dateTime(new Date(article.publishedAt), "long")}
      </time>
      {article.excerpt && (
        <p
          className="order-3 line-clamp-3 text-small-t text-(--t-small)"
          lang={article.excerpt.fallback ? article.excerpt.locale : undefined}
        >
          {article.excerpt.value}
        </p>
      )}
    </article>
  );
}
