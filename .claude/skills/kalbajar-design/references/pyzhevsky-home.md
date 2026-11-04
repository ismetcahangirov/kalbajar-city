# pyzhevsky.ru: home page measured

Reference: https://pyzhevsky.ru/ (landing only). Measured 2026-11-04 in Chrome via DevTools. Desktop 1440×900 @1x; mobile 390×844 @2x touch. Sources: ref/index.html, global.css, landing.css, landing.js, shared.js. Screenshots: `docs/redesign/reference-shots/home/*.jpeg` (mobile files start with m).

Conventions: y = Lenis scroll position at 1440×900 (1 vh = 900px). "(inferred)" = not read from code or measured. Scroll ranges use the site's keys "parallax-A-B": point B% of the element (0 top, 100 bottom) sits at A% of the viewport. 100-0 = element top at viewport bottom; 0-0 = top at top; 0-100 = bottom at top (gone); -100-0 = top one viewport above top. "90svh" = element top crosses 90% of viewport height.

## 0. The system

1. Sticky stacking with a 100svh overlap. Each scene is a `.sticky` CSS grid whose layers are `position: sticky; top: 0; height: 100svh`. `--under-previous` margin-top −100svh; `--under-next` margin-bottom −100svh. Adjacent pairs get `clip-path: inset(100svh 0 0)`. Next scene slides over a pinned background, or slides away revealing the scene underneath.
2. Scroll-scrubbed declarative parallax: `data-parallax-<range>='{"transform":…}'`. Easings: linear (default), easeSection = easeOutQuad (2t−t²), easeSectionInverse = easeInQuad (t²), easeInOutQuad. Clamped. Only transform, opacity, clip-path.
3. Threshold transitions: `animation--<name>` classes when a threshold is crossed; scrolling back plays the leave variant. Time-based, 0.4s lines, 1.6s text/images.
4. Reveal on entry: `data-reveal="text|image-in|clip-down"`, start opacity .005. IntersectionObserver bottom margin −100px, group threshold 0.5, stagger 180ms, delay 30ms. Desktop only.

Smooth scroll: Lenis in custom element `vig-smooth-scroll`: lerp 0.1, wheelMultiplier 1, smoothWheel on, syncTouch off.
Scroll snap only on hero, points 0 and 100svh; going down snaps forward after ≥1/5 vh (180px); Lenis lerp accelerating over 2s. Hero→facade always one move.

## 1. Tokens

### Colour

| Token          | Value              | Use                                                                                                   |
| -------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| --c-black      | #12100E            | dark bg, text on light, black button. Hover #2F2B27                                                   |
| --c-light      | #F7F2E8            | page bg, text on dark. Hover #FFFEFB                                                                  |
| --c-beige      | #BDB6A9            | bg-alt on light (services, form, Место light layer); primary on dark (big titles, nav). Hover #D5CEC1 |
| --c-dark-beige | #75736D            | heading/primary on light; bg of ui-dark-alt and engineering. Hover #88857E                            |
| --c-pale-dark  | hsla(45,4%,44%,.8) | captions, copyright on light                                                                          |
| error          | #A40000            |                                                                                                       |

Gradients: hero linear-gradient(180deg,#12100E,#5F5A52 100svh); facade panel linear-gradient(180deg,#1E1D1C -4.81%,#75736D 72.11%); facade top fade 60px #12100E→transparent.

Theme matrix (light / dark / darker / dark-alt):

| token      | light             | dark                 | darker  | dark-alt             |
| ---------- | ----------------- | -------------------- | ------- | -------------------- |
| background | #F7F2E8           | #12100E              | #12100E | #75736D              |
| text       | #12100E           | #F7F2E8              | #BDB6A9 | #F7F2E8              |
| heading    | #75736D           | #F7F2E8              | #F7F2E8 | #F7F2E8              |
| primary    | #75736D           | #BDB6A9              | #BDB6A9 | #F7F2E8              |
| secondary  | #BDB6A9           | #75736D              | #75736D | #F7F2E8              |
| line       | rgba(18,16,14,.1) | rgba(247,242,232,.1) | same    | rgba(247,242,232,.2) |
| line-alt   | rgba(18,16,14,.1) | rgba(247,242,232,.3) | same    | —                    |

Background sequence: dark hero gradient → render panel → #12100E (Фасад) → photo → #F7F2E8 (Окна) → photo → #BDB6A9 → #75736D → #F7F2E8 map → photo → #F7F2E8 territory → photos → photo → #F7F2E8 lobby → photos → #BDB6A9 services → #75736D engineering → photo parking → #BDB6A9 form → #F7F2E8 footer.

### Type

Two families: Garamond Light (ITC Garamond Light, serif, weight 400) body and leads, never uppercase. Halvar Breitschrift 400 display, 500 labels/buttons, always uppercase.
Root 10px; sizes calc(var(--scale-text-rem)*N); --scale-text-rem 1rem from 1200px, shrinks to .84rem below. Tiers: md ≥668, lg 1200×500, xxl 1440×700, xxxl 1920×700, xxxxl 2400×700. All text `text-box: trim-both cap alphabetic`.

| Style                                 | Font       | 1440 size/lh | Tracking   | 390   | Other                      |
| ------------------------------------- | ---------- | ------------ | ---------- | ----- | -------------------------- |
| .h1 giant word                        | Halvar 400 | 107/140      | 0, UPPER   | 30/30 | md 78, xxxl 122, xxxxl 138 |
| .h2 numbers                           | Halvar 400 | 60/60        |            | 30/30 |                            |
| .h3                                   | Halvar 400 | 45/60        |            | 30/30 |                            |
| .text-lead-lg                         | Garamond   | 45/45        | 0          | 22/22 | md 30, xxxl 50, xxxxl 60   |
| .text-lead                            | Garamond   | 30/30        | 0          | 18/20 | md 22, xxxl 34, xxxxl 45   |
| body                                  | Garamond   | 16/20        | .02em      | 13/15 | xxxl 18/22, xxxxl 21/25    |
| .text-small-t                         | Garamond   | 13/15        | .02em      | 12/14 |                            |
| .text-small labels/nav/buttons        | Halvar 500 | 10/18        | .2em UPPER | 9/16  | xxxxl 12/20                |
| .text-small-xs copyright/input labels | Halvar 500 | 8/12         | .2em       | 8/12  |                            |

Hero wordmark = SVG of 9 glyph paths, 720×72 (50vw), primary colour.
Giant words: primary (#BDB6A9 dark, #75736D light); "Окна" secondary #BDB6A9 on light; "Сервис" #12100E. Leads on light #75736D or #12100E; on dark #F7F2E8.

### Grid, spacing, lines

- Desktop 12 cols × 8.333vw, gutter 0, full-bleed. `.px-layout` 20px (15 mobile, 30 at 2400+). At 1440: 4-col cells 480px, image tiles 440px.
- Mobile 6 cols × 16.667vw, side 15px.
- Spacing unit 20px desktop, 10px mobile, 30px 2400+. pt-/pb-/mt-N = N×unit. Seen: 1,1.5,2,2.5,3,4,4.5,6,7,8,9,10,11,12,15,16,18. Section tops pt-6/9/12 = 120/180/240.
- --scale-px 1px from 1200px down to .6px at 720px (inferred) — button heights, header, logo width.
- Grid-lines decoration: absolute flex row, space-evenly, 1px border-left in line colour. Variants: 2 lines at 1/3–2/3, 1 at 50%, 3 at 25/50/75%, "wider" (25/75), "alt" (30% on dark). Mobile: only first line unless "mobile-all". Lines align with image/text columns.
- Radius 0 except round icon buttons and distance badges. Borders 1px. Inputs rgba(18,16,14,.3), hover/focus #12100E.

### Buttons and links

- Nav/text links: Halvar 500 10px .2em upper, no underline, hit area +15px each side. Hover per-character roll: label twice as split chars; first copy leaves upward through a clip, second rises from translateY(100%). .6s cubic-bezier(.7,0,.4,1), 16ms per char.
- Burger: 2 lines 1px × 60px, 3px gap. Hover: each line slides right 100%+7px while a copy enters from left (loop). Delays 0/.12s hover, .08s return.
- Round icon button 30×30, pseudo fills scale ×1.0667 on hover .4s cubic-bezier(.7,0,.4,1). Scroll-down arrow fill #BDB6A9 on dark. Favourites heart #12100E on light, light on dark; drop-shadow 0 10px 6px rgba(18,16,14,.15).
- Form button 330×90 #12100E; label top-left 20px padding (Halvar 500 10px #F7F2E8), circled arrow bottom-right. Fill transition 600–800ms cubic-bezier(.7,0,.4,1).
- Inputs 330×70, two side by side no gap, 1px rgba(18,16,14,.3); floating label Halvar 500 8px .2em at 20px left, v-centred. Checkbox 20×20.
- Plain links/buttons .4s cubic-bezier(.25,.74,.22,.99).

### Motion tokens

| Name                                                                                                                                                                            | Value                                                     | Use                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| easeOut (house)                                                                                                                                                                 | cubic-bezier(.25,.74,.22,.99)                             | links .4s, header .8s, text/image reveals 1.6s                                                                                 |
| easeInOut                                                                                                                                                                       | cubic-bezier(.7,0,.4,1)                                   | load intro 1.6s + .4s delay, char roll .6s, button fills .6–.8s, line scale .4s, clip-up/down 1.6s in / .8s out, text-clip .8s |
| easeIn (exit)                                                                                                                                                                   | cubic-bezier(.47,.04,.5,-.06)                             | blur-out, tabs-out                                                                                                             |
| JS defaults                                                                                                                                                                     | easeInOut [.55,0,.1,1], subtle [.25,.1,.25,1]             |                                                                                                                                |
| Carousel                                                                                                                                                                        | cubic-bezier(.6,0,.1,1) 1000ms; drag release easeOutQuint |                                                                                                                                |
| Scroll easings                                                                                                                                                                  | 2t−t², t², easeInOutQuad                                  | scrubbed                                                                                                                       |
| JS durations: fast .2, normal .4, slow .8, block 1.4, title .7, text .7, text stagger 40ms, title stagger 10ms. Reduced motion only checked for accordion (no global override). |

## 2. Header and fixed UI

Header fixed 50px (40 mobile, 66 at 2400+), 20px sides. Left: burger 60×5, then "ВЫБРАТЬ КВАРТИРУ" at x=144. Right: phone, "ОСТАВИТЬ ЗАЯВКУ", 35px gap. Centre: logo SVG 200×20.

- y=0: no background, logo opacity 0 (hero wordmark stands in).
- Logo scrubbed opacity 0→1 over 18svh→23svh. Mobile: left phone fades 1→0 over 13→18svh, logo takes its place.
- Collapse after scroll (collapsed by y=150): background slides translateY(−102%)→0; backdrop-filter blur(5px); bg hsla(40,48%,94%,.01); box-shadow 0 0 0 1px line colour (line-alt on dark); .8s house easeOut.
- Theme switching: 30 `data-themed-class` markers → ui-darker/dark/light/dark-alt on header and fixed buttons depending on section underneath.
- Never hides on scroll.
  Fixed buttons: hero scroll-down arrow 30×30 bottom-left 20px (belongs to hero). Favourites heart 30×30 bottom-right 20px, fixed, themed, counter badge. Fade in after load .8s cubic-bezier(.7,0,.4,1) .4s delay.

## 3. Sections at 1440×900

| #                               | Section    | Top px | Height             | vh   | Theme               |
| ------------------------------- | ---------- | ------ | ------------------ | ---- | ------------------- |
| S0                              | Hero       | 0      | 1350 (sticky 1800) | 1.5  | dark gradient       |
| S1                              | Facade     | 0      | 6914               | 7.68 | dark                |
| S2                              | Окна       | 6914   | 1143               | 1.27 | light, z 2          |
| S3                              | Место      | 7156   | 7650               | 8.5  | mixed               |
| S4                              | Территория | 12556  | 5744               | 6.38 | dark→light          |
| S5                              | Квартиры   | 17400  | 6092               | 6.77 | dark photos         |
| S6                              | Лобби      | 21693  | 4790               | 5.32 | dark + light middle |
| S7                              | Сервис     | 27382  | 2862 (sticky 3762) | 3.18 | #BDB6A9             |
| S8                              | Инженерия  | 30243  | 1072               | 1.19 | #75736D             |
| S9                              | Паркинг    | 30415  | 1800 (sticky 3600) | 2    | dark photo          |
| S10                             | Form       | 33115  | 945                | 1.05 | #BDB6A9             |
| F                               | Footer     | 34060  | 411                | .46  | #F7F2E8             |
| Scroll limit 33,525px (~37 vh). |

### S0 Hero (01-hero-load-b, 02-hero-scroll-300)

Left 2/3 (x 0–960) dark gradient: wordmark SVG x=120, 720 wide, top y=180, 72 tall. Portrait video tile 240×320 (16.667vw, .75) centred under wordmark x 360–600, y 225–545, overlapping wordmark by 1.85vw, muted loop. Tagline (text-small #BDB6A9 centred) y≈620–655, 80px below tile.
Right 1/3: S1 render panel through clip inset(0 0 0 66.66%); render bottom-right anchored, scale .77, shifted 5.3% right. Grid lines x=479, 960 (rgba(247,242,232,.1)); second = panel edge.
Load (after preloader hides ~3.0s): panel clip inset(0 0 0 100%)→66.66% 1.6s cubic-bezier(.7,0,.4,1) .4s delay; video tile clip inset(100% 0 0 0)+translateY(5%)→none same; wordmark glyphs opacity 0→1 translateY(100%)→0 in own masks 1.6s easeOut 50ms/glyph; tagline chars same 1.6s easeOut .8s delay +10ms/char; header+buttons opacity .8s .4s delay; mobile bg height 100svh→119.44vw 1.6s.
Scroll scene y 0→900 desktop (snap): panel clip left 66.66%→0 easeOutQuad (46.2% at 150, 29.6 at 300, 16.6 at 450, 7.4 at 600, 1.8 at 750, 0 at 900). Render translateX(5.3%) scale(.77)→none easeOutQuad origin 120% 100% (scale .840,.898,.943,.974,.994,1). Wordmark glyph i (0–8) translateY 0→−(50+75i)% per vh linear unclamped, clipped per glyph → staircase lift. Hero row translateX 0→−7.29% per vh linear. Tagline and video slide under panel.

### S1 Facade (03–07)

S1a intro panel (sticky 3052px): once full (y≥900) centred lead 30/30 #BDB6A9 600 wide, top ≈120; threshold 90svh enter "text"/leave "text-out": each line blur(20px)+opacity 0+translateY(100%+word margin)→sharp 1.6s easeOut +40ms/line, reversible. Two grid lines x 359/1080 draw in (one from top, one from bottom) scaleY 0→1 .8s cubic-bezier(.7,0,.4,1). Full-width render below (object-position 50% 100%). Exit: sticky content translateY 0→50svh easeOutQuad between −150% and −250% (sinks at half speed under next block).
S1b Фасад (dark, top 3052, 1432 tall): bg image ±10% parallax. Giant word letters one div each, flex space-between across 1400px, first/last nudged −.05em. Three crops 440×523 (.84) in 480 cells, 180 below title; each image 120% of frame sliding 0→−overflow as frame crosses viewport (progress=(top+h)/(vh+h)). Large lead 45/45 #F7F2E8 700 wide at x=20, 60 below images; small 16/20 text cols 9–11. Grid lines 1/3, 2/3.
S1c architect card (sticky 2880): bg close-up 1440×1768 scrolls translateY 0→−868 through frame. Card #F7F2E8 600×600 cols 7–11, normal flow, scrolls over pinned image; padding 20; credit small-t #75736D top-left; lead 30/30 #12100E; B/W portrait 222×279 bottom-right "image-in" (blur 20px + opacity 0→0 blur, 1.6s). Header → light theme over card.
S1d day/night (1440×1350; sticky mobile only): day render full-bleed, centred lead 30/30 #F7F2E8 drifting 15svh→−5svh, line reveal at 80-0. Night render opacity 0→1 linear between section top at viewport top and section bottom at viewport bottom (0 at 5500, .41 at 5750, .97 at 6000). Under-scroll: block −50svh→0 entering (easeOutQuad), 0→100svh leaving (easeInQuad). One grid line 50%.

### S2 Окна (07, 08)

Light #F7F2E8, z 2, 20 sides, 240 top. Word in secondary #BDB6A9, space-between; scrubbed while section top travels bottom→top (~900px) easeOutQuad; offsets→0: О +20vw, К +10vw, Н −10vw, А −20vw (bunched to centre → spread). Panoramic video window 1400×361 (3.88), 40 below title; inner 1.83 Vimeo at top 50% translateY(−60%) ±10% parallax. Paragraph 16/20 centred, 240 bottom. One grid line 50% draws in.

### S3 Место (09–12)

Four stacked sticky scenes share a pinned bottom title "М Е С Т О" at y=810 (vh−90). Each scene has its own copy in its own colour (beige on dark photo, #12100E on light layer, beige on dark-beige) clipped per scene → word recolours exactly at wipe edge.

1. Intro photo revealed as S2 scrolls up: full-bleed street render bg parallax; centred paragraph 16/20 #F7F2E8 cols 5–8 lower third drifting 5svh→−5svh over 2 vh; two alt grid lines.
2. Light layer #BDB6A9: left image 440×524 −150svh→0→200svh→250svh; centre lead 30/30 #12100E 0→50svh−50%→100svh−100%; right image translateY(100%)→0 — opposite directions. 960×580 blurred leaf-shadow PNG drifting on keyframes. Lines 1/3, 2/3.
3. Cards A: label small centred y≈155; three cards 440×240 (1.83) at x 20/500/980, y≈330. Card: full image; bottom 65px strip with 25px circular minutes badge (Halvar 10 #75736D on #F7F2E8), "МИН", place name right (Garamond 16 #F7F2E8). Reveal clip inset(100% 0 0 0)→0 1.6s at −200-0; leave .8s.
4. Cards B (#75736D) slides up over A; same layout. Then the dark layer with its title slides off with 50svh eased hand-off revealing map.
5. Map (#F7F2E8 sticky 3600): SVG plan, beige roads, 8px Halvar labels, circled M metro, numbered POI dots 25px dark-beige with light digits, building marker black square with logo glyph; layer drifts 20svh→−20svh.

### S4 Территория (13–15)

Intro 1440×1080 photo overlapping previous by 150svh (rises over map). Word (10 letters #F7F2E8) wrapper translateY 25svh→0 easeOutQuad. Doors from −150% to −250% (1 vh, easeInQuad): clip polygon(0 0,100% 0,100% 100%,50% 100%,50% 0,50% 0,50% 100%,0 100%) → polygon(0 0,100% 0,100% 100%,100% 100%,100% 0,0 0,0 100%,0 100%): photo splits at centre, halves retract to edges revealing light content (gap 50.5/49.5% → 55.3/44.7 → 65.1/34.9 → 79.7/20.3 → 99.3/0.7). Letters fly outward in sync: −37.5,−32.5,−27.5,−22.5,−17.5,−7.5 | +22.5,+27.5,+32.5,+37.5 vw.
Content (#F7F2E8 4394px): three lines 25/50/75%. Large lead 45/45 #75736D cols 1–7, 120 top. Portrait slideshow 300×400 (20.833vw, .75) centred overlapping heading last line by −1.25em; auto 5s; blur(10px)+opacity 0→clear 1.4s, outgoing blurs out 1.4s; light gradient top-left. Centred paragraph. Wide image 1040×624 (9 cols, 1.67) left, caption cols 10–12 v-centred. Centred lead 30/30 #75736D in 6-col box, 240 vertical padding. Triple carousel. Leaf PNGs −12.5svh→0→25svh.

### S5 Квартиры (16–18)

Intro pinned dark photo: word + tagline (small, 120 below), centred. Letters fly ±32.5vw between −100% and −200%.
Middle (sticky ≥250svh, 4050): point-to-full iris clip inset(50svh 50% calc(100%−50svh) 50%)→inset(0 0 calc(100%−100svh) 0) easeInQuad over 1 vh. Photo translateY 0→−30% over 5 vh. Stats overlay two sets swapped by thresholds (set 1 enters −85% leaves −150%: "от 85 · label · до 515"; set 2 enters −150%: "от 3.5 · высота потолков · до 4.7"). Numbers h1 107px #F7F2E8 far left/right 20px from edges with tiny ОТ/ДО above; centre label small. 1px horizontal lines (line-alt) from label outward scaleX 0→1 .4s cubic-bezier(.7,0,.4,1). Numbers/labels swap: inner span ±140% in a clip .8s cubic-bezier(.7,0,.4,1); leave delay 200ms; set 2 enters 400ms delay. Bottom paragraph centred 120 from bottom.
Flats list (sticky photo bg translateY 0→−20%): right half label then five rows large lead 45px; rows 142 tall (padding 50/60), 1px line-alt top border, 15px ⊕/⊖ after text. Hover/active: left border text colour (vertical accent at x=720), icon ⊕→⊖ opacity .4s easeOut; caption in left half swaps with blur in/out. 1px vertical line 50%.

### S6 Лобби (19, 20)

Intro dark photo 110svh: label small centred 120 top; letters −25,−20,0,+15,+20vw linear −100%→−200%.
Middle light: centre-out strip wipe clip inset(0 50%)→inset(0) easeInQuad over 1 vh; strip opens at centre line showing light content while dark photo stays on both sides; then 50svh eased drift. Content: centred lead 30/30 #75736D 640 wide, triple carousel, paragraph cols 7–9. Three lines. Deco image (25vw right) drifts 0→12.5→37.5svh.
Bottom: two pinned photo scenes 100svh each, 1px vertical line 50%; lead 30/30 #F7F2E8 top-left (cols 1–5) in first, bottom-right (cols 7–11) in second; each drifts 25svh→−25svh over 2 vh.

### S7 Сервис (21, 22; #BDB6A9)

Pinned layer eases in translateY −50svh→0 over 50svh (easeInQuad). Top-left lead 30/30 #12100E (cols 1–5); bottom word h1 #12100E; one line 50%; two leaf PNGs. Window expand: dark photo window centred 720×335 (clip inset(31.4% 25vw)) → full; image scale .85→1 then →1.15; easeInOutQuad ~1 vh (31.4%/360 → 28.1/322 → 18.6/213 → 6.7/76 → .7/8 → 0). When full: four columns divided by three alt lines (draw in), centred labels small #F7F2E8, lead 30/30 bottom-left; fade 0→1 easeInOutQuad; pointer events after 75%.

### S8 Инженерия (23, 24; #75736D)

Word h1 #BDB6A9 staircase: letter i from translateY((i+1)×2vw) → 0 between section top at viewport bottom and at 25% viewport, easeInQuad; container clip-path inset(-.2em -.1em). Centred lead 30/30 #F7F2E8 610 wide, 240 vertical padding. Four feature columns 360 each: small label top, 16/20 body 130 lower; 1px line-alt dividers clip-down 1.6s, group stagger 180ms. Deco PNG ±50% parallax.

### S9 Паркинг (25, 26)

Pinned garage photo parallax 0→−20% over 3 vh. 1px vertical line 50% scaleY 0→1 between −80% and 200-100. Word pinned at top (120 down), staircase 2vw…14vw→0. Small centred paragraph toggles at −75%/−125%. Three text blocks alternating sides (cols 1–5, 7–11, 1–5): "94" (h2 60 #BDB6A9) + lead; lead; lead. Each line-reveals at 100-50, fades 1→0 between 50-0 and 25-0; last two slide translateY(20svh)→0.

### S10 Form (27; #BDB6A9, 945)

Left half photo 300×384 (20.833vw, .78) centred, internal parallax; leaf PNG 29.17vw ±10svh. Right half (30 padding): centred lead 30/30 #12100E; two inputs 330×70 side by side; consent checkbox 13px; black button 330×90. Line 50%. Footer overlaps form by 5svh.

### Footer (28; #F7F2E8, 411)

Top-left "ОФИС ПРОДАЖ" small, phone/address/hours small-t 13/15. Top-right "ДОКУМЕНТЫ". Top-centre round up-arrow 30×30 outline. Centre logo 300×30 + tagline small #75736D. Bottom row copyright/credits 8px small-xs. Footer rises translateY 5svh→0.

## 4. Animation catalogue

| #                                                                                                                             | What                    | Trigger                 | Change                                     | Timing                              | Distance      |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------- | ------------------------------------------ | ----------------------------------- | ------------- |
| A1                                                                                                                            | Render panel            | load                    | clip 100%→66.66%                           | 1.6s (.7,0,.4,1) .4s delay          |               |
| A2                                                                                                                            | Hero video tile         | load                    | clip from bottom + translateY 5%→0         | same                                |               |
| A3                                                                                                                            | Wordmark glyphs         | load                    | rise out of masks                          | 1.6s easeOut 50ms/glyph             |               |
| A4                                                                                                                            | Tagline chars           | load                    | rise                                       | 1.6s easeOut .8s + 10ms/char        |               |
| A5                                                                                                                            | Panel expand + zoom     | scrub                   | clip 66.66%→0; scale .77→1                 | easeOutQuad                         | 1 vh snapped  |
| A6                                                                                                                            | Wordmark peel           | scrub                   | glyph i −(50+75i)%/vh                      | linear                              |               |
| A7                                                                                                                            | Hero row drift          | scrub                   | −7.29%/vh                                  | linear                              |               |
| A8                                                                                                                            | Header logo             | scrub                   | opacity 0→1                                | linear                              | 18→23svh      |
| A9                                                                                                                            | Header collapse         | scroll                  | frosted bg slides in                       | .8s easeOut                         |               |
| A10                                                                                                                           | Header theme            | section                 | colour switch                              | .4s                                 |               |
| A11                                                                                                                           | Blur-by-lines text      | threshold               | blur 20→0, opacity, translateY 100%→0      | 1.6s easeOut +40ms/line, reversible |               |
| A12                                                                                                                           | image-in                | entry                   | blur 20→0, opacity                         | 1.6s                                |               |
| A13                                                                                                                           | Grid lines draw         | threshold               | scaleY 0→1 alternating origin              | .8s (.7,0,.4,1) reversible          |               |
| A14                                                                                                                           | Окна converge           | scrub                   | ±10/±20vw→0                                | easeOutQuad                         | ~1 vh         |
| A15                                                                                                                           | Explode words           | scrub                   | 0→±7.5…±37.5vw                             | easeInQuad                          | 1 vh          |
| A16                                                                                                                           | Staircase rise          | scrub                   | (i+1)×2vw→0 in mask                        | easeInQuad                          | .75–1 vh      |
| A17                                                                                                                           | Pinned title recolour   | sticky + clipped copies |                                            |                                     | ~4.5 vh       |
| A18                                                                                                                           | Doors                   | scrub                   | polygon centre→edges                       | easeInQuad                          | 1 vh          |
| A19                                                                                                                           | Iris                    | scrub                   | inset(50svh 50%)→0                         | easeInQuad                          | 1 vh          |
| A20                                                                                                                           | Centre strip            | scrub                   | inset(0 50%)→0                             | easeInQuad                          | 1 vh          |
| A21                                                                                                                           | Window expand           | scrub                   | inset(31.4% 25vw)→0; img .85→1→1.15        | easeInOutQuad                       | ~1 vh (+1.75) |
| A22                                                                                                                           | Card bg scroll-through  | scrub                   | 0→−(imgH−vh)                               | linear                              | section       |
| A23                                                                                                                           | Day→night               | scrub                   | opacity 0→1                                | linear                              | ~1 vh         |
| A24                                                                                                                           | Section under-scroll    | scrub                   | −50svh→0 in, 0→100svh out                  | easeOut/InQuad                      | 1 vh each     |
| A25                                                                                                                           | Pin hand-off            | scrub                   | 0↔50svh                                    | easeOut/InQuad                      | 50svh         |
| A26                                                                                                                           | Opposite images         | scrub                   | left −150→+250svh, right 100%→0, text down | linear                              | 2–2.5 vh      |
| A27                                                                                                                           | Bg parallax             | scrub                   | ±10–20% on 120% images                     | linear                              |               |
| A28                                                                                                                           | Image internal parallax | scroll                  | 120% image slides 0→−overflow              | rAF                                 |               |
| A29                                                                                                                           | Location cards          | threshold               | clip from bottom                           | 1.6s in/.8s out                     |               |
| A30                                                                                                                           | Stat lines              | threshold               | scaleX from label                          | .4s (.7,0,.4,1)                     |               |
| A31                                                                                                                           | Stat swap               | threshold               | span ±140% in clip                         | .8s (.7,0,.4,1); 200/400ms          |               |
| A32                                                                                                                           | Slideshow               | 5s timer                | blur 10px in/out                           | 1.4s                                |               |
| A33                                                                                                                           | List hover              | hover                   | left border, ⊕→⊖, caption blur swap        | .4s                                 |               |
| A34                                                                                                                           | Triple carousel         | click/drag              | one slide; 120% images internal parallax   | (.6,0,.1,1) 1000ms                  |               |
| A35                                                                                                                           | Carousel cursor         | hover                   | 30px arrow follows pointer                 | .4s fade                            |               |
| A36                                                                                                                           | Nav hover               | hover                   | per-char roll                              | .6s (.7,0,.4,1) 16ms/char           |               |
| A37                                                                                                                           | Round btn hover         | hover                   | ×1.0667                                    | .4s                                 |               |
| A38                                                                                                                           | Burger hover            | hover                   | lines slide right, looping copy            | .4s, .08/.12s                       |               |
| A39                                                                                                                           | Dividers                | reveal                  | clip top-down                              | 1.6s                                |               |
| A40                                                                                                                           | Parking texts           | threshold+scrub         | line reveal then fade                      | 1.6s / scrub                        |               |
| A41                                                                                                                           | Leaf decos              | scrub                   | ±12.5–37.5svh                              |                                     |               |
| A42                                                                                                                           | Footer                  | scrub                   | 5svh→0                                     | linear                              | 1 vh          |
| A43                                                                                                                           | Hero snap               | wheel                   | 0↔100svh                                   | lerp, 2s                            | ≥1/5 vh       |
| Triple carousel: 3 per view, centred, looping; centre slide 483×666 (.725) between grid lines; sides cropped at screen edges. |

## 5. Mobile 390×844 (m01–m06)

Global: unit 10, side 15, 6 cols × 65. Header 40: phone left cross-fading to logo after ~150px, phone icon + 60px burger right, no "Выбрать квартиру". Reveal plugin and most scroll patterns off (inferred). Native touch scroll.
Type: h1 30/30, lead-lg 22/22, lead 18/20, body 13/15, small 9/16 .2em, small-t 12/14.
Heights px (vh/844): S0 466 (.55), S1 4555 (5.4), S2 569, S3 7385 (8.75), S4 2846, S5 5803, S6 3463, S7 2110, S8 844, S9 922, S10 844. Total ~24,343.

- Hero: height 119.44vw; wordmark 260 (66.7vw) top ≈116; tile 130×174 (33.33vw); tagline centred; one line 50%; no side panel — render follows as full-width image; scroll arrow moves into facade block.
- Facade: render full-bleed 100svh; word 30px, three lines; crops 100×144 in 2-col cells; lead-lg 22 full width; small text cols 3–6; card full width 360×424; day/night sticky crossfade.
- Окна: title 360 wide; video window 2.125; inner translateY −50%.
- Место: title pinned at top under header (separate mobile copy); light layer one image at a time (165×229); location cards → rows (name, minutes left; 180×106 image right; 1px top borders).
- Территория: no doors; plain 100svh photo static title; slideshow 260×347; carousels native horizontal scrollers ~325×449 with next peeking.
- Квартиры: title on photo; stat lines vertical; flats list one-open accordion.
- Лобби: title slides −40px→0 as it pins; strip wipe present (inferred); bottom leads stack.
- Сервис: clip inset(34.8% 15px)→0, scale .666→1→1.501; labels 2×2 grid (cell 180/130, 1px top borders); lead at top.
- Инженерия: cards horizontal swipe; staircase stays.
- Паркинг: not sticky; texts stack.
- Form: left image hidden; full-width form/button.
- Footer: logo 180; up button under logo; bottom links with top border.

## 6. Not measured

Carousel live timing; Окна Vimeo; map tooltips; exact header collapse threshold.
