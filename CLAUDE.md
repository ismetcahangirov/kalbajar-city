# Contributing to Kalbajar City

Rules for anyone — human or agent — working in this repository. They are not
suggestions. A change that violates them should be rejected in review even if
the code is otherwise correct.

The product and architecture are specified in
`docs/superpowers/specs/2026-11-01-kalbajar-city-design.md`. Read it first.

---

## 1. Git workflow

**Every task follows this sequence. No exceptions.**

```bash
# 1. Start from an up-to-date main. Always.
git checkout main
git pull origin main

# 2. Branch. Never commit to main directly.
git checkout -b <type>/<short-description>

# 3. Work, committing in logical units.

# 4. Push and open a pull request.
git push -u origin <branch>
gh pr create --base main --title "..." --body "..."

# 5. Add labels. Every pull request carries a type, an area and a priority.

# 6. Merge only when CI is green.
```

### Branch naming

`<type>/<kebab-case-description>`

| Type        | Use for                                |
| ----------- | -------------------------------------- |
| `feat/`     | New capability                         |
| `fix/`      | Bug fix                                |
| `chore/`    | Tooling, config, dependencies          |
| `docs/`     | Documentation only                     |
| `refactor/` | Restructuring with no behaviour change |
| `test/`     | Test coverage                          |
| `perf/`     | Performance work                       |

Good: `feat/apartment-catalogue-filters`, `fix/hero-video-cls`
Bad: `new-stuff`, `ismet-branch`, `fix2`, `patch-1`

Keep it under about fifty characters.

### Commits

Conventional Commits, in English:

```
<type>(<scope>): <subject in the imperative>

<body: what changed and why, wrapped at 72 columns>
```

- **English only** in commits, pull requests, issues, code, comments and docs.
  User-facing copy is the exception: it lives in the message catalogues
  (`az`, `en`, `ru`) and in the database
- Imperative subject: "add", not "added" or "adds"
- No period at the end of the subject
- Explain **why** in the body. What changed is visible in the diff
- Never use `--no-verify`. If a hook fails, fix the cause

### Pull requests

Every pull request must:

1. Link its issue — `Closes #123`, or `Part of #123` for partial work
2. Carry a `type:` label, at least one `area:` label and a `priority:` label
3. Pass CI
4. Describe what was verified, with the commands that were run
5. For UI changes, include screenshots at 390 px and 1440 px

State what you did **not** do, and why. A pull request that hides a gap is
worse than one that names it.

### Merging

- Merge only when CI is green. A red pipeline is never merged, never bypassed
- Squash merge, so `main` stays readable
- Delete the branch after merge
- If CI fails, fix the cause. Do not disable the check or skip the test

`CI complete` is the single required status check. `ci.yml` skips jobs a change
does not concern, and a required check that never runs is reported as pending,
so requiring individual jobs would leave pull requests unmergeable. `CI complete`
always runs, waits for the rest, and fails if any job that had work to do did
not succeed. Anyone adding a job that should block a merge adds it to
`ci-complete`'s `needs` **and** to the list its script checks.

**`main` has no branch protection.** The repository is private on a free
GitHub plan, where protection and rulesets are unavailable (HTTP 403), and it
must stay private because it carries a commercially licensed typeface. Until
the owner moves it to GitHub Pro, the rules above are enforced by discipline:
nobody pushes to `main`, and nobody merges without a green `CI complete`.
Squash-only merging and branch deletion on merge are set in the repository
settings. When protection becomes available, require `CI complete`, an
up-to-date branch and resolved conversations, with zero approving reviews
while there is a single maintainer.

---

## 2. Working with issues

Work is tracked as epics with native sub-issues.

- Pick a sub-issue, not an epic
- One sub-issue, one branch, one pull request
- **Do not open issues for small things.** A small task is a checklist item in
  the issue it belongs to. Open a new issue only for work that deserves its own
  pull request
- If the work grows beyond the issue, split it rather than expanding the pull
  request
- Issues labelled `status: needs-decision` wait for the owner. Build what does
  not depend on the answer; do not invent the answer

---

## 3. Product constraints

### Languages and URLs

- Azerbaijani is the default locale and is served **without** a prefix.
  English and Russian are served under `/en` and `/ru`
- **Route segments are Azerbaijani in every locale**: `/menziller`,
  `/en/menziller`, `/ru/menziller`. Never add an English route segment to the
  public site or the console. API paths stay English (`/api/v1/*`)
- No user-facing string is hard-coded. It comes from the message catalogue or
  from a translatable database field with `az`, `en` and `ru` values
- Missing `en`/`ru` content falls back to `az` and is flagged in the console
- Public links use `Link`, `redirect` and `getPathname` from
  `@/i18n/navigation`, never `next/link` with a hand-built path. A new public
  route is added to `pathnames` in `src/i18n/routing.ts`; a unit test fails
  until it is
- Numbers, areas and phone numbers are formatted with `@/i18n/format`
  (Azerbaijani groups thousands with a space: `22 634 m²`); dates use
  next-intl's formatter with the presets defined there

### Design

Public-site design is based on the **`kalbajar-design`** skill
(`.claude/skills/kalbajar-design/SKILL.md`): use it for any UI or motion work.
It links the two canonical documents, `docs/ui-kit.md` (colour, type, spacing,
components) and `docs/motion-system.md` (motion rules, primitives, budgets).
Read both before touching UI.

- **Every colour, radius, shadow and duration comes from a token.** A hex
  literal in a component is a review failure
- **Alethia Next** is the only display and text face on public pages. At most
  four weights ship (Light, Regular, Medium, Italic). The console uses the
  system font stack
- **One scroll-entry animation** everywhere. A second is a design change
- Animate only `transform`, `opacity` and `clip-path`
- Forms and the inquiry flow do not animate
- `prefers-reduced-motion` is mandatory, not a nice-to-have
- The Pinterest reference is a vocabulary, not a template. Never copy its
  colours, copy or proportions

### Imagery

- Real photos, renders and video of the complex come from the owner
- When an image is missing, it may be generated (ChatGPT image generation in
  the maintainer's browser). Generated images are **atmosphere only** —
  landscape, materials, interior mood. They never depict the complex, a
  specific apartment, a view from it, or an amenity that is not built, because
  on a property site that misleads a buyer
- A generated image is stored with `source: generated` in the media library and
  carries an "illustrative" caption wherever it could be read as the real thing
- Generated images are replaced as soon as real ones exist

### Responsiveness

- Every page works from 320 px to 1920 px with no horizontal scroll
- Touch targets are at least 44 × 44 px
- The console is fully usable on a phone

### Accessibility

- WCAG 2.2 AA. Contrast failures are build errors, not warnings
- Icon-only controls need an accessible name
- Colour alone never carries meaning
- Focus is visible on every interactive element

---

## 4. Code standards

### TypeScript

- `strict` and `noUncheckedIndexedAccess` are on. Do not weaken them
- No `any`. Use `unknown` and narrow it
- zod schemas validate every request body, query string and form at the boundary

### Data and state

- Public pages are React Server Components and read data on the server.
  HTML arrives complete; do not stream the main content behind `<Suspense>`
- A component that reads the database starts with `await connection()`, so the
  build never needs a database
- A page that needs request-time data (route params without
  `generateStaticParams`, the database) exports `instant = false`, so it
  renders per request and is sent complete instead of streaming
- Client-side data goes through RTK Query: one `baseApi` in `src/store/api.ts`,
  endpoints added per feature with `injectEndpoints`. No ad-hoc `fetch` in
  components (lint enforces it)
- Every `/api/v1/*` route is built with `handler()` from `@/lib/api/handler`:
  zod schemas for params, query and body (shared ones in `src/shared`), the
  session check, and the one error shape
- Admin writes invalidate both the RTK Query tags and the server `cacheTag`s
  they affect, the latter through `revalidatePublic()` from
  `@/lib/cache/revalidate`, so the next request shows the change
- Every schema change is a versioned migration
- Every privileged write is audited: `audit()` from `@/lib/audit`, in the
  transaction that makes the write
- Console pages call `requireUser(permission)` from `@/lib/auth/session`;
  `/api/v1/admin/*` handlers pass the permission as `handler({ auth })`, which
  calls `authorize(request, permission)`. `proxy.ts` only
  checks that a session cookie exists; it is not the access check. Roles and
  their permissions live in one matrix, `src/lib/auth/permissions.ts`

### Money and area

- Prices are stored as integers in the minor unit (qəpik) with a currency code,
  never as floats. They cross the API as strings
- Areas are stored as `numeric(8,2)` and formatted per locale

---

## 5. Performance budgets

| Metric                                      | Budget                                 |
| ------------------------------------------- | -------------------------------------- |
| Lighthouse Performance (local, median of 3) | 93+                                    |
| LCP (live, mobile)                          | < 2.5 s                                |
| CLS                                         | < 0.05                                 |
| JS shared by every public route (gzip)      | < 190 KB                               |
| JS a public route adds to the shared (gzip) | < 40 KB                                |
| Hero video                                  | never the LCP element; poster image is |

A change that breaks a budget fixes it in the same pull request or does not
merge.

The JS budgets count the scripts a route's HTML loads on first view, each
chunk once, at `gzip -9`, read from the production build by
`pnpm budget:js` (`scripts/check-js-budget.mjs`, the `JS budget` job in CI).
**Shared** is what every public route loads: React, the Next runtime and the
locale layout's shell. A page cannot shed it and the browser caches it after
the first page, so it is budgeted once, for the site. **Per route** is what a
page adds on top: its own components. Code behind `next/dynamic` or
`import()` loads later and is not counted, which is why heavy, below-the-fold
islands (the inquiry form and its Redux store) are deferred. Lower the shared
budget when the shell gets lighter; never raise it to fit a change.

---

## 6. For agents

- Never commit to `main`
- Never claim something works without running it. "Typecheck passes" means you
  ran the typecheck and saw it pass
- Do not run `pnpm build` while a dev server is running in the same checkout
- Report what failed as plainly as what succeeded
- When a rule here conflicts with a habit, the rule wins
