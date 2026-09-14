import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { supabase } from './lib/supabase';

type Game = {
  id: string;
  title: string;
  description: string;
  developer_id: string;
  entry_point: string;
  thumbnail_url: string | null;
  created_at: string;
  profiles?: { username: string } | null;
};

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand"><span>UPLOAD</span>N<span>PLAY</span></Link>
          <nav className="main-nav">
            <Link to="/">Store</Link>
            <Link to="/">Library</Link>
            <Link to="/upload">Publish</Link>
          </nav>
          <div className="account-nav">
            <Link to="/auth" className="account-button">Sign in</Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer"><span>UploadNPlay</span><span>Browser games, published by their creators.</span></footer>
    </div>
  );
}

function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    supabase.from('games').select('*, profiles(username)').order('created_at', { ascending: false })
      .then(({ data }) => setGames((data as Game[]) || []));
  }, []);

  const shown = useMemo(() => games.filter(g => `${g.title} ${g.description}`.toLowerCase().includes(q.toLowerCase())), [games, q]);
  const featured = shown[0];

  return (
    <Layout>
      <section className="store-wrap">
        <div className="store-search-row">
          <div className="store-tabs"><Link className="active" to="/">Store</Link><a href="#browse">Browse</a><a href="#new">New releases</a></div>
          <div className="search-box"><Icon>⌕</Icon><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search games" /></div>
        </div>

        {featured ? (
          <section className="featured">
            <div className="featured-copy">
              <p className="kicker">FEATURED GAME</p>
              <h1>{featured.title}</h1>
              <p>{featured.description || 'A new game published on UploadNPlay.'}</p>
              <div className="featured-meta">by {featured.profiles?.username || 'UploadNPlay developer'}</div>
              <Link to={`/game/${featured.id}`} className="play-button"><Icon>▶</Icon> Play now</Link>
            </div>
            {featured.thumbnail_url ? <img src={featured.thumbnail_url} className="featured-image" /> : <div className="featured-image featured-placeholder">{featured.title.slice(0, 1)}</div>}
          </section>
        ) : (
          <section className="featured empty-featured"><div><p className="kicker">WELCOME TO UPLOADNPLAY</p><h1>Find something to play.</h1><p>UploadNPlay is a home for HTML5 games made by independent developers.</p><Link to="/upload" className="play-button">Publish your first game</Link></div></section>
        )}

        <div className="catalog-layout" id="browse">
          <aside className="sidebar">
            <p className="sidebar-title">BROWSE</p>
            <a className="sidebar-link selected" href="#browse">All games</a>
            <a className="sidebar-link" href="#new">Recently added</a>
            <a className="sidebar-link" href="#browse">Popular</a>
            <p className="sidebar-title spacing">UPLOADNPLAY</p>
            <Link className="sidebar-link" to="/upload">Publish a game</Link>
            <Link className="sidebar-link" to="/auth">Your account</Link>
          </aside>
          <section className="catalog" id="new">
            <div className="section-title"><div><p className="kicker">LIBRARY</p><h2>Discover games</h2></div><span>{shown.length} games</span></div>
            {shown.length ? <div className="game-grid">{shown.map(game => <GameCard key={game.id} game={game} />)}</div> : <div className="empty">No games match that search.</div>}
          </section>
        </div>
      </section>
    </Layout>
  );
}

function GameCard({ game }: { game: Game }) {
  return (
    <Link to={`/game/${game.id}`} className="game-card">
      {game.thumbnail_url ? <img src={game.thumbnail_url} className="game-thumb" /> : <div className="game-thumb placeholder">{game.title.slice(0, 1).toUpperCase()}</div>}
      <div className="game-card-body"><h3>{game.title}</h3><p>{game.profiles?.username || 'UploadNPlay developer'}</p></div>
    </Link>
  );
}

function Upload() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) { setStatus('Add a title and ZIP file.'); return; }
    setBusy(true); setStatus('Checking ZIP...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in first.');
      const zip = await JSZip.loadAsync(file);
      const names = Object.keys(zip.files).filter(name => {
        if (zip.files[name].dir) return false;
        const clean = name.replaceAll('\\', '/');
        return clean.split('/').every(part => part !== '..' && part !== '.');
      });
      const entry = names.find(n => n === 'index.html') || names.find(n => /(^|\/)index\.html$/i.test(n));
      if (!entry) throw new Error('The ZIP needs an index.html file. Other files such as .js, .css, .json, .py and assets are allowed.');

      const { data: game, error } = await supabase.from('games').insert({ title: title.trim(), description, developer_id: user.id, entry_point: entry, zip_path: '' }).select().single();
      if (error) throw error;

      for (const name of names) {
        setStatus(`Uploading ${name}...`);
        const blob = await zip.files[name].async('blob');
        const ext = name.split('.').pop()?.toLowerCase();
        const types: Record<string, string> = {
          html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
          json: 'application/json', wasm: 'application/wasm', svg: 'image/svg+xml', xml: 'application/xml',
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
          mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm',
          txt: 'text/plain', csv: 'text/csv', py: 'text/x-python'
        };
        const { error: uploadError } = await supabase.storage.from('game-files').upload(`${game.id}/${name}`, blob, { contentType: types[ext || ''] || 'application/octet-stream', upsert: true });
        if (uploadError) throw uploadError;
      }

      if (thumb) {
        const ext = thumb.name.split('.').pop() || 'jpg';
        const path = `${game.id}.${ext}`;
        const { error: thumbError } = await supabase.storage.from('thumbnails').upload(path, thumb, { upsert: true, contentType: thumb.type });
        if (!thumbError) {
          const { data: publicUrl } = supabase.storage.from('thumbnails').getPublicUrl(path);
          await supabase.from('games').update({ thumbnail_url: publicUrl.publicUrl }).eq('id', game.id);
        }
      }
      await supabase.from('games').update({ zip_path: `${game.id}/` }).eq('id', game.id);
      nav(`/game/${game.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Upload failed.');
    } finally { setBusy(false); }
  }

  return <Layout><div className="publish-page"><div className="publish-intro"><p className="kicker">PUBLISH</p><h1>Put your game<br />on UploadNPlay.</h1><p>Upload one ZIP and we handle the static hosting. Your game just needs an <code>index.html</code> entry point.</p></div><form onSubmit={submit} className="publish-panel"><label>Game title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="My awesome game" /></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell players what your game is about..." /></label><label>Game ZIP<input type="file" accept=".zip" onChange={e => setFile(e.target.files?.[0] || null)} /><small>HTML is required. JavaScript, CSS, images, audio, WASM, JSON, Python and other supporting files can also be included.</small></label><label>Thumbnail <span className="optional">OPTIONAL</span><input type="file" accept="image/*" onChange={e => setThumb(e.target.files?.[0] || null)} /></label><button className="play-button submit" disabled={busy}>{busy ? status : 'Publish game'}</button>{!busy && status && <p className="form-status">{status}</p>}</form></div></Layout>;
}

function GamePage() {
  const { id } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from('games').select('*, profiles(username)').eq('id', id).single().then(({ data }) => {
      const g = data as Game | null;
      setGame(g); setLoading(false);
      if (g) {
        const { data: publicUrl } = supabase.storage.from('game-files').getPublicUrl(`${g.id}/${g.entry_point}`);
        setUrl(publicUrl.publicUrl);
      }
    });
  }, [id]);

  if (loading) return <Layout><div className="empty-page">Loading game...</div></Layout>;
  if (!game) return <Layout><div className="empty-page">Game not found.</div></Layout>;

  return <Layout><div className="game-page"><div className="game-title-row">{game.thumbnail_url ? <img src={game.thumbnail_url} /> : <div className="title-placeholder">{game.title.slice(0, 1)}</div>}<div><p className="kicker">UPLOADNPLAY GAME</p><h1>{game.title}</h1><p>by {game.profiles?.username || 'Unknown developer'}</p></div></div><div className="player"><iframe title={game.title} src={url} sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms" allow="fullscreen; pointer-lock" /><button onClick={() => document.querySelector('.player')?.requestFullscreen()} className="fullscreen">Fullscreen</button></div><div className="game-info"><div><p className="kicker">ABOUT THIS GAME</p><h2>About {game.title}</h2><p>{game.description || 'No description provided.'}</p></div><aside><strong>RUNS IN YOUR BROWSER</strong><span>Keyboard, mouse and gamepad controls depend on the game.</span></aside></div></div></Layout>;
}

function Auth() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState('');
  async function login(e: React.FormEvent) { e.preventDefault(); setError(''); const { error: authError } = await supabase.auth.signInWithOtp({ email }); if (authError) setError(authError.message); else setSent(true); }
  return <Layout><div className="auth-page"><p className="kicker">ACCOUNT</p><h1>Sign in to<br />UploadNPlay.</h1><form onSubmit={login} className="publish-panel"><label>Email<input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></label><button className="play-button">Send magic link</button>{sent && <p className="success">Check your email for the sign-in link.</p>}{error && <p className="form-status">{error}</p>}</form></div></Layout>;
}

export default function App() {
  return <Routes><Route path="/" element={<Home />} /><Route path="/upload" element={<Upload />} /><Route path="/game/:id" element={<GamePage />} /><Route path="/auth" element={<Auth />} /></Routes>;
}
