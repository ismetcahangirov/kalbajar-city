import { getTranslations } from "next-intl/server";

import { preloaderScript } from "@/lib/shell/preloader";

import { PreloaderDriver } from "./preloader-driver";

/**
 * The home page's preloader (motion-system.md → Chrome; reference
 * pyzhevsky-pages.md §1.1): the curtain rising with the progress behind two
 * grid lines, "YÜKLƏNİR" left and the percentage right. It shows only on the
 * first visit in a session with motion allowed, decided by the inline
 * script before the first paint; without script it never shows. The page
 * under it is server-rendered in its final state, so the LCP image is
 * requested and painted as usual underneath. See src/lib/shell/preloader.ts
 * for the hand-off to the hero intro.
 */
export async function Preloader() {
  const t = await getTranslations("Shell");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: preloaderScript }} />
      <div
        role="region"
        aria-label={t("loading")}
        data-preloader-overlay=""
        data-theme="dark"
        className="fixed inset-0 z-[70] overflow-hidden bg-ink"
      >
        <Lines className="opacity-40" />
        <div
          data-preloader-bg=""
          className="absolute inset-x-0 -top-[5svh] h-[105svh] bg-(image:--gradient-curtain)"
        >
          <Lines />
        </div>
        <div className="absolute inset-x-layout top-1/2 -mt-[0.5em] flex justify-between text-label text-(--t-small) uppercase">
          <span>{t("loading")}</span>
          <span data-preloader-count="" aria-hidden="true">
            0%
          </span>
        </div>
      </div>
      <PreloaderDriver />
    </>
  );
}

function Lines({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`absolute inset-0 ${className ?? ""}`}>
      {[100 / 3, 200 / 3].map((left, i) => (
        <span
          key={left}
          className={`absolute inset-y-0 w-(--grid-line-width) bg-(--t-line) ${i > 0 ? "hidden desk:block" : ""}`}
          style={{ left: `${left}%` }}
        />
      ))}
    </div>
  );
}
