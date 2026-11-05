import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { GridLines, type GridLinesVariant } from "@/components/motion/grid-lines";
import { HeroSnap } from "@/components/motion/hero-snap";
import { Reveal } from "@/components/motion/reveal";
import { Scene, SceneLayer } from "@/components/motion/scene";
import { Scrub } from "@/components/motion/scrub";
import { SplitWord } from "@/components/motion/split-word";
import { StatSwap } from "@/components/motion/stat-swap";
import { Threshold } from "@/components/motion/threshold";
import { Picture } from "@/components/ui/picture";
import { defaultImage, type DefaultSlot } from "@/content/defaults";
import type { Locale } from "@/i18n/routing";

import { CarouselDemo, TeaserDemo } from "./followers";

// Development playground for the scroll-scene engine and its primitives
// (#63): every primitive at a realistic size, wired as the chrome and page
// PRs (#64, #66, #68) should copy it. The ranges are the catalogue's
// (docs/motion-system.md), measured against these scenes. Like /primitivler
// it answers 404 in production unless ENABLE_PRIMITIVES=1, so its sample copy
// does not go through the message catalogues.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// The site shell reads the settings per request (#27), so no page under it is static.
export const instant = false;

/** The catalogue's clips (motion-system.md → Scenes). */
const clip = {
  heroPanel: "inset(0 0 0 66.66%)",
  heroFull: "inset(0 0 0 0%)",
  doorsClosed: "polygon(0 0,100% 0,100% 100%,50% 100%,50% 0,50% 0,50% 100%,0 100%)",
  doorsOpen: "polygon(0 0,100% 0,100% 100%,100% 100%,100% 0,0 0,0 100%,0 100%)",
  irisPoint: "inset(50svh 50% calc(100% - 50svh) 50%)",
  irisOpen: "inset(0 0 calc(100% - 100svh) 0)",
  stripClosed: "inset(0 50%)",
  open: "inset(0)",
  window: "inset(31.4% 25vw)",
} as const;

/** A caps label naming the primitive and its catalogue entry. */
function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`text-label text-(--t-small) uppercase ${className ?? ""}`}>{children}</p>;
}

function Photo({
  slot,
  locale,
  sizes = "100vw",
  className,
}: {
  slot: DefaultSlot;
  locale: Locale;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={`relative size-full ${className ?? ""}`}>
      <Picture image={defaultImage(slot, locale)} sizes={sizes} />
    </div>
  );
}

const variants: GridLinesVariant[] = ["half", "thirds", "quarters", "wider"];

export default async function MotionPlaygroundPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRIMITIVES !== "1") {
    notFound();
  }
  const locale = (await getLocale()) as Locale;

  return (
    <>
      {/* Hero (S0): the snap (A43) and the panel expand + zoom (A5) over the
          first viewport. Server state: the panel in the right third. */}
      <Scene
        theme="dark"
        length={2}
        aria-labelledby="hero-title"
        data-testid="hero"
        style={{ backgroundImage: "var(--gradient-curtain)" }}
      >
        <HeroSnap />
        <SceneLayer className="isolate">
          <GridLines variant="thirds" draw />
          <div className="flex h-full flex-col justify-center gap-u2 px-layout pt-u6 desk:w-2/3">
            <Note>#63 · Scene · useHeroSnap · Scrub (A5)</Note>
            <h1 id="hero-title" className="sr-only">
              Hərəkət
            </h1>
            <SplitWord
              word="Hərəkət"
              lang="az"
              className="text-word text-(--t-primary) uppercase"
            />
            <p className="max-w-(--container-prose) text-lead">
              Bir təkər hərəkəti səhifəni ilk ekrandan sonrakına aparır; sağdakı panel bütün ekranı
              tutur.
            </p>
          </div>
          <Scrub
            trigger="scene"
            range="0-0 → -100-0"
            easing="quadOut"
            from={{ clipPath: clip.heroPanel }}
            to={{ clipPath: clip.heroFull }}
            style={{ clipPath: clip.heroPanel }}
            data-testid="hero-panel"
            className="absolute inset-0 hidden desk:block"
            aria-hidden="true"
          >
            <div className="size-full bg-(image:--gradient-facade)">
              <Scrub
                trigger="scene"
                range="0-0 → -100-0"
                easing="quadOut"
                from={{ translate: "5.3% 0", scale: "0.77" }}
                to={{ translate: "0% 0", scale: "1" }}
                style={{ translate: "5.3% 0", scale: "0.77" }}
                className="size-full origin-[120%_100%]"
              >
                <Photo slot="home.hero.panel" locale={locale} />
              </Scrub>
            </div>
          </Scrub>
        </SceneLayer>
      </Scene>

      {/* Reveal: text by lines out of a blur (A11), image-in (A12). */}
      <section
        data-theme="light"
        aria-labelledby="reveal-title"
        className="relative isolate flex flex-col gap-u6 bg-(--t-bg) px-layout py-u12 text-(--t-text)"
      >
        <GridLines variant="thirds" draw />
        <Note>Reveal · text (A11) · on entry, once</Note>
        <Reveal
          kind="text"
          as="p"
          data-testid="reveal-text"
          className="max-w-[45rem] text-lead-lg text-(--t-primary)"
        >
          Dağların qoynunda, şəlalələrin səsində yeni ev: daş, taxta və işıq hər mənzildə bir-birini
          tamamlayır.
        </Reveal>
        <Note>Reveal · text at 90svh, reversible</Note>
        <Reveal
          kind="text"
          at="90svh"
          as="h2"
          id="reveal-title"
          className="max-w-[45rem] text-title text-(--t-heading) uppercase"
        >
          Kəlbəcər, İstisu və Şəlalə
        </Reveal>
        <div className="grid gap-u2 desk:grid-cols-3">
          <div className="flex flex-col gap-u">
            <Note>Reveal · image-in (A12)</Note>
            <Reveal kind="image-in" data-testid="reveal-image" className="aspect-[3/4] w-full">
              <Photo
                slot="home.about.image"
                locale={locale}
                sizes="(width >= 41.75rem) 33vw, 100vw"
              />
            </Reveal>
          </div>
          <p className="self-end text-body desk:col-start-3">
            Each primitive renders its final state on the server. After hydration only what is
            entirely below the viewport is hidden, so nothing a visitor already sees disappears.
          </p>
        </div>
      </section>

      {/* SplitWord spread (A14) with a panoramic window and one line at 50 %. */}
      <section
        data-theme="light"
        aria-labelledby="spread-title"
        className="relative isolate flex flex-col gap-u2 bg-(--t-bg) py-u12 text-(--t-text)"
      >
        <GridLines variant="half" draw />
        <Note className="px-layout">SplitWord · spread (A14)</Note>
        <h2 id="spread-title" className="sr-only">
          Pəncərə
        </h2>
        <SplitWord
          word="Pəncərə"
          mode="spread"
          lang="az"
          data-testid="spread"
          className="px-layout text-word text-(--t-secondary) uppercase"
        />
        <div className="mx-layout aspect-[388/100] overflow-hidden">
          <Photo slot="home.location.intro" locale={locale} />
        </div>
      </section>

      {/* Doors (A18) with the word exploding (A15), over the light content. */}
      <Scene theme="light" length={3} aria-labelledby="doors-title" data-testid="doors">
        <SceneLayer data-theme="dark" className="z-1">
          <Scrub
            trigger="scene"
            range="0-0 → -100-0"
            easing="quadIn"
            from={{ clipPath: clip.doorsClosed }}
            to={{ clipPath: clip.doorsOpen }}
            className="absolute inset-0 flex items-center"
          >
            <Photo slot="home.cardZoom.3" locale={locale} className="absolute! inset-0" />
            <SplitWord
              word="Ərazi"
              mode="explode"
              trigger="scene"
              range="0-0 → -100-0"
              lang="az"
              className="relative w-full px-layout text-word text-(--t-heading) uppercase"
            />
          </Scrub>
        </SceneLayer>
        <SceneLayer className="isolate flex flex-col items-center justify-center gap-u2 px-layout text-center">
          <GridLines variant="quarters" />
          <Note>Scrub · doors (A18) · SplitWord · explode (A15)</Note>
          <h2
            id="doors-title"
            className="max-w-(--container-prose) text-lead-lg text-(--t-primary)"
          >
            Ərazi açılır: foto ortadan bölünür, hərflər kənarlara uçur.
          </h2>
        </SceneLayer>
      </Scene>

      {/* Iris (A19) with the photo drifting inside, and StatSwap (A30, A31). */}
      <Scene theme="dark" length={4} aria-labelledby="iris-title" data-testid="iris-scene">
        <SceneLayer className="isolate">
          <Scrub
            trigger="scene"
            range="0-0 → -100-0"
            easing="quadIn"
            from={{ clipPath: clip.irisPoint }}
            to={{ clipPath: clip.irisOpen }}
            data-testid="iris"
            className="absolute inset-0 overflow-hidden"
          >
            <Scrub
              trigger="scene"
              range="0-0 → -300-0"
              from={{ translate: "0 0%" }}
              to={{ translate: "0 -30%" }}
              className="h-[130%]"
            >
              <Photo slot="home.cardZoom.4" locale={locale} />
            </Scrub>
          </Scrub>
          <div className="absolute inset-0 flex flex-col justify-center gap-u3 px-layout">
            <Note className="text-center">Scrub · iris (A19) · StatSwap (A30, A31)</Note>
            <h2 id="iris-title" className="sr-only">
              Mənzillər
            </h2>
            <StatSwap
              trigger="scene"
              at={["-100%", "-200%"]}
              data-testid="stats"
              sets={[
                {
                  key: "area",
                  fromLabel: "-dan",
                  from: "42",
                  label: "Mənzillərin sahəsi, m²",
                  toLabel: "-dək",
                  to: "186",
                },
                {
                  key: "ceiling",
                  fromLabel: "-dan",
                  from: "3,1",
                  label: "Tavanın hündürlüyü, m",
                  toLabel: "-dək",
                  to: "3,6",
                },
              ]}
            />
          </div>
        </SceneLayer>
      </Scene>

      {/* Centre strip (A20): the light content opens from the centre line. */}
      <Scene theme="dark" length={3} aria-labelledby="strip-title">
        <SceneLayer>
          <Photo slot="home.cardZoom.2" locale={locale} />
        </SceneLayer>
        <SceneLayer data-theme="light">
          <Scrub
            trigger="scene"
            range="0-0 → -100-0"
            easing="quadIn"
            from={{ clipPath: clip.stripClosed }}
            to={{ clipPath: clip.open }}
            className="isolate flex size-full flex-col items-center justify-center gap-u2 bg-(--t-bg) px-layout text-center text-(--t-text)"
          >
            <GridLines variant="quarters" />
            <Note>Scrub · centre strip (A20)</Note>
            <h2 id="strip-title" className="max-w-(--container-prose) text-lead text-(--t-primary)">
              Lobbi: işıq ortadan açılır, qaranlıq foto kənarlarda qalır.
            </h2>
          </Scrub>
        </SceneLayer>
      </Scene>

      {/* Window expand (A21): the window opens to full screen while the image
          zooms .85 → 1 → 1.15; the labels fade in at the end. */}
      <Scene theme="sand" length={3} aria-labelledby="window-title">
        <SceneLayer className="flex flex-col justify-between px-layout py-u6">
          <h2 id="window-title" className="max-w-[30rem] text-lead text-(--t-primary)">
            Xidmətlər: pəncərə bütün ekrana açılır.
          </h2>
          <Note>Scrub · window expand (A21)</Note>
          <SplitWord word="Xidmət" lang="az" className="text-word text-(--t-primary) uppercase" />
        </SceneLayer>
        <SceneLayer data-theme="dark">
          <Scrub
            trigger="scene"
            range="0-0 → -100-0"
            easing="quadInOut"
            from={{ clipPath: clip.window }}
            to={{ clipPath: clip.open }}
            className="relative isolate size-full overflow-hidden"
          >
            <Scrub
              trigger="scene"
              range="0-0 → -100-0"
              easing="quadInOut"
              from={{ scale: "0.85" }}
              to={{ scale: "1" }}
              className="size-full"
            >
              <Scrub
                trigger="scene"
                range="-100-0 → -275-0"
                from={{ scale: "1" }}
                to={{ scale: "1.15" }}
                className="size-full"
              >
                <Photo slot="home.amenities.window" locale={locale} />
              </Scrub>
            </Scrub>
            <Scrub
              trigger="scene"
              range="-75-0 → -100-0"
              easing="quadInOut"
              from={{ opacity: 0 }}
              to={{ opacity: 1 }}
              className="absolute inset-x-0 bottom-0 grid grid-cols-2 desk:grid-cols-4"
            >
              {["Lobbi", "Fitnes", "Uşaq otağı", "Parkinq"].map((label) => (
                <p
                  key={label}
                  className="border-t border-(--t-line-alt) py-u3 text-center text-label text-(--t-text) uppercase desk:border-s desk:first:border-s-0"
                >
                  {label}
                </p>
              ))}
            </Scrub>
          </Scrub>
        </SceneLayer>
      </Scene>

      {/* Staircase word (A16) and dividers revealed top-down as a group (A39). */}
      <section
        data-theme="dark-alt"
        aria-labelledby="staircase-title"
        className="relative isolate flex flex-col gap-u12 overflow-hidden bg-(--t-bg) py-u12 text-(--t-text)"
      >
        <Note className="px-layout">SplitWord · staircase (A16), also on touch</Note>
        <h2 id="staircase-title" className="sr-only">
          Mühəndislik
        </h2>
        <SplitWord
          word="Mühəndislik"
          mode="staircase"
          mobile
          lang="az"
          className="px-layout text-word text-(--t-primary) uppercase"
        />
        <Reveal
          kind="text"
          as="p"
          className="mx-auto max-w-[38rem] px-layout text-center text-lead text-(--t-heading)"
        >
          İstilik, su və havalandırma sistemləri dağ iqliminə görə seçilib.
        </Reveal>
        <Reveal
          kind="clip-down"
          group
          as="ul"
          data-testid="columns"
          className="grid desk:grid-cols-4"
        >
          {["İstilik", "Su", "Hava", "Enerji"].map((title) => (
            <li
              key={title}
              className="flex flex-col gap-u6 border-t border-(--t-line-alt) px-layout py-u2 desk:border-s desk:border-t-0 desk:first:border-s-0"
            >
              <p className="text-label uppercase">{title}</p>
              <p className="text-body">
                Note · Reveal · clip-down (A39), a group staggered by --stagger-group.
              </p>
            </li>
          ))}
        </Reveal>
      </section>

      {/* A stack of three scenes: the second slides over the pinned first
          (underNext), then slides away to reveal the third (underPrevious). */}
      <Scene theme="dark" length={2} underNext aria-label="Scene 1" data-testid="stack-1">
        <SceneLayer>
          <Photo slot="home.stats.background" locale={locale} />
          <Note className="absolute start-layout bottom-u3">Scene 1 / 3 · underNext</Note>
        </SceneLayer>
      </Scene>
      <Scene theme="dark" length={2} aria-label="Scene 2" data-testid="stack-2">
        <SceneLayer>
          <Photo slot="home.location.intro" locale={locale} />
          <Note className="absolute start-layout bottom-u3">Scene 2 / 3 · slides over 1</Note>
        </SceneLayer>
      </Scene>
      <Scene theme="dark" length={2} underPrevious aria-label="Scene 3" data-testid="stack-3">
        <SceneLayer>
          <Photo slot="home.construction.background" locale={locale} />
          <Note className="absolute start-layout bottom-u3">
            Scene 3 / 3 · underPrevious, revealed as 2 leaves
          </Note>
        </SceneLayer>
      </Scene>

      {/* Threshold: reversible clip-up cards (A29) and GridLines variants. */}
      <section
        data-theme="light"
        aria-labelledby="threshold-title"
        className="relative isolate flex flex-col gap-u6 bg-(--t-bg) px-layout py-u12 text-(--t-text)"
      >
        <Note>Threshold · clip-up (A29) at 80-0, reversible</Note>
        <h2 id="threshold-title" className="sr-only">
          Yaxınlıqda
        </h2>
        <Threshold at="80-0" data-testid="cards" className="group grid gap-u desk:grid-cols-3">
          {(["home.location.card.1", "home.location.card.2", "home.location.card.3"] as const).map(
            (slot, i) => (
              <figure
                key={slot}
                className="flex aspect-[440/240] flex-col overflow-hidden transition-[clip-path] duration-(--duration-reveal) ease-(--ease-wipe) group-data-[state=out]:duration-(--duration-slow) group-data-[state=out]:[clip-path:inset(100%_0_0_0)]"
              >
                <Photo slot={slot} locale={locale} sizes="(width >= 41.75rem) 33vw, 100vw" />
                <figcaption
                  data-theme="dark-alt"
                  className="flex h-16 shrink-0 items-center gap-u bg-(--t-bg) px-u text-body text-(--t-text)"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-(--color-cream) text-label-xs text-(--color-ink)">
                    {5 * (i + 1)}
                  </span>
                  <span className="text-label uppercase">dəq</span>
                  <span className="ms-auto">Məkan {i + 1}</span>
                </figcaption>
              </figure>
            ),
          )}
        </Threshold>

        <Note>GridLines · half, thirds, quarters, wider · draw (A13)</Note>
        <div data-theme="dark" className="grid gap-u desk:grid-cols-2">
          {variants.map((variant, i) => (
            <div
              key={variant}
              className="relative isolate flex h-[40svh] items-end bg-(--t-bg) p-u text-(--t-text)"
            >
              <GridLines variant={variant} alt={i % 2 === 1} mobileAll draw />
              <Note>
                {variant}
                {i % 2 === 1 ? " · alt" : ""}
              </Note>
            </div>
          ))}
        </div>
      </section>

      {/* Cursor followers: the next-page teaser's "KEÇ" button and a carousel's arrow. */}
      <section
        data-theme="dark"
        aria-labelledby="follower-title"
        className="flex flex-col gap-u6 bg-(--t-bg) py-u12 text-(--t-text)"
      >
        <Note className="px-layout">useCursorFollower · carousel arrow (A35)</Note>
        <h2 id="follower-title" className="sr-only">
          Kursor
        </h2>
        <CarouselDemo>
          {(
            ["home.cardZoom.1", "home.cardZoom.2", "home.cardZoom.3", "home.cardZoom.4"] as const
          ).map((slot) => (
            <div key={slot} className="aspect-[483/666] w-[80vw] shrink-0 snap-center desk:w-1/3">
              <Photo slot={slot} locale={locale} sizes="(width >= 41.75rem) 33vw, 80vw" />
            </div>
          ))}
        </CarouselDemo>
        <Note className="px-layout">useCursorFollower · next-page teaser</Note>
        <TeaserDemo href="#main">
          <div className="absolute inset-0 -z-1">
            <Photo slot="page.elaqe" locale={locale} />
          </div>
          <div className="flex flex-col gap-u">
            <span className="text-label uppercase">Növbəti</span>
            <span className="text-title uppercase">Kompleks</span>
          </div>
        </TeaserDemo>
      </section>

      <section
        data-theme="light"
        aria-label="End of page"
        className="bg-(--t-bg) px-layout py-u6 text-(--t-text)"
      >
        <Reveal
          kind="text"
          as="p"
          data-testid="last-text"
          className="max-w-(--container-prose) text-body"
        >
          The last block. It may never cross the reveal margin, so it enters when the page reaches
          its end.
        </Reveal>
      </section>
    </>
  );
}
