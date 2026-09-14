import { supabase } from './lib/supabase';

const launchSelector = '.player iframe';
const cleanupMap = new WeakMap<HTMLIFrameElement, () => void>();

function currentGameId(): string | null {
  const match = window.location.hash.match(/^#\/game\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function detectGameSize(frame: HTMLIFrameElement): { width: number; height: number } | null {
  try {
    const doc = frame.contentDocument;
    if (!doc) return null;

    for (const element of Array.from(doc.querySelectorAll('canvas, video'))) {
      const media = element as HTMLCanvasElement | HTMLVideoElement;
      const rect = media.getBoundingClientRect();
      const width = media instanceof HTMLCanvasElement
        ? media.width || Math.round(rect.width)
        : media.videoWidth || Math.round(rect.width);
      const height = media instanceof HTMLCanvasElement
        ? media.height || Math.round(rect.height)
        : media.videoHeight || Math.round(rect.height);
      if (width > 0 && height > 0 && width < 10000 && height < 10000) return { width, height };
    }

    const root = doc.documentElement;
    const body = doc.body;
    const width = Math.max(root?.scrollWidth || 0, body?.scrollWidth || 0);
    const height = Math.max(root?.scrollHeight || 0, body?.scrollHeight || 0);
    if (width > 0 && height > 0 && width < 10000 && height < 10000) return { width, height };
  } catch {
    // The game can still be booting or deliberately isolate its document.
  }
  return null;
}

function applyPlayerSize(frame: HTMLIFrameElement) {
  const size = detectGameSize(frame);
  if (!size) return;

  frame.dataset.gameWidth = String(size.width);
  frame.dataset.gameHeight = String(size.height);
  frame.dataset.gameAspectRatio = String(size.width / size.height);
  frame.style.width = '100%';
  frame.style.height = 'auto';
  frame.style.aspectRatio = `${size.width} / ${size.height}`;
  frame.style.minHeight = '0';
  frame.style.maxWidth = '100%';
  frame.style.maxHeight = '100%';
}

function fitGameDocument(frame: HTMLIFrameElement) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;

    let style = doc.getElementById('uploadnplay-fit-style') as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement('style');
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
          scrollbar-width: none !important;
          overscroll-behavior: none !important;
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        body { max-width: 100% !important; max-height: 100% !important; box-sizing: border-box !important; }
        canvas, video, img, iframe { max-width: 100% !important; max-height: 100% !important; }
        canvas, video { display: block !important; }
      `;
      (doc.head || doc.documentElement).appendChild(style);
    }

    applyPlayerSize(frame);
  } catch {
    // Ignore pages that deliberately isolate their document.
  }
}

function normalizeGameFrame(frame: HTMLIFrameElement) {
  frame.removeAttribute('sandbox');
  frame.setAttribute('allow', 'fullscreen; autoplay; gamepad; pointer-lock');
  frame.setAttribute('scrolling', 'no');
  frame.setAttribute('frameBorder', '0');
  frame.referrerPolicy = 'no-referrer';
  frame.style.overflow = 'hidden';
  frame.style.display = 'block';
  frame.style.border = '0';
  frame.style.background = '#000';
}

function sendLaunchConfig(frame: HTMLIFrameElement, gameId: string, token: string, publicKey?: string) {
  frame.contentWindow?.postMessage(
    { type: 'uploadnplay:launch', gameId, token, publicKey: publicKey || null },
    '*'
  );
}

function watchGameLayout(frame: HTMLIFrameElement) {
  const doc = frame.contentDocument;
  if (!doc) return;

  const update = () => {
    normalizeGameFrame(frame);
    fitGameDocument(frame);
  };

  update();
  const observer = new MutationObserver(update);
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true });
  const resizeObserver = new ResizeObserver(update);
  if (doc.documentElement) resizeObserver.observe(doc.documentElement);
  if (doc.body) resizeObserver.observe(doc.body);
  const timer = window.setInterval(update, 500);
  const timeout = window.setTimeout(() => window.clearInterval(timer), 15000);

  return () => {
    observer.disconnect();
    resizeObserver.disconnect();
    window.clearInterval(timer);
    window.clearTimeout(timeout);
  };
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
  if (error || !data?.token) {
    frame.dataset.uploadnplayPrepared = '1';
    return;
  }

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
    cleanupMap.get(frame)?.();
    const cleanup = watchGameLayout(frame);
    if (cleanup) cleanupMap.set(frame, cleanup);
  };

  frame.addEventListener('load', launch);
  if (frame.contentDocument?.readyState === 'complete') launch();
  frame.dataset.uploadnplayPrepared = '1';
}

function scan() {
  document.querySelectorAll<HTMLIFrameElement>(launchSelector).forEach((frame) => {
    if (frame.dataset.uploadnplayPrepared === '1') {
      normalizeGameFrame(frame);
      fitGameDocument(frame);
      return;
    }
    void prepareFrame(frame);
  });
}

const observer = new MutationObserver(scan);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', scan);
window.addEventListener('resize', scan);
window.addEventListener('load', scan);
scan();
