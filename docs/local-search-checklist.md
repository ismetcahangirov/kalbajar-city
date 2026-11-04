# Local search and measurement: owner checklist

What the site does in code for local search, AI answer engines and analytics
(#29), and the steps only the owner can take, because they need the owner's
Google, Meta and Microsoft accounts.

## What the site already does

- **One source of truth.** The name, phones, e-mail, address, office hours and
  coordinates come from the console settings (`/admin/ayarlar`). The contact
  page, the structured data (`ApartmentComplex`, `Organization`), the
  about page's facts block and `llms.txt` all read them from there. Change a
  value once, in the console, and every place follows.
- **No stand-ins for machines.** The seeded stand-ins (the town as the
  address, approximate coordinates, sample hours and e-mail) show on the pages
  until replaced, as decided, but the geo meta, the structured data and
  `llms.txt` leave them out: search indexes, map pins and AI answers would
  repeat them long after a correction. A value reaches them as soon as it is
  saved in the console or its stand-in flag is confirmed there.
- **Geo meta.** Every public page carries `geo.region` (`AZ-KAL`) and
  `geo.placename`; `geo.position` and `ICBM` appear once real coordinates are
  set.
- **`llms.txt`.** `/llms.txt` (English) and `/llms-az.txt` (Azerbaijani) are
  generated on each request from the database: the same fact sentences as the
  about page, the contacts, the pages and the published FAQ.
- **robots.txt** allows search engines and AI answer crawlers (Googlebot,
  Bingbot, OAI-SearchBot, PerplexityBot, Claude-SearchBot and others) and keeps
  every crawler out of `/admin` and `/api`.
- **Analytics.** GA4 and the Meta Pixel load only once their IDs are saved in
  `/admin/ayarlar/analitika`, and only when the browser is idle after the page
  has loaded, so they never delay the first paint
  (`tests/e2e/analytics.spec.ts` checks that both start after the load event
  and the LCP). The privacy notice then names both services automatically.
- **Server-rendered.** Every primary page's main content is in the first HTML
  response, which is what many crawlers read (`tests/e2e/server-rendered.spec.ts`).

## Google Business Profile

Do these in [Google Business Profile](https://business.google.com) with the
account that will own the listing.

1. **Name**: exactly `Kalbajar City`, the same as the site and Instagram. No
   keywords or slogans in the name; Google suspends listings for that.
2. **Category**: primary `Housing development`; secondary `Real estate
developer` (or `Apartment complex` once residents move in).
3. **Address and pin**: the same address as in `/admin/ayarlar` → contacts.
   If the sales office is elsewhere, list the sales office and set the pin on
   it. Then enter the confirmed coordinates in the console too, so the site's
   map and geo meta match the pin.
4. **Phone**: the main line, `+994 12 434 32 32`, the first phone in the
   console. Use the same number on Instagram.
5. **Website link with UTM**, so visits from the listing are counted apart in
   GA4 and in the leads module:
   `https://kalbajarcity.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp`
   For the appointment link, use the contact page's viewing form:
   `https://kalbajarcity.com/elaqe?utm_source=google&utm_medium=organic&utm_campaign=gbp#baxis`
6. **Hours**: the same office hours as in the console.
7. **Description**: two or three plain sentences from the about page's facts
   block, so the listing and the site say the same thing.
8. **Photos**: real photos only: exterior, entrance, courtyard, a finished
   apartment, construction progress, the sales office, plus the logo and a
   cover image. Never generated images (CLAUDE.md → Imagery). Add new
   construction photos monthly.
9. **Verification**: Google sends a code by post, phone or video. Keep the
   listing unchanged until it is verified.
10. **After verification**: answer reviews, add the FAQ as Q&A, and post
    construction updates. Check that Instagram's bio, phone and address match.

## Search Console and Bing Webmaster Tools

Verification needs the owner's accounts and access to the domain's DNS, so it
is not done in code.

1. [Google Search Console](https://search.google.com/search-console): add a
   **Domain** property for `kalbajarcity.com` and verify it with the DNS TXT
   record Google shows. Then submit `https://kalbajarcity.com/sitemap.xml`.
2. [Bing Webmaster Tools](https://www.bing.com/webmasters): import the site
   from Search Console (quickest), or verify with a DNS record. Submit the same
   sitemap. Bing's index also feeds several AI assistants.
3. Link Search Console to the GA4 property (GA4 → Admin → Product links).

## GA4 and Meta Pixel

1. Create a GA4 property and a web data stream for `https://kalbajarcity.com`;
   copy the measurement ID (`G-…`).
2. Create a Meta Pixel in Events Manager; copy its numeric ID.
3. Paste both into `/admin/ayarlar/analitika` and save. An ID in the wrong
   format is ignored rather than loaded.
4. In GA4, mark `generate_lead` as a key event. The site also sends
   `click_call` and `click_whatsapp`; the Pixel receives them as `Lead` and
   `Contact`.
