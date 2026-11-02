import { getFormatter, getLocale } from "next-intl/server";

import { Card, Picture } from "@/components/ui";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { PublicNewsSummary } from "@/lib/public/news";

/** An article in a list: cover, title (the link), date and excerpt. */
export async function NewsCard({
  article,
  titleAs = "h2",
}: {
  article: PublicNewsSummary;
  titleAs?: "h2" | "h3";
}) {
  const locale = (await getLocale()) as Locale;
  const format = await getFormatter();
  return (
    <Card
      titleAs={titleAs}
      title={article.title.value}
      href={getPathname({
        href: { pathname: "/xeberler/[slug]", params: { slug: article.slug } },
        locale,
      })}
      media={
        article.cover ? (
          <Picture
            image={article.cover}
            sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 50vw, 100vw"
          />
        ) : undefined
      }
      meta={
        <div className="flex flex-col gap-2">
          <time dateTime={article.publishedAt}>
            {format.dateTime(new Date(article.publishedAt), "long")}
          </time>
          {article.excerpt && (
            <p
              className="line-clamp-3 text-body text-text-muted"
              lang={article.excerpt.fallback ? article.excerpt.locale : undefined}
            >
              {article.excerpt.value}
            </p>
          )}
        </div>
      }
    />
  );
}
