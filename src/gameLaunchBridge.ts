import { supabase } from './lib/supabase';

const launchSelector = '.player iframe';

function currentGameId(): string | null {
  const match = window.location.hash.match(/^#\/game\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function prepareFrame(frame: HTMLIFrameElement) {
  if (frame.dataset.uploadnplayPrepared === '1') return;
  const gameId = currentGameId();
  if (!gameId) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    frame.dataset.uploadnplayPrepared = '1';
    return;
  }

  const { data, error } = await supabase.rpc('create_game_launch_token', { target_game: gameId });
  if (error || !data?.token) return;

  const nextUrl = new URL(frame.src);
  nextUrl.searchParams.set('uploadnplay_game', gameId);
  nextUrl.searchParams.set('uploadnplay_token', data.token);

  const { data: credential } = await supabase
    .from('game_api_credentials')
    .select('public_key')
    .eq('game_id', gameId)
    .maybeSingle();
  if (credential?.public_key) nextUrl.searchParams.set('uploadnplay_key', credential.public_key);

  frame.dataset.uploadnplayPrepared = '1';
  frame.src = nextUrl.toString();
}

function scan() {
  document.querySelectorAll<HTMLIFrameElement>(launchSelector).forEach((frame) => {
    void prepareFrame(frame);
  });
}

const observer = new MutationObserver(scan);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', scan);
scan();
