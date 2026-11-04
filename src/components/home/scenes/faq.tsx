import type { HomeSection } from "@/lib/public/home";

import { CircleSign } from "./circle-sign";
import { Localized } from "../localized";
import { langOf } from "./photo";

type FaqProps = Extract<HomeSection, { kind: "faq" }>;

/**
 * The FAQ as the reference's hairline accordion on light: the title in the
 * first third, the questions as `--text-lead` rows between 1 px rules with
 * ⊕ / ⊖. `<details>`, so the answers are in the HTML and open without
 * script; they open instantly (nothing in a form or a list of answers
 * animates).
 */
export function Faq({ title, items }: FaqProps) {
  return (
    <section
      data-theme="light"
      aria-labelledby="suallar"
      className="flex flex-col gap-u6 bg-(--t-bg) px-layout py-u12 text-(--t-text) desk:grid desk:grid-cols-3 desk:gap-u2"
    >
      <h2
        id="suallar"
        lang={langOf(title)}
        className="trim-cap text-title text-(--t-heading) uppercase"
      >
        {title.value}
      </h2>
      <div className="border-b border-(--t-line) desk:col-span-2">
        {items.map((item) => (
          <details key={item.question.value} data-faq="" className="border-t border-(--t-line)">
            <summary className="flex min-h-target cursor-pointer items-center justify-between gap-u2 py-u2 text-lead">
              <Localized text={item.question} />
              <span data-icon-closed="">
                <CircleSign />
              </span>
              <span data-icon-open="">
                <CircleSign minus />
              </span>
            </summary>
            <p className="max-w-(--container-prose) pb-u3 text-body">
              <Localized text={item.answer} />
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
