import { supabase } from './lib/supabase';

const launchSelector = '.player iframe';

type LaunchConfig = {
  gameId: string;
  token: string;
  publicKey: string | null;
};

function currentGameId(): string | null {
  const match = window.location.hash.match(/^#\/game\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function normalizeGameFrame(frame: HTMLIFrameElement) {
  // Uploaded games are served from a separate Supabase origin. Do not sandbox
  // them here: Chromium warns about allow-scripts + allow-same-origin, and the
  // games need normal HTML5 browser APIs such as pointer lock and storage.
  frame.removeAttribute('sandbox');
  frame.setAttribute('allow', 'fullscreen; autoplay');
  frame.referrerPolicy = 'no-referrer';
}

function sendLaunchConfig(frame: HTMLIFrameElement, config: LaunchConfig) {
  frame.contentWindow?.postMessage(
    {
      source: 'uploadnplay',
      type: 'uploadnplay-launch',
      gameId: config.gameId,
      token: config.token,
      publicKey: config.publicKey,
    },
    '*'
  );
}

async function prepareFrame(frame: HTMLIFrameElement) {
  normalizeGameFrame(frame);
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

  const { data: credential } = await supabase
    .from('game_api_credentials')
    .select('public_key')
    .eq('game_id', gameId)
    .maybeSingle();

  const config: LaunchConfig = {
    gameId,
    token: data.token,
    publicKey: credential?.public_key || null,
  };

  frame.dataset.uploadnplayPrepared = '1';

  // IMPORTANT: playerUrl is a blob: URL. Never mutate it with URL search
  // parameters: doing that creates an invalid blob reference in Chromium and
  // produces "It may have been moved, edited, or deleted."
  const send = () => sendLaunchConfig(frame, config);
  frame.addEventListener('load', send, { once: true });
  send();
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
