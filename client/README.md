# PlayLoop client

React + Vite frontend for PlayLoop. This package holds the app shell, routing, design tokens and the
base components exported from the Figma handoff board, plus the developer feedback workspace.
Other screens remain placeholders.

- Figma file: [PlayLoop](https://www.figma.com/design/m8i4PGK6yx0PwGw3aVkSUG/PlayLoop)
- Handoff board: **Frontend handoff / Base components** (node `427:1491`)
- Extracted sources: **Frontend handoff / component sources** (node `426:1488`)

## Getting started

Install from the repository root (npm workspaces), then start the client:

```bash
npm install
npm run dev:client
```

The app runs on http://localhost:5173. Requests to `/api` are proxied to the server on
http://localhost:4000 (`npm run services:up` and `npm run dev` from the root), so the
`playloop_token` session cookie works without CORS setup. To point somewhere else, copy
`.env.example` to `.env` and set `VITE_API_BASE_URL`.

In development, every base component is rendered with sample content at
http://localhost:5173/dev/components. That route is not included in production builds.

| Script (root)          | Script (client) | What it does                     |
| ---------------------- | --------------- | -------------------------------- |
| `npm run dev:client`   | `npm run dev`   | Vite dev server                  |
| `npm run build:client` | `npm run build` | Production build to `dist/`      |
| `npm run test:client`  | `npm test`      | Vitest + Testing Library (jsdom) |
| `npm run lint:client`  | `npm run lint`  | ESLint (React Hooks + Refresh)   |
| `npm run format`       | -               | Prettier for the whole repo      |

## Structure

```
client/
├── index.html
├── vite.config.js            Vite, /api proxy, Vitest config
└── src/
    ├── main.jsx              Fonts, global styles, router
    ├── routes.jsx            Route map; each placeholder names its Figma frame
    ├── styles/
    │   ├── tokens.css        --playloop-* design tokens (from Figma variables)
    │   └── global.css        Reset and base element styles
    ├── components/
    │   ├── index.js          Barrel: import components from here
    │   ├── ui/               Small building blocks (buttons, fields, tags, avatar…)
    │   ├── cards/            Game cards, review row, recommendation, notice panel
    │   ├── review/           Review flow pieces (mission, reaction, timer, progress)
    │   ├── profile/          Profile header and badge list
    │   ├── admin/            Admin metric and report row
    │   └── layout/           AppLayout (sky, grid lines, nav) and MainNavigation
    ├── pages/                Auth and not-found pages
    ├── lib/                  api client, formatting, tag tones, cx helper
    ├── assets/               Brand marks, sky background, icons exported from Figma
    ├── dev/                  Component gallery and its sample images (dev only)
    └── test/setup.js
```

## Design tokens

`src/styles/tokens.css` defines every variable from the Figma collection with the same
`--playloop-*` names, so values can be checked against Figma one to one. Keep the names in sync
with Figma rather than renaming them. A few extra values used by the screens but not yet in Figma
are marked as **handoff supplements** (pink tag tone, compact button orange, grid line…).

Typography is exposed as font shorthands, one per Figma text style:

```css
.title {
  font: var(--playloop-type-card-title);
}
```

Fonts are self-hosted through Fontsource: **Kode Mono** (variable, 400–700) for all UI text and
**Palette Mosaic** for display headings.

Figma GLASS effects have no CSS equivalent. They are approximated with `backdrop-filter` tokens
(`--playloop-glass-soft`, `-panel`, `-frosted`), where a CSS blur is about half the Figma radius.

## Base components

Import from the barrel:

```jsx
import { Button, GameCard, Tag } from '../components/index.js';
```

| Component                       | Figma source                                 | Node                  |
| ------------------------------- | -------------------------------------------- | --------------------- |
| `PrimaryButton`                 | primary button                               | `196:134`             |
| `Button` (`accent`, `glass`)    | log in button                                | `196:120`             |
| `TextLink`                      | Handoff / Text link                          | `426:1519`            |
| `IconButton`                    | Handoff / Remove action                      | `426:1514`            |
| `TextField`                     | Profile / Field                              | `220:373`             |
| `Textarea`                      | Profile / Field multiline                    | `225:478`             |
| `SearchInput`                   | search bar                                   | `196:135`             |
| `Select`                        | Handoff / Select trigger                     | `426:1506`            |
| `Checkbox`, `CheckboxField`     | Handoff / Checkbox, Profile / Platform       | `426:1499`, `220:395` |
| `ChoiceChip`                    | wireframe / chip (legacy)                    | `356:1727`            |
| `Tag`, `ReactionTag`            | tag                                          | `196:123`             |
| `TabList`, `Tab`, `StatusBadge` | tab                                          | `196:131`             |
| `Keycap`                        | keycap                                       | `196:126`             |
| `Avatar`, `InitialAvatar`       | Profile / Portrait, Handoff / Initial avatar | `218:313`, `426:1605` |
| `AchievementBadge`              | Profile / Badge                              | `220:300`             |
| `Metric`                        | Profile / Metric                             | `220:287`             |
| `Thumbnail`                     | Frame 32                                     | `143:203`             |
| `BrandMark`                     | Handoff / Brand mark                         | `426:1641`            |
| `GlassPanel` (`card`, `panel`)  | surface/card and PlayLoop / panel            | -                     |
| `GameCard`                      | game title (catalog card)                    | `178:230`             |
| `GameCardGlass`                 | Game card / glass                            | `70:54`               |
| `Recommendation` (`tone`)       | Handoff / Recommendation                     | `426:1598`            |
| `ReviewCard`                    | Profile / Review                             | `220:377`             |
| `NoticePanel`                   | Handoff / Notice panel                       | `426:1588`            |
| `MissionCard`                   | Handoff / Mission                            | `426:1558`            |
| `ReactionEntry`                 | Handoff / Reaction entry                     | `426:1579`            |
| `Playtime`                      | Handoff / Playtime                           | `426:1526`            |
| `ReviewProgress`                | Handoff / Review progress                    | `426:1537`            |
| `MainNavigation`                | Handoff / Main navigation                    | `426:1616`            |
| `ProfileHeader`                 | Profile / Header                             | `220:336`             |
| `BadgeList`                     | Profile / Badges                             | `220:307`             |
| `AdminMetric`                   | Handoff / Admin metric                       | `426:1628`            |
| `ReportRow`                     | Handoff / Report row                         | `426:1636`            |
| `AppLayout`                     | sky background + glass grid lines            | `224:620`             |

### Conventions

- **Styling**: one CSS Module per component, values from tokens. No CSS framework.
- **Polymorphic elements**: `Button`, `PrimaryButton`, `TextLink`, `GameCard`, `Recommendation`,
  `ReportRow` and `GlassPanel` take `as`. Use `as={Link} to="/…"` from `react-router` when the
  element navigates, and keep `<button>` when it acts.
- **Content stays outside layout**: titles, covers, tags and counts are props. Tags are passed as
  `[{ label, tone }]`; `toneForGenre()` in `lib/tagTones.js` returns the tone the screens use for a
  genre.
- **Slots**: `ReviewCard`, `ProfileHeader` and `ReportRow` take an `action`/`status` element so
  pages decide what the link or badge does.
- **Accessibility**: real `<label>`, `<input>`, `<select>`, `<kbd>` and checkbox elements; icon-only
  controls require a `label`; tabs support arrow keys; progress uses `role="progressbar"`.
- **Assets**: use the exported files in `src/assets`. Do not redraw the logo or icons. Sample covers
  and the portrait in `src/dev/samples` are demo content only; real images come from the API.

## Talking to the API

```js
import { api, ApiError } from '../lib/api.js';

const game = await api.get(`/games/${gameId}`);
await api.post('/auth/login', { email, password });
```

Requests include credentials, send JSON, and throw `ApiError` (`status`, `code`, `message`,
`details`) for non-2xx responses, matching the `Error` schema in `docs/api`.

## Routes

`src/routes.jsx` maps every high-fidelity screen to its page. The admin area lives under `/admin`
(`src/features/admin`) with its own sidebar shell, and is shown only to accounts with the admin
role; the API enforces the role on every admin request.

## Playtest Roulette

`/roulette` is built from Figma `356:1636` (preferences) and `356:1690` (result) in
`src/features/roulette`.

- Genres take several values; platform, build stage and time take one each, as `POST
/roulette/spin` expects. Picking a chip again clears it, and no selection means everything.
- The API picks the game. The wheel artwork (which includes the pointer) turns two full rounds per
  spin for show and stays still with reduced motion.
- Spin again excludes the games already shown; Start playtest sends the spin token to
  `/roulette/accept` and opens the review flow.
- The chips are `ChoiceChip`, restyled to the hi-fi orange look of this frame.

## Profiles

| Route               | Screen                                           | Figma node           |
| ------------------- | ------------------------------------------------ | -------------------- |
| `/users/:username`  | Public profile, Published Games and Reviews tabs | `210:225`, `210:262` |
| `/settings/profile` | Edit profile                                     | `210:300`            |

- The tab is in the URL (`?tab=reviews`); both tabs load six at a time with Load more.
- The header shows the first link from the profile; Figma has room for one.
- Figma has three badge icons for the API's eight badges, so each badge uses the closest one
  (`BADGE_ICONS` in `ProfilePage.jsx`).
- Edit profile follows the API rather than Figma where they differ: the username is read-only and
  platforms are Web, PC, Mac and Mobile (no Console). Links have an editable label and URL.

## Game page and editor

| Route                    | Screen                                                       | Figma node |
| ------------------------ | ------------------------------------------------------------ | ---------- |
| `/games/:gameId`         | Public game page in the game's theme                         | `167:980`  |
| `/my-games/new`          | Name a new game; creates the draft                           | -          |
| `/my-games/:gameId/edit` | Game editor ("published game" frame is the editor)           | `257:515`  |
| `/my-games/:gameId`      | Redirects: drafts to the editor, published games to the page | -          |

- **Themes** (`features/games/gameTheme.js`): the background preset or uploaded image, accent and
  controls-card colours become the shell background and `--theme-*` variables through
  `usePageLook` (`components/layout/pageLook.js`). The game page and every review screen use them.
  Storm is the Figma game page; Overcast reuses the storm photo lightened and Night is a gradient,
  since Figma only has small thumbnails of those. Text colours are picked for contrast.
- **Editor:** drafts autosave two seconds after a change; a published game saves on Save changes,
  since the API requires it to stay complete. The publish bar mirrors the server's publish checklist.
  Media, background images and builds upload straight to storage (`lib/upload.js`, multipart for
  large builds). Locally, web builds stay "Processing" because the unzip Lambda is not running;
  use a web link instead.
- The game page adds a "Reviews & Discussion" link, which Figma does not have. The owner sees Edit
  game instead of Try our Game!

## Review flow

`/games/:gameId/review` is built from the **Review:** frames (`281:685` to `285:826`) in
`src/features/review`. `POST /games/:gameId/reviews` starts the review or resumes the reviewer's
draft at `currentStep`.

| Step                  | Screens                                                               |
| --------------------- | --------------------------------------------------------------------- |
| First Impression      | One question per screen; the last one's button is **Let's Play!**     |
| Playtest              | Missions, the game (web) or download setup + end-of-game screenshot   |
| Developer's questions | One question per screen, from the form's playtest questions           |
| Final Verdict         | Developer's farewell, intro, then four steps with corner-marked cards |
| Summary               | Every answer with an Edit link per section, then **Submit Review**    |

- **Leave** appears only where Figma shows it: on the last First Impression question, the last
  developer's question, the playtest and the summary. The review header's logo is not a link, so
  there is no other way out mid-section. `canLeave()` in `reviewModel.js` holds the rule.
- Answers are saved on every Next, so Leave offers "Save and leave" or "Discard review" (which
  deletes the draft). The leave confirmation is not designed and follows the form builder's prompt.
- Every question type the form builder offers can be answered. Picked options use the orange tag
  tone, as in Figma.
- Not designed and kept simple: the reaction picker's selected state (outlined), how a reaction
  picks its mission (the most recently accepted one), and the game page theme (the sky background is
  always used).

## Explore Games

`/` is built from Figma **browse games** (`47:27`) in `src/features/explore`:

- The hero reuses the auth lettering, roulette and floppy exports; only the glass blob
  (`assets/explore/hero-blob.svg`) is new. The lettering bobs as in the Figma motion (3 s, 26 px)
  unless reduced motion is on.
- The games panel reaches 100 px past the content column on each side, as in the 1512 px frame,
  so three 330 px cards fit next to the sidebar.
- Sort, search and filters live in the URL with the same names as `GET /games` (`sort`, `search`,
  `genre`, `platform`, `buildStage`, `page`), so a filtered view can be shared.
- The sidebar uses `GET /recommendations`, the signed-in user's `favoriteGenres` from `/me`
  ("Your Top Categories") and the option lists from `GET /meta`, falling back to the shared enums.
- The **Upcoming** tab is disabled: the API has no upcoming sort yet. Selected filter chips are
  outlined in their tag colour, since a selected chip is not designed.

## Open design questions

These come from the handoff board's "Still needing design decisions" list, plus gaps found while
building the components:

- Hover, pressed, disabled and loading states are not designed. Components only add a focus ring,
  50% opacity when disabled, and an underline on link hover.
- Field validation, success and empty states, and the open Select menu are not designed.
  `TextField` and `Textarea` accept `hint` and `error` with neutral placeholder styling.
- Mobile layouts and breakpoints are not defined. Navigation wraps below 1100 px.
- `ChoiceChip` uses KoHo in Figma (a legacy exception); it renders in Kode Mono here.
- The admin Configuration page follows `GET /admin/config` (genres, levels, badges, reputation
  points), not the Figma frame, whose settings the API doesn't have.
- The sky background is the rendered 1512 × 1640 frame crop; very tall pages scale it to cover.

## Developer feedback workspace

The following screens are implemented from the PlayLoop Figma file:

| Route                              | Screen                                                       | Figma node           |
| ---------------------------------- | ------------------------------------------------------------ | -------------------- |
| `/my-games`                        | Published games and drafts, review counts, workspace links   | `255:503`            |
| `/my-games/:gameId/form`           | First Impression, Playtest and Final Verdict form editor     | `272:630`, `272:749` |
| `/my-games/:gameId/feedback`       | Feedback filters, review details, status changes and replies | `270:606`            |
| `/games/:gameId/reviews`           | Sorted community reviews, helpful votes and discussion       | `318:860`            |
| `/reviews/:reviewId`               | Full review and discussion                                   | `318:860`            |
| `/games/:gameId/reviews/:reviewId` | Alias for notification links from the API                    | `318:860`            |

The navigation bell loads `/me/notifications`, polls the unread count once a minute while
signed in, and supports marking one or all notifications read. Escape and outside clicks close it.

The form builder supports every question type in `docs/api/schemas/form.yaml`, preserves edits
between tabs, validates all sections before saving, and warns before leaving unsaved edits.
Final Verdict's editable field is the farewell message; standard verdict questions are defined
by the backend. Figma currently provides only a wireframe for that editor and no bell dropdown,
so those surfaces compose the existing glass components and tokens.

All application data and writes use the cookie-authenticated API. No sample data or local-storage
fallback is included in the app. The complete backend endpoints are on `main`; this frontend
branch's older server does not yet include the newer auth, discussion and notification modules.
Use a backend built from current `main` to exercise the integrated flows. Game publishing/editing,
login and other existing placeholder screens remain separate work.

`src/test/featureFixtures.js` contains API-shaped data for tests only. Feature tests cover form
persistence and validation, failed requests, navigation guards, inbox status updates, votes,
replies and notifications. Browser checks use isolated local fixtures rather than live accounts.
The new Figma exports live in `src/assets/features`; game covers and user portraits remain dynamic.
