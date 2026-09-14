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
  frame.setAttribute('allow', 'fullscreen; autoplay');
  frame.setAttribute('scrolling', 'no');
  frame.referrerPolicy = 'no-referrer';
  frame.style.overflow = 'hidden';
}

async function prepareFrame(frame: HTMLIFrameElement) {
  normalizeGameFrame(frame);
  frame.addEventListener('load', () => fitGameDocument(frame), { once: false });
  if (frame.contentDocument?.readyState === 'complete') fitGameDocument(frame);

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
