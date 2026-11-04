import { ArrowRight, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Development fixture for reviewing the form and button components at every
// width. It is not part of the site: production builds answer 404, so its
// sample copy is not user-facing and does not go through the message
// catalogues. The motion primitives are on /primitivler/hereket.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const themes = ["light", "sand"] as const;

export default function PrimitivesPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRIMITIVES !== "1") {
    notFound();
  }

  return (
    <>
      {themes.map((theme) => (
        <section
          key={theme}
          data-theme={theme}
          aria-labelledby={`theme-${theme}`}
          className="flex flex-col gap-u3 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:py-u9"
        >
          <div className="flex flex-col gap-u">
            <p className="text-label text-(--t-small) uppercase">Theme: {theme}</p>
            <h2 id={`theme-${theme}`} className="text-title text-(--t-heading) uppercase">
              Dağların qoynunda
            </h2>
            <p className="max-w-(--container-prose) text-lead">
              Lead paragraph. Kəlbəcər, İstisu, Şəlalə, Ğ ğ I ı İ i Ç ç Ö ö Ü ü Ə ə. Кельбаджар —
              новый жилой комплекс в горах.
            </p>
            <p className="max-w-(--container-prose) text-body">
              Body text. Numerals: 1 234 567, 62,09 m².
            </p>
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

          <div className="flex flex-wrap gap-3">
            <Badge variant="available">Satışda</Badge>
            <Badge variant="reserved">Rezerv</Badge>
            <Badge variant="sold">Satılıb</Badge>
            <Badge variant="neutral">2 otaq</Badge>
            <Badge variant="illustrative">Illustrative</Badge>
          </div>

          <form className="grid max-w-(--container-prose) gap-6">
            <Input id={`${theme}-name`} label="Ad" autoComplete="name" />
            <Input
              id={`${theme}-phone`}
              label="Telefon"
              type="tel"
              helper="Format: +994 50 000 00 00"
              error="Telefon nömrəsini yazın"
            />
            <Select id={`${theme}-rooms`} label="Otaq sayı" defaultValue="2">
              <option value="1">1 otaq</option>
              <option value="2">2 otaq</option>
              <option value="3">3 otaq</option>
            </Select>
            <Textarea id={`${theme}-message`} label="Mesaj" />
            <Checkbox
              id={`${theme}-consent`}
              label={
                <>
                  I agree to the <Link href="/primitivler">privacy policy</Link>
                </>
              }
            />
          </form>
        </section>
      ))}
    </>
  );
}
