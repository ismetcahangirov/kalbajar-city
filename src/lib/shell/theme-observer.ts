/**
 * Which section theme lies under a horizontal line of the viewport (A10):
 * the header asks for the line through its middle, the fixed buttons for one
 * near the bottom.
 *
 * The contract for pages (#66, #68): a section that is not on the default
 * light ground carries `data-theme="dark|darker|dark-alt|sand|light"`
 * (a `Scene` sets it from its `theme`); the legacy `data-tone="night"`
 * counts as `dark`. Sections are found in `main` and the footer when the
 * observer starts (on each route change); where themed sections nest or
 * overlap, the last in document order wins, which is the one painted on
 * top. Nothing is measured per frame: one IntersectionObserver whose root
 * margin narrows the viewport to a 1 px band at the line.
 */
export type ShellTheme = "light" | "dark" | "darker" | "dark-alt" | "sand";

const themes = new Set<string>(["light", "dark", "darker", "dark-alt", "sand"]);

function themeOf(element: Element): ShellTheme {
  const theme = element.getAttribute("data-theme");
  if (theme && themes.has(theme)) return theme as ShellTheme;
  return element.getAttribute("data-tone") === "night" ? "dark" : "light";
}

const sections = "main [data-theme], main [data-tone], footer[data-theme], footer [data-theme]";

/**
 * Calls `onTheme` with the theme under the line `line()` px from the top of
 * the viewport, now and whenever it changes. Re-created on resize, because
 * the band's margins are in pixels. Returns the cleanup.
 */
export function observeThemeAt(
  line: () => number,
  onTheme: (theme: ShellTheme) => void,
): () => void {
  const candidates = [...document.querySelectorAll(sections)];
  const order = new Map(candidates.map((element, i) => [element, i]));
  const under = new Set<Element>();
  let observer: IntersectionObserver | null = null;
  let current: ShellTheme | null = null;

  const report = () => {
    let top: Element | null = null;
    for (const element of under) {
      if (!top || (order.get(element) ?? 0) > (order.get(top) ?? 0)) top = element;
    }
    const theme = top ? themeOf(top) : "light";
    if (theme !== current) {
      current = theme;
      onTheme(theme);
    }
  };

  const start = () => {
    observer?.disconnect();
    under.clear();
    const y = Math.round(line());
    const below = Math.max(0, window.innerHeight - y - 1);
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) under.add(entry.target);
          else under.delete(entry.target);
        }
        report();
      },
      { rootMargin: `-${y}px 0px -${below}px 0px`, threshold: 0 },
    );
    for (const element of candidates) observer.observe(element);
    if (candidates.length === 0) report();
  };

  start();
  window.addEventListener("resize", start);
  return () => {
    window.removeEventListener("resize", start);
    observer?.disconnect();
  };
}
