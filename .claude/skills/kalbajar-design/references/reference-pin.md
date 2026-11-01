# Reference: luxury real-estate site on a laptop

Source: https://www.pinterest.com/pin/959477895690277539/ · 13.87 s, 30 fps,
720 × 1280 (a phone filming a laptop screen while someone scrolls one page).

Analysed from 4 fps contact sheets of the whole clip, 10 fps sheets around the
hero exit, the image-grid entry and the pinned card section, and full-size
crops of eleven moments. A scene-cut pass (`scene > 0.25`) found **no cuts**:
it is one continuous scroll.

How to read the numbers:

- Scrolling is human-driven, so scroll-linked effects are described by what
  moves relative to what, not by milliseconds
- Time-based effects (fades, crossfades) are counted in frames, ± 1 frame
  (33 ms), and blurred by the camera. Treat them as "about"
- Sizes are read off a perspective-distorted phone recording of a laptop
  (screen ≈ 680 px wide in the crop, a ≈ 1440 px layout, ×2.1). They are
  proportions, not pixels to copy

Take structure, rhythm and motion. Colours, copy, imagery and proportions are
ours.

## Screens, in scroll order

| #   | Screen                  | Structure                                                                                                                                                                                                  |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hero                    | Full-bleed landscape image/video edge to edge. A very large bold wordmark over it on first frame. Fixed header: wordmark left, a "Prime villa in: \<word\>" ticker centre, three nav links right           |
| 2   | Hero foot               | White panel rising over the hero: a strip of four rounded thumbnails, a short paragraph, a dark rectangular primary button and an outline button, four small spec chips (area, bedrooms, pool, area)       |
| 3   | About                   | Left: small grey eyebrow ("About the villa"), two-line light serif heading, sans body. Right: collage of one wide and two tall rounded images                                                              |
| 4   | Stat row                | Three figures (bedrooms, bathrooms, size) in large light numerals with small labels, left-aligned in a row, plus a paragraph to the right                                                                  |
| 5   | Highlights              | Centred eyebrow + serif heading ("Designed around family life") + one-line subtitle, then a 2 × 2 grid of rounded images with captions under each                                                          |
| 6   | Features                | Centred heading and subtitle; three columns: a tall image carousel with dot controls, a list of four icon + title + text features, a smaller image above two more features                                 |
| 7   | Pinned "spaces" section | Heading + subtitle top-left; a full-bleed rounded image fills the rest; a white-framed card sits centred on it; a caption bottom-left; three spec chips bottom-right. The section pins while scenes change |
| 8   | Process                 | Centred heading ("A clear path to your next home") with four "Step n" pills; then four step cards in a row (briefing, viewing, offer, secure) above a collage: site plan, large photo, floor plans         |
| 9   | Proof                   | Heading ("A stronger family address") with avatar stack; a price card, an area card, a photo; review cards with avatar, name, quote and five stars                                                         |
| 10  | Location                | Centred eyebrow + heading ("Life in …") + subtitle; three image cards, each with a small tag and a two-line title                                                                                          |
| 11  | FAQ                     | Single column of accordion rows with hairline separators                                                                                                                                                   |
| 12  | Final CTA               | Eyebrow, large heading ("Discover …"), short paragraph, dark button; decorative rules to the right                                                                                                         |
| 13  | Footer                  | Brand name + blurb + social icons left; three link columns with small uppercase serif headings right; copyright line; then a giant gold wordmark across the bottom                                         |

Approximate proportions (1440 px layout): section heading ≈ 40–48 px, body
≈ 14–15 px, eyebrow ≈ 12 px, stat numerals ≈ 24–28 px, footer wordmark
≈ 160–180 px spanning ≈ 40 % of the width. Side margin ≈ 6–7 % of the width.
Vertical gap between sections ≈ 120–160 px. Image corner radius ≈ 12 px.

## Motion, moment by moment

| Time (s)    | What happens                                                                                                                                                           | Duration (about)          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 0.00 → 0.25 | The bold hero wordmark fades out; it is gone by the next 4 fps sample                                                                                                  | ≤ 250 ms                  |
| 0.00 → 1.90 | The hero image pushes in from an aerial view towards the house. Its framing changes, so it is a drone **video**, not a CSS zoom                                        | ≈ 1.9 s of footage        |
| 1.90 → 2.40 | First scroll. The white panel rises over the hero; the hero image moves up at roughly half the scroll speed (parallax), so the house leaves frame later than the panel | scroll-linked             |
| 2.40 → 3.00 | Thumbnails, buttons and the About heading arrive. The heading shows a doubled "ghost" for one frame: a short fade + rise                                               | 100–200 ms visible        |
| 3.60 → 4.10 | The 2 × 2 highlight grid enters: each image rises a little and fades in; the second row follows the first                                                              | 300–500 ms per card       |
| 6.25 → 6.50 | The features carousel crossfades to its next image                                                                                                                     | 250–400 ms                |
| 7.25 → 7.75 | The "spaces" section scrolls in, then pins                                                                                                                             | —                         |
| 8.35 → 8.65 | Inside the pin, the framed card's image changes first (preview of the next scene)                                                                                      | 150–300 ms crossfade      |
| 8.80 → 8.95 | The full-bleed background then adopts the card's image; the caption bottom-left changes with it                                                                        | 150–300 ms crossfade      |
| 7.75 → 9.30 | Three scenes pass (living room → private pool → garden retreat) while pinned                                                                                           | ≈ 0.5 s of scroll a scene |
| throughout  | The header ticker word swaps vertically, old word up and out, new word up and in (one swap at 8.35–8.50)                                                               | 150–300 ms                |
| 13.2 → 13.9 | Footer arrives; the giant wordmark is static                                                                                                                           | —                         |

Scrolling itself is smoothed: page velocity eases in and out between wheel
inputs with no visible steps, the signature of an inertial scroller such as
Lenis.

Character in one line: slow, inertial scroll; short, quiet fades; one pinned
moment carries the drama.

## What makes it work

- One cinematic image does the selling at the top; everything after it is calm
- A single light display style, very large, with lots of air around it
- Images are the content: grids, a collage, a pinned full-bleed sequence
- Concrete numbers early (stat row, spec chips), not adjectives
- Rhythm alternates dense (grids, cards) and open (one heading, whitespace)
- The footer closes on the brand, huge, as a full stop

## What it gets wrong for us

- The renders are AI-generated: a sci-fi interior, desert villas, a beach
  house in the same "Dubai" listing. On our site every image of the complex is
  real, and generated imagery is atmosphere only (CLAUDE.md, Imagery)
- Gold wordmark on white measures ≈ 2.8 : 1, a WCAG failure even as large text
- Grey eyebrows and captions are near the contrast floor
- Star ratings and stock testimonials. We publish only real, attributable
  quotes, or no testimonials at all
- Price card in a foreign currency on the page. Our prices appear only when the
  owner enables them
- The serif + sans pairing. We ship one family, Alethia Next, which is a sans
- The pinned section swaps images by crossfade; the issue asks for a card that
  grows into the next image, which reads better as continuous zoom

## What we take, and what we leave

| Take                                           | From             | Becomes in ours                                                                         |
| ---------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------- |
| Full-bleed cinematic hero over a fixed header  | Screen 1         | Kəlbəcər mountain drone video over a poster image that is the LCP; header over it       |
| Hero image moving slower than the page         | 1.9–2.4 s        | `Parallax` on the hero media                                                            |
| Large, light display headings with lots of air | Screens 3, 5, 6  | Alethia Next Light at `display` sizes; Italic for one emphasised phrase                 |
| Eyebrow → heading → subtitle stack             | Screens 3, 5, 10 | `Eyebrow` + `Heading` + `Text`, uppercase tracked eyebrow, alternating left and centred |
| Stat row with large numerals                   | Screen 4         | `Stat` row: area, apartments, parking, buildings, with `CountUp`                        |
| Image grids that rise into place               | 3.6–4.1 s        | `ImageReveal`: a clip-path wipe, our stronger version of the same entry                 |
| Short fade + rise on text                      | 2.4–3.0 s        | `FadeUp`, the one scroll-entry for blocks                                               |
| Pinned full-bleed scene with a framed card     | Screen 7         | `PinnedCardZoom`: the card grows into the next full-bleed scene, scrubbed by scroll     |
| Spec chips over imagery                        | Screens 2, 7     | Small chips: area, rooms, floor, status, over or under the image                        |
| Numbered process                               | Screen 8         | "Yeni evinizə yol": four steps with large Light numerals 01–04                          |
| Image cards for the surroundings               | Screen 10        | Location section: distances and places around Kəlbəcər                                  |
| FAQ, then one final CTA                        | Screens 11–12    | FAQ (`FAQPage` JSON-LD), then inquiry / call-back CTA                                   |
| Footer closing on a giant wordmark             | Screen 13        | "Kalbajar City" wordmark spanning the width, gold on `night`, where it passes contrast  |
| Inertial smooth scroll                         | whole clip       | Lenis on desktop pointer devices only                                                   |

| Leave                                                     | Why                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| White / black / orange-gold palette                       | Ours is stone, timber and a restrained gold from the place itself        |
| Serif headings + sans body                                | One family only: Alethia Next                                            |
| Desert, beach and sci-fi renders                          | Misleading on a property site; our imagery is real or atmosphere-only    |
| All copy ("Prime villa in", "Spaces made to be lived in") | Ours is written for Kalbajar City in az, en and ru                       |
| Header word ticker                                        | Motion with no information; it costs attention on every page             |
| Bold wordmark over the hero                               | The hero headline is real content and must not start hidden (LCP)        |
| Star ratings, avatar stacks, stock reviews                | Unverifiable social proof; only real quotes, if the owner provides them  |
| Price card in the page body                               | Prices are a setting, off until the owner decides                        |
| Square black buttons                                      | Our buttons are pills in `basalt`                                        |
| "Step 1" pills                                            | Large numerals carry the order; text labels carry the meaning            |
| Crossfade-only scene change in the pinned section         | Replaced by a continuous card-to-full-bleed zoom                         |
| Centred alignment for every section head                  | We alternate left-aligned and centred to keep the rhythm from going flat |
| Exact proportions, column splits and sizes                | The pin is vocabulary, not a template (CLAUDE.md, Design)                |
