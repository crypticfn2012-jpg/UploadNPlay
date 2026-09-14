import { supabase } from './lib/supabase';

const launchSelector = '.player iframe';

function currentGameId(): string | null {
  const match = window.location.hash.match(/^#\/game\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function fitGameDocument(frame: HTMLIFrameElement) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    const existing = doc.getElementById('uploadnplay-fit-style');
    if (existing) return;

    const style = doc.createElement('style');
    style.id = 'uploadnplay-fit-style';
    style.textContent = `
      html, body {
        width: 100% !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      body {
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      canvas, video, img, iframe {
        max-width: 100% !important;
        max-height: 100% !important;
      }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  } catch {
    // Ignore pages that deliberately isolate their document.
  }
}

function normalizeGameFrame(frame: HTMLIFrameElement) {
  frame.removeAttribute('sandbox');
  frame.setAttribute('allow', 'fullscreen; autoplay; gamepad; pointer-lock');
  frame.setAttribute('scrolling', 'no');
  frame.referrerPolicy = 'no-referrer';
  frame.style.overflow = 'hidden';
}

function sendLaunchConfig(frame: HTMLIFrameElement, gameId: string, token: string, publicKey?: string) {
  frame.contentWindow?.postMessage(
    {
      type: 'uploadnplay:launch',
      gameId,
      token,
      publicKey: publicKey || null,
    },
    '*'
  );
}

async function prepareFrame(frame: HTMLIFrameElement) {
  normalizeGameFrame(frame);

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

  const publicKey = credential?.public_key || undefined;

  const launch = () => {
    normalizeGameFrame(frame);
    fitGameDocument(frame);
    sendLaunchConfig(frame, gameId, data.token, publicKey);
  };

  frame.addEventListener('load', launch, { once: false });

  if (frame.contentDocument?.readyState === 'complete') {
    launch();
  }

  frame.dataset.uploadnplayPrepared = '1';
}

function scan() {
  document.querySelectorAll<HTMLIFrameElement>(launchSelector).forEach((frame) => {
    if (frame.dataset.uploadnplayPrepared === '1') {
      normalizeGameFrame(frame);
      return;
    }
    void prepareFrame(frame);
  });
}

const observer = new MutationObserver(scan);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', scan);
scan();
