import { supabase } from './lib/supabase';

const launchSelector = '.player iframe';

function currentGameId(): string | null {
  const match = window.location.hash.match(/^#\/game\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function detectGameSize(frame: HTMLIFrameElement): { width: number; height: number } | null {
  try {
    const doc = frame.contentDocument;
    if (!doc) return null;

    const canvas = doc.querySelector('canvas');
    if (canvas) {
      const element = canvas as HTMLCanvasElement;
      const width = element.width || Math.round(canvas.getBoundingClientRect().width);
      const height = element.height || Math.round(canvas.getBoundingClientRect().height);
      if (width > 0 && height > 0) return { width, height };
    }

    const video = doc.querySelector('video');
    if (video) {
      const rect = video.getBoundingClientRect();
      const width = Math.round(video.videoWidth || rect.width);
      const height = Math.round(video.videoHeight || rect.height);
      if (width > 0 && height > 0) return { width, height };
    }

    const root = doc.documentElement;
    const body = doc.body;
    const width = Math.max(root?.scrollWidth || 0, body?.scrollWidth || 0);
    const height = Math.max(root?.scrollHeight || 0, body?.scrollHeight || 0);
    if (width > 0 && height > 0 && width < 10000 && height < 10000) {
      return { width, height };
    }
  } catch {
    // Ignore isolated game documents.
  }

  return null;
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
        }
        html::-webkit-scrollbar,
        body::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        body {
          max-width: 100% !important;
          max-height: 100% !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }
        canvas, video {
          max-width: 100% !important;
          max-height: 100% !important;
          display: block !important;
        }
        img, iframe {
          max-width: 100% !important;
          max-height: 100% !important;
        }
      `;
      (doc.head || doc.documentElement).appendChild(style);
    }

    const size = detectGameSize(frame);
    if (size) {
      const ratio = size.width / size.height;
      frame.dataset.gameWidth = String(size.width);
      frame.dataset.gameHeight = String(size.height);
      frame.dataset.gameAspectRatio = String(ratio);

      // The iframe uses the game's native aspect ratio instead of forcing every
      // game into UploadNPlay's old fixed player shape.
      frame.style.width = '100%';
      frame.style.height = 'auto';
      frame.style.aspectRatio = `${size.width} / ${size.height}`;
      frame.style.minHeight = '0';
      frame.style.maxWidth = '100%';
      frame.style.maxHeight = '100%';
    }
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
scan();
