import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CountUp,
  FadeUp,
  ImageReveal,
  LineReveal,
  Parallax,
  PinnedCardZoom,
  type PinnedScene,
} from "@/components/motion";
import { Container, Eyebrow, Heading, Section, Stat, Text } from "@/components/ui";

// Development playground for the motion primitives (#16): each one alone, at
// every width, with and without reduced motion. Like /primitivler it answers
// 404 in production, so its sample copy does not go through the catalogues.
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Swatch = "ink" | "sand-hover" | "sepia" | "moss" | "sand" | "taupe";

/** Striped stand-in media, so movement is visible until real photos exist. */
function Placeholder({ from, to, label }: { from: Swatch; to: Swatch; label?: string }) {
  return (
    <div
      className="flex size-full items-center justify-center"
      style={{
        backgroundImage: `repeating-linear-gradient(135deg, var(--color-${from}) 0 2.5rem, var(--color-${to}) 2.5rem 5rem)`,
      }}
    >
      {label && (
        <span data-tone="night" className="rounded-md px-4 py-2 text-legacy-title">
          {label}
        </span>
      )}
    </div>
  );
}

const scenes: PinnedScene[] = [
  {
    key: "a",
    swatch: ["ink", "taupe"],
    title: "Dağ havası",
    text: "Scene one fills the stage.",
  },
  {
    key: "b",
    swatch: ["sepia", "sand"],
    title: "Daş və taxta",
    text: "The card grows into scene two.",
  },
  {
    key: "c",
    swatch: ["moss", "ink"],
    title: "Yaşamaq üçün",
    text: "Scene three appears as a card.",
  },
  {
    key: "d",
    swatch: ["sand-hover", "taupe"],
    title: "Evə qayıdış",
    text: "The last scene, then the pin releases.",
  },
].map(({ key, swatch, title, text }) => ({
  key,
  media: <Placeholder from={swatch[0] as Swatch} to={swatch[1] as Swatch} label={title} />,
  caption: (
    <div className="flex flex-col gap-2">
      <Heading as="h3" size="title">
        {title}
      </Heading>
      <Text size="small" tone="muted">
        {text}
      </Text>
    </div>
  ),
}));

export default function MotionPlaygroundPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRIMITIVES !== "1") {
    notFound();
  }

  return (
    <>
      {/* Hero: Parallax (hero variant). The FadeUp here is above the fold, so
          it must render in its final state and never animate. */}
      <div
        data-header-overlay=""
        data-tone="night"
        className="relative isolate flex min-h-[85svh] items-end overflow-hidden"
      >
        <Parallax variant="hero" className="absolute inset-0 -z-10">
          <Placeholder from="ink" to="taupe" />
        </Parallax>
        <Container className="pt-(--header-height) pb-block">
          <FadeUp data-testid="above-fold" className="flex flex-col gap-4">
            <Eyebrow>#16</Eyebrow>
            <Heading as="h1" size="display-xl">
              Motion primitives
            </Heading>
          </FadeUp>
        </Container>
      </div>

      <Section aria-labelledby="fade-up">
        <Container className="flex flex-col gap-block">
          <FadeUp className="flex flex-col gap-4">
            <Eyebrow>FadeUp</Eyebrow>
            <Heading as="h2" id="fade-up" size="heading">
              One block rising into place
            </Heading>
            <Text className="max-w-(--container-prose)">
              The only scroll-entry. Opacity and a short rise, once, when the top of the block
              crosses 85 % of the viewport.
            </Text>
          </FadeUp>
          <FadeUp as="ul" group className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="rounded-md bg-surface-alt p-6">
                <Text>Grouped item {i + 1}</Text>
              </li>
            ))}
          </FadeUp>
        </Container>
      </Section>

      <Section tone="limestone" aria-label="LineReveal">
        <Container className="flex flex-col gap-block">
          <Eyebrow>LineReveal</Eyebrow>
          <LineReveal as="h2" size="display">
            Dağların qoynunda, şəlalələrin səsində <em>yeni ev</em> və yeni həyat
          </LineReveal>
          <LineReveal as="h2" size="display" align="center">
            Новый жилой комплекс в горах Кельбаджара
          </LineReveal>
          <LineReveal as="h3" size="heading">
            Spaces made for slow mornings, long views and the sound of the river
          </LineReveal>
        </Container>
      </Section>

      <Section aria-label="ImageReveal">
        <Container className="flex flex-col gap-block">
          <Eyebrow>ImageReveal</Eyebrow>
          <div className="grid gap-gutter md:grid-cols-3">
            {(["sepia", "moss", "ink"] as const).map((swatch, i) => (
              <ImageReveal key={swatch} className="aspect-(--aspect-portrait) rounded-md">
                <Placeholder from={swatch} to="sand" label={`Image ${i + 1}`} />
              </ImageReveal>
            ))}
          </div>
          <ImageReveal className="aspect-(--aspect-hero) rounded-md">
            <Placeholder from="sand-hover" to="taupe" label="Wide image" />
          </ImageReveal>
        </Container>
      </Section>

      <Parallax aria-label="Parallax" className="h-[70svh]">
        <Placeholder from="moss" to="sepia" label="Parallax" />
      </Parallax>

      <Section aria-label="CountUp">
        <Container className="flex flex-col gap-block">
          <Eyebrow>CountUp</Eyebrow>
          <dl className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
            <Stat
              value={22634}
              unit="m²"
              locale="az"
              label="Ərazi"
              numeral={<CountUp value={22634} locale="az" />}
            />
            <Stat
              value={312}
              locale="az"
              label="Mənzil"
              numeral={<CountUp value={312} locale="az" />}
            />
            <Stat
              value={1250.5}
              unit="м²"
              locale="ru"
              label="Площадь"
              maximumFractionDigits={1}
              numeral={<CountUp value={1250.5} locale="ru" maximumFractionDigits={1} />}
            />
            <Stat
              value={4}
              locale="en"
              label="Buildings"
              numeral={<CountUp value={4} locale="en" />}
            />
          </dl>
        </Container>
      </Section>

      <Section tone="limestone" aria-labelledby="pinned" className="flex flex-col gap-block">
        <Container>
          <FadeUp className="flex flex-col gap-4">
            <Eyebrow>PinnedCardZoom</Eyebrow>
            <Heading as="h2" id="pinned" size="heading">
              The page&apos;s one pinned moment
            </Heading>
          </FadeUp>
        </Container>
        {/* Full bleed: the stage spans the viewport while pinned. */}
        <PinnedCardZoom aria-label="Scenes" scenes={scenes} />
      </Section>

      <Section aria-label="End of page">
        <Container>
          <FadeUp data-testid="last-block">
            <Text>
              The last block. It may never reach the trigger line, so it enters when the page
              reaches its end.
            </Text>
          </FadeUp>
        </Container>
      </Section>
    </>
  );
}
