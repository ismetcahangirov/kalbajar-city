import { ArrowRight, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Container,
  Eyebrow,
  Heading,
  Icon,
  Input,
  Section,
  Select,
  Stat,
  Text,
  Textarea,
} from "@/components/ui";

// Development fixture for reviewing the primitives at every width. It is not
// part of the site: production builds answer 404, so its sample copy is not
// user-facing and does not go through the message catalogues.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const tones = ["paper", "limestone", "night"] as const;

export default function PrimitivesPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRIMITIVES !== "1") {
    notFound();
  }

  return (
    <>
      {/* A stand-in hero, so the header's transparent state can be reviewed
          until the home page (#17) has the real one. */}
      <div
        data-header-overlay=""
        data-tone="night"
        className="flex min-h-[70svh] items-end pt-(--header-height) pb-block"
      >
        <Container>
          <Heading as="h1" size="display-xl">
            Header over a hero
          </Heading>
        </Container>
      </div>
      {tones.map((tone) => (
        <Section key={tone} tone={tone} aria-labelledby={`tone-${tone}`}>
          <Container className="flex flex-col gap-block">
            <div className="flex flex-col gap-4">
              <Eyebrow>Tone: {tone}</Eyebrow>
              <Heading as="h2" id={`tone-${tone}`} size="display">
                Dağların qoynunda <em>yeni ev</em>
              </Heading>
              <Heading as="h3" size="heading">
                Sub-heading in Light
              </Heading>
              <Heading as="h4" size="title">
                Small heading in Regular
              </Heading>
              <Text size="body-lg" className="max-w-(--container-prose)">
                Lead paragraph. Kəlbəcər, İstisu, Şəlalə, Ğ ğ I ı İ i Ç ç Ö ö Ü ü Ə ə. Кельбаджар —
                новый жилой комплекс в горах.
              </Text>
              <Text className="max-w-(--container-prose)">
                Body text at 17 px. Numerals are old-style: 1 234 567, 62,09 m².
              </Text>
              <Text size="small" tone="muted">
                Small, muted caption text.
              </Text>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button leadingIcon={<Icon icon={Phone} />}>Primary</Button>
              <Button variant="secondary" trailingIcon={<Icon icon={ArrowRight} />}>
                Secondary
              </Button>
              <Button variant="primary" size="lg" href="/primitivler">
                Large link
              </Button>
              <Button variant="link" href="tel:+994000000000">
                Link button
              </Button>
              <Button disabled>Disabled</Button>
            </div>

            {tone !== "night" && (
              <div className="flex flex-wrap gap-3">
                <Badge variant="available">Satışda</Badge>
                <Badge variant="reserved">Rezerv</Badge>
                <Badge variant="sold">Satılıb</Badge>
                <Badge variant="neutral">2 otaq</Badge>
                <Badge variant="illustrative">Illustrative</Badge>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
              <Stat value={22634} unit="m²" locale="az" label="Ərazi" />
              <Stat value={312} locale="az" label="Mənzil" />
              <Stat
                value={1250.5}
                unit="m²"
                locale="ru"
                label="Площадь"
                maximumFractionDigits={1}
              />
              <Stat value={4} locale="en" label="Buildings" />
            </dl>

            <div className="grid gap-gutter md:grid-cols-3">
              {(["grid", "portrait", "grid"] as const).map((aspect, i) => (
                <Card
                  key={i}
                  aspect={aspect}
                  media={<div className="size-full bg-surface-alt" />}
                  title={`Card ${i + 1}`}
                  meta="62,09 m² · 2 otaq"
                  href={i === 0 ? "/primitivler" : undefined}
                />
              ))}
            </div>

            {tone !== "night" && (
              <form className="grid max-w-(--container-prose) gap-6">
                <Input id={`${tone}-name`} label="Ad" autoComplete="name" />
                <Input
                  id={`${tone}-phone`}
                  label="Telefon"
                  type="tel"
                  helper="Format: +994 50 000 00 00"
                  error="Telefon nömrəsini yazın"
                />
                <Select id={`${tone}-rooms`} label="Otaq sayı" defaultValue="2">
                  <option value="1">1 otaq</option>
                  <option value="2">2 otaq</option>
                  <option value="3">3 otaq</option>
                </Select>
                <Textarea id={`${tone}-message`} label="Mesaj" />
                <Checkbox
                  id={`${tone}-consent`}
                  label={
                    <>
                      I agree to the <Link href="/primitivler">privacy policy</Link>
                    </>
                  }
                />
              </form>
            )}
          </Container>
        </Section>
      ))}
    </>
  );
}
