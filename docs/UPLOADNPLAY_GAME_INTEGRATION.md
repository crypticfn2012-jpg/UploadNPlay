# UploadNPlay game integration

UploadNPlay provides a browser SDK, a REST API, per-game API credentials, and achievements.

## Browser SDK

Include:

```html
<script src="https://crypticfn2012-jpg.github.io/UploadNPlay/sdk/uploadnplay.js"></script>
<script>
  const unp = UploadNPlay.init({
    gameId: 'YOUR_GAME_ID',
    publicKey: 'YOUR_PUBLIC_KEY'
  });
</script>
```

The SDK exposes:

```js
await unp.getGame();
await unp.getPlayer();
await unp.getAchievements();
await unp.unlockAchievement('first-win');
```

A browser game never needs the server API secret.

## Achievements

Each game can define achievements with:

- unique key
- display name
- description
- optional icon URL
- points
- secret/visible mode
- client unlock enabled/disabled

Use `client_unlockable: false` for achievements that must only be awarded by the game's server.

Players can unlock a client achievement with:

```js
await unp.unlockAchievement('first-win');
```

## Server-only achievements

For server-only achievements, generate a server secret for the game in the Achievement Manager and store it as a backend environment variable.

Never put the secret in HTML, JavaScript, a Unity build distributed to players, or any public repository.

Example:

```js
await fetch('https://rldidvwcylirjyfktvtg.supabase.co/functions/v1/uploadnplay-api/games/GAME_ID/achievements/first-win/unlock', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-secret': process.env.UPLOADNPLAY_API_SECRET
  },
  body: JSON.stringify({ playerId: playerId })
});
```

The API secret is stored by UploadNPlay only as a SHA-256 hash. Rotating it invalidates the previous secret.

## Supabase deployment

Run `supabase/achievements.sql` in the UploadNPlay Supabase SQL editor.

Then deploy the Edge Function:

```bash
supabase functions deploy uploadnplay-api --project-ref rldidvwcylirjyfktvtg
```

The function needs the standard Supabase environment variables available to deployed functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The included `supabase/config.toml` disables gateway JWT enforcement for this function because the endpoint supports both player bearer tokens and server API-secret authentication. The function performs the actual authentication and secret verification itself.

## Documentation pages

- `/UploadNPlay/developer/sdk/`
- `/UploadNPlay/developer/api/`
- `/UploadNPlay/developer/achievements/`
