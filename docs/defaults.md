# Default images

Every image slot on the public site has a default bundled with the site (spec
§8, `docs/superpowers/specs/2026-11-04-pyzhevsky-redesign-design.md`). A
visitor sees it until the console chooses a file; clearing the choice brings
the default back. Components cannot tell a default from a library image: the
loaders return `image ?? defaultImage(slot, locale)`.

Real data never gets a default: apartment plans and photos, news covers and
gallery items show nothing rather than a stand-in, and the location map stays
the real map.

## How it works

- `src/content/defaults/manifest.ts` lists the slots and, for each, the
  original, the crop (aspect ratio, focus point, the area to stay inside), the
  source and the date
- `pnpm defaults:encode [slot…]` crops the originals and writes
  `public/defaults/<slot>/<width>.<avif|webp>` at the widths the media library
  would make (`planVariantWidths`, capped by `maxWidth`) with the library's
  encoder settings, and `src/content/defaults/encoded.json` (size, focus
  position, blur placeholder, dominant colour)
- The originals are committed in `assets/defaults/originals/` (override with
  `DEFAULTS_ORIGINALS`): `instagram/` with `sources.csv`, and `generated/` with
  `prompts.md`. Generated originals are stored as JPEG at quality 95
- Alt text is `Defaults.<slot>` in the az, en and ru catalogues. The
  `decor.*` slots are decorative and have none
- `tests/unit/defaults.test.ts` checks that every file exists, the widths and
  aspect ratios, the alt text in all three locales, the illustrative flag and
  the size budget (widest AVIF at most 250 KB, all files under 25 MB)

To replace a default: put the new original in the originals folder, point the
slot's entry at it (source, post URL or prompt id, date), run
`pnpm defaults:encode <slot>`, update the alt text and this table.

## Sources

Instagram images come from the complex's own account,
[@kalbajar.city](https://www.instagram.com/kalbajar.city/), at the largest
size Instagram serves (1080 px wide for most posts and reel covers). They may
show the complex. Generated images are atmosphere only: no building, apartment,
view from one or amenity. They always carry the "Illustrative" chip.

| Slot                           | Files (widths, px)                                                  | Source                                                 | Date       |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------ | ---------- |
| `home.hero.poster`             | `public/defaults/home.hero.poster/` 320, 480, 768, 960, 1080        | Instagram, https://www.instagram.com/reel/DcIYfGcjyma/ | 2026-11-04 |
| `home.hero.panel`              | `public/defaults/home.hero.panel/` 480, 768, 960, 1080              | Instagram, https://www.instagram.com/reel/DdliV-rkwSb/ | 2026-11-04 |
| `home.about.image`             | `public/defaults/home.about.image/` 480, 768, 960, 1149             | Instagram, https://www.instagram.com/p/De198LdCuqf/    | 2026-11-04 |
| `home.about.background`        | `public/defaults/home.about.background/` 480, 768, 960, 1080        | Instagram, https://www.instagram.com/reel/DclNox7iWYF/ | 2026-11-04 |
| `home.stats.background`        | `public/defaults/home.stats.background/` 480, 768, 960, 1536        | Generated, G4                                          | 2026-11-04 |
| `home.layouts.background`      | `public/defaults/home.layouts.background/` 480, 768, 960, 1536      | Generated, G5                                          | 2026-11-04 |
| `home.cardZoom.1`              | `public/defaults/home.cardZoom.1/` 480, 648                         | Instagram, https://www.instagram.com/p/DctO4F5DY2k/    | 2026-11-04 |
| `home.cardZoom.2`              | `public/defaults/home.cardZoom.2/` 480, 768, 960, 1080              | Instagram, https://www.instagram.com/p/DdntuKTCoka/    | 2026-11-04 |
| `home.cardZoom.3`              | `public/defaults/home.cardZoom.3/` 480, 768, 960, 1080              | Instagram, https://www.instagram.com/reel/DeJ1qC3FZwu/ | 2026-11-04 |
| `home.cardZoom.4`              | `public/defaults/home.cardZoom.4/` 480, 768, 960, 1080              | Instagram, https://www.instagram.com/reel/DdG02VBCAQx/ | 2026-11-04 |
| `home.amenities.window`        | `public/defaults/home.amenities.window/` 480, 768, 960, 1536        | Generated, G6                                          | 2026-11-04 |
| `home.location.intro`          | `public/defaults/home.location.intro/` 480, 768, 960, 1600, 2304    | Instagram, https://www.instagram.com/reel/DXPHoGyjZW6/ | 2026-11-04 |
| `home.location.moverLeft`      | `public/defaults/home.location.moverLeft/` 480, 768, 960, 1024      | Generated, G7                                          | 2026-11-04 |
| `home.location.moverRight`     | `public/defaults/home.location.moverRight/` 480, 768, 960, 1024     | Generated, G8                                          | 2026-11-04 |
| `home.location.card.1`         | `public/defaults/home.location.card.1/` 480, 768, 960, 1080         | Instagram, https://www.instagram.com/p/DctO4F5DY2k/    | 2026-11-04 |
| `home.location.card.2`         | `public/defaults/home.location.card.2/` 480, 768, 960, 1080         | Instagram, https://www.instagram.com/p/DctO4F5DY2k/    | 2026-11-04 |
| `home.location.card.3`         | `public/defaults/home.location.card.3/` 480, 768, 960, 1080         | Instagram, https://www.instagram.com/p/DctO4F5DY2k/    | 2026-11-04 |
| `home.location.card.4`         | `public/defaults/home.location.card.4/` 480, 768, 960, 1080         | Instagram, https://www.instagram.com/p/DctO4F5DY2k/    | 2026-11-04 |
| `home.location.card.5`         | `public/defaults/home.location.card.5/` 480, 768, 960, 1080         | Instagram, https://www.instagram.com/p/DctO4F5DY2k/    | 2026-11-04 |
| `home.location.card.6`         | `public/defaults/home.location.card.6/` 480, 768, 960, 1080         | Instagram, https://www.instagram.com/p/DctO4F5DY2k/    | 2026-11-04 |
| `home.construction.background` | `public/defaults/home.construction.background/` 480, 768, 960, 1080 | Instagram, https://www.instagram.com/p/DeMTljLDXZ8/    | 2026-11-04 |
| `home.cta.portrait`            | `public/defaults/home.cta.portrait/` 480, 768, 960, 1080            | Instagram, https://www.instagram.com/p/DcvypZAjSmg/    | 2026-11-04 |
| `page.menziller`               | `public/defaults/page.menziller/` 480, 768, 960, 1080               | Instagram, https://www.instagram.com/p/DdCAmP8jYsl/    | 2026-11-04 |
| `page.haqqimizda`              | `public/defaults/page.haqqimizda/` 480, 768, 960, 1080              | Instagram, https://www.instagram.com/reel/DcSoHUvj301/ | 2026-11-04 |
| `page.kompleks`                | `public/defaults/page.kompleks/` 480, 648                           | Instagram, https://www.instagram.com/p/DctO4F5DY2k/    | 2026-11-04 |
| `page.yerlesme`                | `public/defaults/page.yerlesme/` 480, 768, 960, 1600                | Instagram, https://www.instagram.com/reel/DXPHoGyjZW6/ | 2026-11-04 |
| `page.qalereya`                | `public/defaults/page.qalereya/` 480, 768, 960, 1080                | Instagram, https://www.instagram.com/p/DdJCNfnjU8y/    | 2026-11-04 |
| `page.tikinti`                 | `public/defaults/page.tikinti/` 480, 768, 960, 1080                 | Instagram, https://www.instagram.com/p/DeMTljLDXZ8/    | 2026-11-04 |
| `page.xeberler`                | `public/defaults/page.xeberler/` 480, 768, 960, 1080                | Instagram, https://www.instagram.com/p/DeMTljLDXZ8/    | 2026-11-04 |
| `page.elaqe`                   | `public/defaults/page.elaqe/` 480, 768, 960, 1080                   | Instagram, https://www.instagram.com/p/Dc08-GPDYNt/    | 2026-11-04 |
| `decor.leafShadow.1`           | `public/defaults/decor.leafShadow.1/` 480, 768, 960                 | Generated, G1                                          | 2026-11-04 |
| `decor.leafShadow.2`           | `public/defaults/decor.leafShadow.2/` 480, 768, 960                 | Generated, G2                                          | 2026-11-04 |
| `decor.plaster`                | `public/defaults/decor.plaster/` 480, 768, 960                      | Generated, G3                                          | 2026-11-04 |

## Generation prompts

Generated in ChatGPT (image generation) in the maintainer's browser, one
conversation, 2026-11-04.

| Id  | Prompt                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Create an image: a photograph of soft dappled leaf shadows from an unseen tree branch falling across a smooth warm cream lime-plaster wall. High-key, very soft light, shadows slightly diffused, neutral warm cream and sand tones only. Nothing else in frame: no objects, no window, no building, no people, no text. Landscape orientation 3:2.                                                           |
| G2  | Create another image, a different composition: larger, softer leaf and branch shadows (like an olive or fig tree) drifting diagonally across a warm cream plaster wall, very high-key and airy, gentle blur, neutral cream background so it blends into a #F7F2E8 page. No objects, no window, no building, no people, no text. Landscape 3:2.                                                                |
| G3  | Create another image: an abstract close-up of smooth warm cream lime plaster with a very subtle hand-troweled texture, evenly lit, high-key, almost flat, soft and slightly blurred, neutral cream and sand tones. No shadows of objects, no objects, no building, no text. Landscape 3:2.                                                                                                                    |
| G4  | Create another image: a photographic close-up still life of interior materials — a draped natural linen throw over a warm oak timber surface, soft late-afternoon window light from the side, shallow depth of field. Warm neutral palette: cream, sand, taupe, a little near-black in the shadows. Only materials in frame: no room view, no window visible, no building, no people, no text. Landscape 3:2. |
| G5  | Create another image: a quiet interior mood photograph of warm late-afternoon sunlight falling across a bare warm-cream plaster wall and a pale oak floor, with soft long light patches and gentle shadow gradients. Minimal and calm, warm neutral palette (cream, sand, taupe, near-black shadows). No furniture, no window or view visible, no building, no people, no text. Landscape 3:2.                |
| G6  | Create another image: a landscape photograph of the Lesser Caucasus mountains around Kalbajar, Azerbaijan — layered green and sand-coloured ridges and a deep river valley in soft, hazy morning light. Natural landscape only: no buildings, no houses, no roads, no people, no text. Muted warm palette. Landscape 3:2.                                                                                     |
| G7  | Create another image: a macro photograph of natural mountain stone — a weathered sand and taupe limestone surface with fine grain and soft side light. Texture only, filling the frame: no landscape, no building, no objects, no text. Portrait orientation 2:3.                                                                                                                                             |
| G8  | Create another image: a macro photograph of a polished cream terrazzo surface with small sand, taupe and near-black stone chips, meeting a strip of warm oak timber along one edge, soft daylight. Materials only, filling the frame: no room, no building, no objects, no text. Portrait orientation 2:3.                                                                                                    |
