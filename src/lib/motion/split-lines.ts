/**
 * Splits a heading into its rendered lines for `LineReveal`, without
 * SplitText: words are measured where the browser laid them out, grouped by
 * their top, and each line is wrapped in a clip.
 *
 * The heading's own child nodes are kept and put back by `restore`, so the
 * nodes React rendered are the ones on the page again once the entry has run.
 * Inline elements around words (an `<em>`) are copied onto each piece of the
 * line they cover. The accessible name stays one string: the heading gets an
 * `aria-label` and the line spans are hidden from assistive tech.
 */

type Word = { text: string; wrappers: Element[] };

export type SplitLines = { inners: HTMLElement[]; restore: () => void };

function collectWords(nodes: Iterable<Node>, wrappers: Element[], words: Word[]) {
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const text of (node.textContent ?? "").split(/\s+/)) {
        if (text) words.push({ text, wrappers });
      }
    } else if (node instanceof Element) {
      collectWords(node.childNodes, [...wrappers, node], words);
    }
  }
}

/** `text` inside shallow copies of `wrappers`, outermost first. */
function wrap(text: string, wrappers: Element[]): Node {
  let node: Node = document.createTextNode(text);
  for (let i = wrappers.length - 1; i >= 0; i--) {
    const copy = wrappers[i]!.cloneNode(false) as Element;
    copy.appendChild(node);
    node = copy;
  }
  return node;
}

export function splitLines(heading: HTMLElement): SplitLines | null {
  const original = [...heading.childNodes];
  const words: Word[] = [];
  collectWords(original, [], words);
  if (words.length === 0) return null;

  // 1. One span per word, laid out exactly like the original text.
  const probes = words.map(({ text, wrappers }) => {
    const probe = document.createElement("span");
    probe.appendChild(wrap(text, wrappers));
    return probe;
  });
  const measuring = document.createDocumentFragment();
  probes.forEach((probe, i) => {
    if (i > 0) measuring.appendChild(document.createTextNode(" "));
    measuring.appendChild(probe);
  });
  heading.replaceChildren(measuring);

  // 2. Group words by the line they landed on.
  const lines: Word[][] = [];
  let lastTop = Number.NEGATIVE_INFINITY;
  probes.forEach((probe, i) => {
    const top = probe.offsetTop;
    if (top > lastTop + 1) lines.push([]);
    lastTop = Math.max(lastTop, top);
    lines.at(-1)!.push(words[i]!);
  });

  // 3. Each line in a clip; words sharing wrappers stay in one wrapper.
  const label = heading.getAttribute("aria-label");
  const inners = lines.map((line) => {
    const outer = document.createElement("span");
    outer.dataset.line = "";
    outer.setAttribute("aria-hidden", "true");
    const inner = document.createElement("span");
    inner.dataset.lineInner = "";
    let run: Word[] = [];
    const flush = () => {
      if (run.length === 0) return;
      if (inner.childNodes.length) inner.appendChild(document.createTextNode(" "));
      inner.appendChild(wrap(run.map((w) => w.text).join(" "), run[0]!.wrappers));
      run = [];
    };
    for (const word of line) {
      const same =
        run.length > 0 &&
        run[0]!.wrappers.length === word.wrappers.length &&
        run[0]!.wrappers.every((w, i) => w === word.wrappers[i]);
      if (!same) flush();
      run.push(word);
    }
    flush();
    outer.appendChild(inner);
    return { outer, inner };
  });
  heading.replaceChildren(...inners.map(({ outer }) => outer));
  if (label === null) {
    heading.setAttribute("aria-label", words.map((w) => w.text).join(" "));
  }

  return {
    inners: inners.map(({ inner }) => inner),
    restore: () => {
      heading.replaceChildren(...original);
      if (label === null) heading.removeAttribute("aria-label");
    },
  };
}
