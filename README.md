# UploadNPlay

> A home for browser games made by people who actually build them.

UploadNPlay is a browser-game publishing platform built around one simple idea: **drop in a game, publish it, and let people play it.**

It is designed for HTML5 games, prototypes, experiments and indie projects that can run directly in a modern browser.

---

## What is UploadNPlay?

UploadNPlay lets developers upload a complete HTML5 game as a `.zip`, have the files extracted and hosted, submit the game for moderation, and give players a dedicated page where the game can be played.

The platform is built around:

- A dark, game-store style interface
- Developer profiles
- Public game pages
- ZIP-based HTML5 game publishing
- Admin review and approval
- Game thumbnails and descriptions
- Per-game view analytics
- A browser game player that preserves the game's own aspect ratio
- Developer API and SDK support
- Achievements
- Launch tokens for authenticated game sessions
- Supabase-backed authentication, storage and database services

UploadNPlay is not a game engine. **You make the game. UploadNPlay gives it somewhere to live.**

---

## Publishing a game

A game is uploaded as one ZIP file.

The ZIP needs an `index.html` entry point. It can be at the root of the archive or inside a folder.

Example:

```text
my-game.zip
├── index.html
├── style.css
├── game.js
├── assets/
│   ├── player.png
│   ├── music.ogg
│   └── background.jpg
└── data/
    └── levels.json
```

UploadNPlay extracts the archive in the browser and uploads the individual files to Supabase Storage while keeping their relative paths intact.

That means normal HTML5 paths such as these continue to work:

```html
<script src="game.js"></script>
<link rel="stylesheet" href="style.css">
<img src="assets/player.png" alt="Player">
```

There is no special UploadNPlay packaging format required.

---

## Game review

New games are submitted as `pending`.

They do not immediately appear in the public store. An administrator can review a submission and either approve it or reject it with a reason.

The basic flow is:

```text
Upload ZIP
   ↓
Validate index.html
   ↓
Extract game files
   ↓
Create private submission
   ↓
Admin review
   ↓
Approved → Public game page
Rejected → Developer can fix and resubmit
```

This keeps unfinished or unwanted uploads out of the public catalogue.

---

## Playing games

Every published game gets its own game page.

UploadNPlay loads the game's `index.html` from storage into the player and builds the playable document without exposing the raw HTML source as the main page.

The player also detects common native game dimensions such as `800×600`, `1280×720` and `1920×1080`, then uses the detected aspect ratio so games are not unnecessarily stretched into a fixed box.

Scrollbars are suppressed inside the player where possible, while fullscreen and pointer-lock support are available to games that need them.

---

## Developer tools

Developers can manage their games from the developer area.

The platform is intended to grow into a complete publishing workflow rather than stopping at a file uploader.

Current developer features include:

- Game submissions
- Game status tracking
- Game thumbnails
- Developer profiles
- Game view analytics
- Achievement management
- Public API credentials
- Server-side API secrets
- UploadNPlay SDK documentation

Developer documentation lives inside the repository under:

```text
public/developer/
├── api/
├── achievements/
└── sdk/
```

---

## UploadNPlay SDK

Games can integrate with UploadNPlay using the browser SDK.

The SDK is designed for features such as:

```js
const game = await UploadNPlay.getGame();
const player = await UploadNPlay.getPlayer();
const achievements = await UploadNPlay.getAchievements();

await UploadNPlay.unlockAchievement('first-win');
```

The SDK can receive a scoped launch token from the UploadNPlay game player instead of requiring a game's files to contain permanent player credentials.

The SDK documentation is available at:

`/developer/sdk/`

---

## Achievements

Games can define their own achievements.

Achievements support things such as:

- Name
- Description
- Icon
- Points
- Secret achievements
- Client-unlockable achievements
- Server-controlled achievements

Each achievement belongs to a specific game, so one game's achievements cannot accidentally become another game's achievements.

---

## API

UploadNPlay includes an API designed for game integrations.

The API supports authenticated game requests, game information, player information, achievements and achievement unlocks.

Server integrations can use an API secret instead of exposing privileged credentials to players.

API documentation is available at:

`/developer/api/`

Never put a server/API secret into publicly distributed client-side game code.

---

## Profiles

Players and developers have UploadNPlay profiles with:

- Username
- Display name
- Avatar
- Bio
- Developer status
- Published games

The profile system is intended to make developers feel like actual creators on the platform rather than anonymous file uploaders.

---

## Tech stack

UploadNPlay is currently built with:

- React
- TypeScript
- Vite
- React Router
- Supabase
- Supabase Storage
- Supabase Auth
- PostgreSQL
- JSZip
- GitHub Pages

The frontend uses the public Supabase anon key. **A Supabase service-role key must never be placed in the frontend.**

---

## Project structure

```text
UploadNPlay/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── profile.css
│   ├── refinement.css
│   ├── gameLaunchBridge.ts
│   └── lib/
│       └── supabase.ts
│
├── public/
│   └── developer/
│       ├── api/
│       ├── achievements/
│       └── sdk/
│
├── supabase/
│   ├── schema.sql
│   ├── storage-policies.sql
│   ├── achievements.sql
│   ├── launch-tokens.sql
│   └── functions/
│       └── uploadnplay-api/
│
└── docs/
    └── UPLOADNPLAY_GAME_INTEGRATION.md
```

---

## Local development

Requirements:

- Node.js 20+
- A Supabase project
- A modern browser

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example`:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Then run:

```bash
npm run dev
```

For a production build:

```bash
npm run build
```

---

## Supabase setup

Run the SQL files in the Supabase SQL Editor when setting up a fresh project.

Core database:

```text
supabase/schema.sql
```

Storage policies:

```text
supabase/storage-policies.sql
```

Achievements:

```text
supabase/achievements.sql
```

Launch tokens:

```text
supabase/launch-tokens.sql
```

The API Edge Function is located at:

```text
supabase/functions/uploadnplay-api/
```

Deploy it with the Supabase CLI:

```bash
supabase functions deploy uploadnplay-api --project-ref rldidvwcylirjyfktvtg
```

---

## Security model

UploadNPlay uses Supabase Row Level Security to separate public content, player data and developer-owned data.

Important rules:

- Public users can only see approved games.
- Developers can manage their own games.
- Administrators can moderate games.
- Players can only unlock achievements for themselves through the client-safe path.
- Server-only achievement operations use the API secret flow.
- Launch tokens are short-lived and scoped to a game/player session.
- Service-role credentials stay on the server.

The game player intentionally runs uploaded games separately from the main UploadNPlay application environment as much as the browser security model allows.

---

## The idea

UploadNPlay is meant to be straightforward.

No complicated launcher. No giant publishing pipeline. No special engine required.

**Make a browser game. Zip it. Upload it. Get it in front of people.**

That is the whole point.

---

## Status

UploadNPlay is actively being developed. Features and APIs may change while the platform is refined.

Built for people who make things.
