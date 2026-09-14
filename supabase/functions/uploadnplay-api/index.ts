import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-api-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getPlayerId(req: Request, gameId?: string) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length);

  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data.user) return data.user.id;

  if (!gameId) return null;
  const { data: playerId, error: tokenError } = await supabase.rpc('resolve_game_launch_token', {
    target_game: gameId,
    provided_token: token,
  });
  if (tokenError || !playerId) return null;
  return playerId as string;
}

function routeParts(url: URL) {
  return url.pathname.replace(/^\/functions\/v1\/uploadnplay-api\/?/, '').split('/').filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const parts = routeParts(url);
    if (!parts.length) return json({ name: 'UploadNPlay API', version: '1' });

    if (parts[0] === 'me' && req.method === 'GET') {
      const gameId = url.searchParams.get('gameId') || undefined;
      const playerId = await getPlayerId(req, gameId);
      if (!playerId) return json({ authenticated: false, player: null }, 200);
      const { data: profile } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .eq('id', playerId)
        .maybeSingle();
      const { data: authUser } = await supabase.auth.admin.getUserById(playerId);
      return json({ authenticated: true, player: { id: playerId, email: authUser.user?.email ?? null, ...profile } });
    }

    if (parts[0] !== 'games' || !parts[1]) return json({ error: 'Not found' }, 404);
    const gameId = parts[1];

    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id,title,description,developer_id,thumbnail_url,status,created_at')
      .eq('id', gameId)
      .maybeSingle();
    if (gameError || !game) return json({ error: 'Game not found' }, 404);
    if (game.status !== 'approved') return json({ error: 'Game is not approved' }, 403);

    if (parts[2] === undefined && req.method === 'GET') return json({ game });

    if (parts[2] === 'achievements' && parts.length === 3 && req.method === 'GET') {
      const playerId = await getPlayerId(req, gameId);
      const { data: achievements, error } = await supabase
        .from('game_achievements')
        .select('id,achievement_key,name,description,icon_url,points,secret,client_unlockable')
        .eq('game_id', gameId)
        .eq('enabled', true)
        .order('created_at', { ascending: true });
      if (error) return json({ error: error.message }, 500);

      let unlocked = new Set<string>();
      if (playerId) {
        const { data: rows } = await supabase
          .from('game_achievement_unlocks')
          .select('achievement_id')
          .eq('game_id', gameId)
          .eq('user_id', playerId);
        unlocked = new Set((rows || []).map((row) => row.achievement_id));
      }

      return json({ achievements: (achievements || []).map((achievement) => ({
        ...achievement,
        name: achievement.secret && !unlocked.has(achievement.id) ? 'Secret achievement' : achievement.name,
        description: achievement.secret && !unlocked.has(achievement.id) ? 'Keep playing to discover this achievement.' : achievement.description,
        unlocked: unlocked.has(achievement.id),
      })) });
    }

    if (parts[2] === 'achievements' && parts[3] && parts[4] === 'unlock' && req.method === 'POST') {
      const secret = req.headers.get('x-api-secret');
      const achievementKey = parts[3];
      const playerIdFromToken = await getPlayerId(req, gameId);

      if (secret) {
        const { data: valid, error: verifyError } = await supabase.rpc('verify_game_api_secret', {
          target_game: gameId,
          provided_secret: secret,
        });
        if (verifyError || !valid) return json({ error: 'Invalid API secret' }, 401);
      } else if (!playerIdFromToken) {
        return json({ error: 'Player authentication required' }, 401);
      }

      const { data: achievement, error: achievementError } = await supabase
        .from('game_achievements')
        .select('id,game_id,achievement_key,name,client_unlockable')
        .eq('game_id', gameId)
        .eq('achievement_key', achievementKey)
        .eq('enabled', true)
        .maybeSingle();
      if (achievementError || !achievement) return json({ error: 'Achievement not found' }, 404);
      if (!secret && !achievement.client_unlockable) return json({ error: 'This achievement is server-only' }, 403);

      const body = await req.json().catch(() => ({}));
      const playerId = playerIdFromToken || (typeof body.playerId === 'string' ? body.playerId : null);
      if (!playerId) return json({ error: 'playerId is required for server unlocks' }, 400);

      const { error: unlockError } = await supabase.from('game_achievement_unlocks').insert({
        achievement_id: achievement.id,
        game_id: gameId,
        user_id: playerId,
      });
      if (unlockError && unlockError.code !== '23505') return json({ error: unlockError.message }, 500);

      return json({ unlocked: true, alreadyUnlocked: unlockError?.code === '23505', achievement });
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
});
