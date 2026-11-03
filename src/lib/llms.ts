/**
 * `llms.txt` (https://llmstxt.org): a Markdown summary of the complex for AI
 * assistants, in English at `/llms.txt` and in Azerbaijani at `/llms-az.txt`
 * (#29). Every fact in it comes from the database through the same code as
 * the about page's facts block, so the two cannot disagree; this module only
 * lays the pieces out.
 */

export type LlmsLink = { title: string; url: string; description?: string | null };

export type LlmsDocument = {
  title: string;
  summary: string;
  intro?: string | null;
  facts: { heading: string; sentences: string[] };
  contacts: { heading: string; lines: Array<{ label: string; value: string }> };
  pages: { heading: string; links: LlmsLink[] };
  faq: { heading: string; items: Array<{ question: string; answer: string }> };
  languages: { heading: string; links: LlmsLink[] };
};

/** One line of Markdown: no line breaks inside a list item or a heading. */
function line(value: string): string {
  return value.replace(/\s*\n+\s*/g, " ").trim();
}

function link({ title, url, description }: LlmsLink): string {
  const text = `- [${line(title)}](${url})`;
  return description ? `${text}: ${line(description)}` : text;
}

/** The document as Markdown; a section with nothing in it is left out. */
export function llmsTxt(doc: LlmsDocument): string {
  const out: string[] = [`# ${line(doc.title)}`, "", `> ${line(doc.summary)}`, ""];
  if (doc.intro) out.push(doc.intro.trim(), "");
  const section = (heading: string, body: string[]) => {
    if (body.length) out.push(`## ${line(heading)}`, "", ...body, "");
  };
  section(
    doc.facts.heading,
    doc.facts.sentences.map((sentence) => `- ${line(sentence)}`),
  );
  section(
    doc.contacts.heading,
    doc.contacts.lines.map(({ label, value }) => `- ${line(label)}: ${line(value)}`),
  );
  section(doc.pages.heading, doc.pages.links.map(link));
  section(
    doc.faq.heading,
    doc.faq.items.flatMap(({ question, answer }) => [
      `### ${line(question)}`,
      "",
      answer.trim(),
      "",
    ]),
  );
  section(doc.languages.heading, doc.languages.links.map(link));
  // Plain spaces: no-break spaces keep numbers and units together on a page,
  // but some readers of a text file choke on them.
  return `${out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`.replaceAll("\u00a0", " ");
}
