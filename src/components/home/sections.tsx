import {
  AppWindow,
  Baby,
  DoorOpen,
  Fence,
  FireExtinguisher,
  Flame,
  ShieldCheck,
  SquareParking,
  type LucideIcon,
} from "lucide-react";

import { FadeUp, ImageReveal } from "@/components/motion";
import { Container, Heading, Icon, Picture, Section, Text, type Tone } from "@/components/ui";
import { cx } from "@/lib/cx";
import type { Amenity, HomeSection } from "@/lib/public/home";

import { Localized } from "./localized";
import { SectionHead } from "./section-head";

// The old home sections that /haqqimizda still shows until #68 rebuilds it.
// The home page itself renders src/components/home/scenes (#66).

type Props<K extends HomeSection["kind"]> = Extract<HomeSection, { kind: K }> & {
  tone: Tone;
  align: "start" | "center";
};

export function About({ eyebrow, title, body, image, tone, align }: Props<"about">) {
  return (
    <Section tone={tone} aria-labelledby="haqqinda">
      <Container
        className={cx("grid items-center gap-block", image && "lg:grid-cols-2 lg:gap-gutter")}
      >
        <div className="flex flex-col gap-block">
          <SectionHead
            id="haqqinda"
            eyebrow={eyebrow}
            title={title}
            align={image ? "start" : align}
          />
          <FadeUp>
            <Text
              size="body-lg"
              className={cx(
                "max-w-(--container-prose)",
                !image && align === "center" && "mx-auto text-center",
              )}
            >
              <Localized text={body} />
            </Text>
          </FadeUp>
        </div>
        {image && (
          <ImageReveal className="relative aspect-portrait overflow-hidden rounded-md">
            <Picture image={image} sizes="(min-width: 64rem) 50vw, 100vw" />
          </ImageReveal>
        )}
      </Container>
    </Section>
  );
}

const amenityIcons: Record<Amenity, LucideIcon> = {
  security: ShieldCheck,
  "fire-safety": FireExtinguisher,
  playground: Baby,
  windows: AppWindow,
  gas: Flame,
  lobby: DoorOpen,
  perimeter: Fence,
  parking: SquareParking,
};

export function Amenities({ title, items, tone, align }: Props<"amenities">) {
  return (
    <Section tone={tone} aria-labelledby="ustunlukler">
      <Container className="flex flex-col gap-block">
        <SectionHead id="ustunlukler" title={title} align={align} />
        <FadeUp
          as="ul"
          group
          className="grid gap-x-gutter gap-y-block sm:grid-cols-2 lg:grid-cols-4"
        >
          {items.map((item) => (
            <li
              key={item.icon + item.title.value}
              className="flex flex-col gap-4 border-t border-border pt-6"
            >
              <span className="text-text-accent">
                <Icon icon={amenityIcons[item.icon]} size={24} />
              </span>
              <Heading as="h3" size="title">
                <Localized text={item.title} />
              </Heading>
              {item.body && (
                <Text size="small" tone="muted">
                  <Localized text={item.body} />
                </Text>
              )}
            </li>
          ))}
        </FadeUp>
      </Container>
    </Section>
  );
}
