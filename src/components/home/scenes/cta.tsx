import { DeferredLeadForm } from "@/components/leads/deferred-lead-form";
import { GridLines } from "@/components/motion/grid-lines";
import { Scrub } from "@/components/motion/scrub";
import type { HomeSection } from "@/lib/public/home";

import { Localized } from "../localized";
import { langOf, Photo } from "./photo";

type CtaProps = Extract<HomeSection, { kind: "cta" }>;

/**
 * S10 (pyzhevsky-home.md §3) on sand: the portrait centred in the left half
 * with its image sliding inside the frame (A28), and in the right half the
 * title as a centred lead over the `FieldBox` inquiry form. The form never
 * animates; its script loads as its place nears the screen, which keeps
 * the form's height meanwhile. On phones the portrait is left out and the
 * form takes the full width.
 */
export function Cta({ title, body, portrait }: CtaProps) {
  return (
    <section
      data-theme="sand"
      aria-labelledby="muraciet"
      className="relative isolate bg-(--t-bg) text-(--t-text) desk:grid desk:min-h-svh desk:grid-cols-2"
    >
      <GridLines variant="half" />
      <div className="hidden items-center justify-center desk:flex">
        <div className="relative aspect-[300/384] w-[20.833vw] overflow-hidden">
          <Scrub
            range="100-0 → 0-100"
            from={{ translate: "0 0%" }}
            to={{ translate: "0 -16.67%" }}
            className="h-[120%]"
          >
            <Photo image={portrait} sizes="21vw" />
          </Scrub>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-u4 px-layout py-u12 desk:px-[1.875rem] desk:py-u6">
        <div className="flex flex-col items-center gap-u2 text-center">
          <h2 id="muraciet" lang={langOf(title)} className="trim-cap max-w-[30rem] text-lead">
            {title.value}
          </h2>
          {body && (
            <p className="max-w-[30rem] text-body">
              <Localized text={body} />
            </p>
          )}
        </div>
        <DeferredLeadForm
          reserve="home"
          type="inquiry"
          labelledBy="muraciet"
          appearance="hairline"
        />
      </div>
    </section>
  );
}
