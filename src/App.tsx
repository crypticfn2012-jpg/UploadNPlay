import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { supabase } from './lib/supabase';

type Profile = {
  id: string;
  username: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  is_dev?: boolean;
  is_admin?: boolean;
};

type Game = {
  id: string;
  title: string;
  description: string;
  developer_id: string;
  zip_path: string;
  entry_point: string;
  thumbnail_url: string | null;
  created_at: string;
  status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  profiles?: Pick<Profile, 'username' | 'display_name'> | null;
};

const fileTypes: Record<string, string> = {
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
  json: 'application/json', wasm: 'application/wasm', svg: 'image/svg+xml', xml: 'application/xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm',
  txt: 'text/plain', csv: 'text/csv', py: 'text/x-python',
};

const DISCORD_URL = 'https://discord.gg/rhH2GkStNJ';
const redirectUrl = () => `${window.location.origin}${window.location.pathname}`;
const publicUrl = (bucket: string, path: string) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

function DiscordIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.54 5.21A16.1 16.1 0 0 0 15.48 4l-.5 1.02a14.7 14.7 0 0 0-5.96 0L8.52 4a16.1 16.1 0 0 0-4.06 1.21C1.89 9.42 1.18 13.5 1.54 17.53A16.4 16.4 0 0 0 6.5 20l1.2-1.64c-.66-.25-1.3-.56-1.9-.93l.46-.35a11.7 11.7 0 0 0 11.48 0l.46.35c-.6.37-1.24.68-1.9.93L17.5 20a16.4 16.4 0 0 0 4.96-2.47c.43-4.68-.73-8.72-2.92-12.32ZM8.5 15.5c-1.03 0-1.87-.96-1.87-2.14s.82-2.15 1.87-2.15 1.88.96 1.87 2.15c0 1.18-.82 2.14-1.87 2.14Zm7 0c-1.03 0-1.87-.96-1.87-2.14s.82-2.15 1.87-2.15 1.88.96 1.87 2.15c0 1.18-.82 2.14-1.87 2.14Z"/></svg>;
}

function getProfileDefaults(user: { id: string; email?: string | null; user_metadata?: Record<string, any> }) {
  const meta = user.user_metadata || {};
  const raw = meta.user_name || meta.username || meta.preferred_username || meta.name || (user.email ? user.email.split('@')[0] : 'player');
  const base = String(raw).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'player';
  const displayName = String(meta.full_name || meta.name || meta.display_name || raw || base).slice(0, 80);
  const avatar = meta.avatar_url || meta.picture || meta.image_url || null;
  return { id: user.id, baseUsername: base, displayName, avatar };
}

async function loadOrCreateProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, any> }) {
  const existing = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (existing.data) return existing.data as Profile;
  if (existing.error && existing.error.code !== 'PGRST116') return null;

  const defaults = getProfileDefaults(user);
  const { data } = await supabase.from('profiles').insert({
    id: user.id,
    username: defaults.baseUsername,
    display_name: defaults.displayName,
    avatar_url: defaults.avatar,
  }).select('*').single();
  return data as Profile | null;
}

function Layout({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setProfile(null);
        return;
      }
      const current = await loadOrCreateProfile(user);
      if (!alive) return;
      setProfile(current || { id: user.id, username: user.email?.split('@')[0] || 'player' });
    }
    loadUser();
    const { data } = supabase.auth.onAuthStateChange(() => window.setTimeout(loadUser, 0));
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand"><span>Upload</span>NPlay</Link>
          <nav className="main-nav">
            <Link to="/">Store</Link>
            <Link to="/library">Library</Link>
            {profile?.is_dev || profile?.is_admin ? <Link to="/developer">Developer</Link> : <Link to="/upload">Publish</Link>}
            {profile?.is_admin && <Link to="/admin">Admin</Link>}
          </nav>
          <div className="account-nav">
            {profile ? (
              <div className="user-nav">
                <Link to="/profile" className="user-chip">
                  {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{(profile.display_name || profile.username).slice(0, 1).toUpperCase()}</span>}
                  <b>{profile.display_name || profile.username}</b>
                </Link>
                <button onClick={logout}>Sign out</button>
              </div>
            ) : <Link to="/auth" className="account-button">Sign in</Link>}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer"><b>UploadNPlay</b><span>HTML5 games published by their creators.</span></footer>
    </div>
  );
}

function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('games').select('*, profiles(username)').eq('status', 'approved').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setGames((data as Game[]) || []);
      });
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? games.filter(g => `${g.title} ${g.description}`.toLowerCase().includes(q)) : games;
  }, [games, query]);
  const featured = shown[0];

  return (
    <Layout>
      <div className="store-page">
        <section className="store-bar">
          <div className="store-links"><Link className="active" to="/">Store</Link><a href="#discover">Discover</a><a href="#new">New releases</a></div>
          <input className="store-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for a game" />
        </section>
        {error && <div className="notice error">Could not load games: {error}</div>}
        {featured ? <Link to={`/game/${featured.id}`} className="hero"><div className="hero-copy"><small>FEATURED GAME</small><h1>{featured.title}</h1><p>{featured.description || 'A game published on UploadNPlay.'}</p><span>Play game</span></div>{featured.thumbnail_url ? <img src={featured.thumbnail_url} alt="" /> : <div className="hero-placeholder">{featured.title.slice(0, 1)}</div>}</Link> : <section className="empty-hero"><small>UPLOADNPLAY</small><h1>{query ? 'No games found.' : 'Your next game starts here.'}</h1><p>{query ? 'Try another search.' : 'A simple home for browser games made by independent developers.'}</p><Link to="/upload">Publish a game</Link></section>}
        <section id="discover" className="catalog-section"><div className="section-head"><div><small>DISCOVER</small><h2>Games</h2></div><span>{shown.length}</span></div>{shown.length ? <div className="game-grid">{shown.map(game => <GameCard key={game.id} game={game} />)}</div> : <div className="empty">No games to show.</div>}</section>
        <section id="new" className="browse-strip"><div><small>UPLOADNPLAY</small><h2>Ready to publish?</h2></div><Link to="/upload">Publish your HTML5 game</Link></section>
      </div>
    </Layout>
  );
}

function GameCard({ game }: { game: Game }) {
  const developer = game.profiles?.display_name || game.profiles?.username || 'Developer';
  return <Link className="game-card" to={`/game/${game.id}`}>{game.thumbnail_url ? <img src={game.thumbnail_url} alt="" /> : <div className="game-card-placeholder">{game.title.slice(0, 1).toUpperCase()}</div>}<h3>{game.title}</h3><p>{developer}</p></Link>;
}

function Upload() {
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [zipFile, setZipFile] = useState<File | null>(null); const [thumb, setThumb] = useState<File | null>(null); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!title.trim() || !zipFile) { setStatus('Add a game title and ZIP file.'); return; }
    setBusy(true); setStatus('Checking ZIP...');
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Sign in first.');
      const { data: profile } = await supabase.from('profiles').select('is_dev,is_admin').eq('id', user.id).maybeSingle();
      if (!profile?.is_dev && !profile?.is_admin) throw new Error('Your account is not marked as a developer yet.');
      const zip = await JSZip.loadAsync(zipFile);
      const names = Object.keys(zip.files).filter(name => { if (zip.files[name].dir) return false; const clean = name.replaceAll('\\', '/'); return clean.split('/').every(part => part !== '..' && part !== '.' && part.length > 0); });
      const entry = names.find(name => name.toLowerCase() === 'index.html') || names.find(name => /(^|\/)index\.html$/i.test(name));
      if (!entry) throw new Error('Your ZIP must contain index.html.');
      const { data: game, error: gameError } = await supabase.from('games').insert({ title: title.trim(), description: description.trim(), developer_id: user.id, entry_point: entry, zip_path: '', status: 'pending' }).select().single();
      if (gameError) throw gameError;
      for (const name of names) { setStatus(`Uploading ${name}`); const blob = await zip.files[name].async('blob'); const extension = name.split('.').pop()?.toLowerCase() || ''; const { error } = await supabase.storage.from('game-files').upload(`${game.id}/${name}`, blob, { upsert: true, contentType: fileTypes[extension] || 'application/octet-stream' }); if (error) throw error; }
      if (thumb) { const extension = thumb.name.split('.').pop()?.toLowerCase() || 'jpg'; const path = `${game.id}.${extension}`; const { error } = await supabase.storage.from('thumbnails').upload(path, thumb, { upsert: true, contentType: thumb.type || 'image/jpeg' }); if (!error) await supabase.from('games').update({ thumbnail_url: publicUrl('thumbnails', path) }).eq('id', game.id); }
      const { error: finishError } = await supabase.from('games').update({ zip_path: `${game.id}/` }).eq('id', game.id); if (finishError) throw finishError;
      navigate('/developer');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Upload failed.'); } finally { setBusy(false); }
  }
  return <Layout><div className="form-page"><div className="form-intro"><small>PUBLISH A GAME</small><h1>Submit it for review.</h1><p>Upload one ZIP. Your game must contain an <code>index.html</code> entry point. It stays private until an admin approves it.</p></div><form className="form-card" onSubmit={submit}><label>Title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Game title" /></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell players about your game" /></label><label>Game ZIP<input type="file" accept=".zip" onChange={e => setZipFile(e.target.files?.[0] || null)} /><span className="hint">index.html is required. .js, .css, .json, .wasm, images, audio and more are supported.</span></label><label>Thumbnail<input type="file" accept="image/*" onChange={e => setThumb(e.target.files?.[0] || null)} /></label><button className="primary" disabled={busy}>{busy ? status || 'Uploading...' : 'Submit for review'}</button>{!busy && status && <div className="notice error">{status}</div>}</form></div></Layout>;
}

function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [username, setUsername] = useState(''); const [displayName, setDisplayName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const navigate = useNavigate(); const location = useLocation();

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) navigate('/', { replace: true }); }); }, [navigate, location.search]);

  async function discordLogin() {
    setBusy(true); setError(''); setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: redirectUrl() } });
    if (error) { setError(error.message); setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const cleanEmail = email.trim();
      if (mode === 'signup') {
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
        if (cleanUsername.length < 3) throw new Error('Username must be at least 3 characters.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: { username: cleanUsername, user_name: cleanUsername, display_name: displayName.trim() || cleanUsername } } });
        if (error) throw error;
        if (!data.session) setMessage('Account created. Check your email if email confirmation is enabled, then sign in.');
        else navigate('/');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        navigate('/');
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Authentication failed.'); } finally { setBusy(false); }
  }

  return <Layout><div className="auth-page"><div className="auth-card"><div className="auth-brand"><span>Upload</span>NPlay</div><small>WELCOME TO UPLOADNPLAY</small><h1>{mode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h1><p>{mode === 'signin' ? 'Sign in to play, publish and manage your games.' : 'Make an account and start using UploadNPlay.'}</p><button type="button" className="discord-button" onClick={discordLogin} disabled={busy}><DiscordIcon />Continue with Discord</button><div className="auth-divider"><span>or</span></div><form onSubmit={submit}>{mode === 'signup' && <><label>Username<input required value={username} onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} placeholder="yourname" maxLength={30} /></label><label>Display name<input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" maxLength={80} /></label></>}<label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label><label>Password<input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label><button className="primary auth-submit" disabled={busy}>{busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}</button></form>{message && <div className="notice success">{message}</div>}{error && <div className="notice error">{error}</div>}<div className="auth-switch">{mode === 'signin' ? <>New to UploadNPlay? <button onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Create an account</button></> : <>Already have an account? <button onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>Sign in</button></>}</div><a className="discord-community" href={DISCORD_URL} target="_blank" rel="noreferrer">Join the UploadNPlay Discord</a></div></div></Layout>;
}

function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null); const [displayName, setDisplayName] = useState(''); const [username, setUsername] = useState(''); const [bio, setBio] = useState(''); const [avatar, setAvatar] = useState<File | null>(null); const [message, setMessage] = useState('');
  useEffect(() => { (async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const p = await loadOrCreateProfile(user); if (!p) return; setProfile(p); setDisplayName(p.display_name || ''); setUsername(p.username || ''); setBio(p.bio || ''); })(); }, []);
  async function save(event: FormEvent) { event.preventDefault(); if (!profile) return; setMessage('Saving...'); try { let avatarUrl = profile.avatar_url || null; if (avatar) { const extension = avatar.name.split('.').pop()?.toLowerCase() || 'png'; const path = `${profile.id}/avatar.${extension}`; const { error } = await supabase.storage.from('avatars').upload(path, avatar, { upsert: true, contentType: avatar.type || 'image/png' }); if (error) throw error; avatarUrl = publicUrl('avatars', path); } const newUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30); if (newUsername.length < 3) throw new Error('Username must be at least 3 characters.'); const { data, error } = await supabase.from('profiles').update({ username: newUsername, display_name: displayName.trim() || newUsername, bio: bio.trim(), avatar_url: avatarUrl }).eq('id', profile.id).select('*').single(); if (error) throw error; setProfile(data as Profile); setMessage('Profile saved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save profile.'); } }
  if (!profile) return <Layout><div className="empty-page">Sign in first.</div></Layout>;
  return <Layout><div className="profile-page"><section className="profile-cover"><div className="profile-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{(profile.display_name || profile.username).slice(0, 1).toUpperCase()}</span>}</div><div><small>PROFILE</small><h1>{profile.display_name || profile.username}</h1><p>@{profile.username}</p></div></section><form className="form-card profile-form" onSubmit={save}><h2>Edit profile</h2><label>Profile picture<input type="file" accept="image/*" onChange={e => setAvatar(e.target.files?.[0] || null)} /></label><label>Display name<input value={displayName} onChange={e => setDisplayName(e.target.value)} /></label><label>Username<input value={username} onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} /></label><label>Bio<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} placeholder="Tell people about yourself" /></label><button className="primary">Save profile</button>{message && <div className="notice">{message}</div>}</form></div></Layout>;
}

function Library() {
  const [games, setGames] = useState<Game[]>([]); const [error, setError] = useState('');
  useEffect(() => { supabase.auth.getUser().then(async ({ data: { user } }) => { if (!user) return; const { data, error } = await supabase.from('games').select('*, profiles(username,display_name)').eq('developer_id', user.id).order('created_at', { ascending: false }); if (error) setError(error.message); setGames((data as Game[]) || []); }); }, []);
  return <Layout><div className="library-page"><div className="library-head"><div><small>LIBRARY</small><h1>Your games</h1><p>Your submitted games and their current status.</p></div><Link className="primary" to="/upload">Publish a game</Link></div>{error && <div className="notice error">{error}</div>}{games.length ? <div className="library-list">{games.map(g => <div className="library-row" key={g.id}>{g.thumbnail_url ? <img src={g.thumbnail_url} alt="" /> : <div className="mini-placeholder">{g.title.slice(0, 1)}</div>}<div><h3>{g.title}</h3><p>{g.description || 'No description'}</p></div><span className={`status status-${g.status || 'pending'}`}>{g.status || 'pending'}</span><Link to={`/game/${g.id}`}>Open</Link></div>)}</div> : <div className="empty">No submitted games yet.</div>}</div></Layout>;
}

function Developer() {
  const [profile, setProfile] = useState<Profile | null>(null); const [games, setGames] = useState<Game[]>([]); const [views, setViews] = useState(0); const [viewCounts, setViewCounts] = useState<Record<string, number>>({}); const [error, setError] = useState('');
  useEffect(() => { (async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const p = await loadOrCreateProfile(user); setProfile(p); if (!p?.is_dev && !p?.is_admin) return; const { data: g, error } = await supabase.from('games').select('*, profiles(username,display_name)').eq('developer_id', user.id).order('created_at', { ascending: false }); if (error) setError(error.message); const list = (g as Game[]) || []; setGames(list); if (list.length) { const { data: rows } = await supabase.from('game_views').select('game_id').in('game_id', list.map(game => game.id)); const counts: Record<string, number> = {}; (rows || []).forEach((row: { game_id: string }) => { counts[row.game_id] = (counts[row.game_id] || 0) + 1; }); setViewCounts(counts); setViews((rows || []).length); } })(); }, []);
  if (!profile) return <Layout><div className="empty-page">Sign in first.</div></Layout>; if (!profile.is_dev && !profile.is_admin) return <Layout><div className="denied-page"><h1>Developer Portal</h1><p>Your account is not marked as a developer.</p></div></Layout>;
  const pending = games.filter(game => game.status === 'pending').length; const approved = games.filter(game => game.status === 'approved').length;
  return <Layout><div className="portal"><div className="portal-head"><div><small>DEVELOPER PORTAL</small><h1>Overview</h1><p>See your games, review status and player traffic.</p></div><Link className="primary" to="/upload">New game</Link></div>{error && <div className="notice error">{error}</div>}<div className="stats"><div><b>{games.length}</b><span>Total games</span></div><div><b>{approved}</b><span>Approved</span></div><div><b>{pending}</b><span>Pending</span></div><div><b>{views}</b><span>Total views</span></div></div><div className="portal-list">{games.length ? games.map(game => <div className="portal-game" key={game.id}>{game.thumbnail_url ? <img src={game.thumbnail_url} alt="" /> : <div className="mini-placeholder">{game.title.slice(0, 1)}</div>}<div className="portal-game-copy"><h3>{game.title}</h3><p>{game.description || 'No description'}</p></div><span className={`status status-${game.status || 'pending'}`}>{game.status || 'pending'}</span><span className="view-count">{viewCounts[game.id] || 0} views</span><Link to={`/game/${game.id}`}>Open</Link></div>) : <div className="empty">No games submitted.</div>}</div></div></Layout>;
}

function Admin() {
  const [allowed, setAllowed] = useState(false); const [games, setGames] = useState<Game[]>([]); const [reason, setReason] = useState<Record<string, string>>({}); const [message, setMessage] = useState('');
  async function load() { const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(); if (!p?.is_admin) return; setAllowed(true); const { data } = await supabase.from('games').select('*, profiles(username,display_name)').order('created_at', { ascending: true }); setGames((data as Game[]) || []); }
  useEffect(() => { load(); }, []);
  async function moderate(id: string, status: 'approved' | 'rejected') { setMessage('Saving...'); const payload = status === 'rejected' ? { status, rejection_reason: reason[id]?.trim() || 'No reason provided.' } : { status, rejection_reason: null }; const { error } = await supabase.from('games').update(payload).eq('id', id); if (error) setMessage(error.message); else { setMessage(status === 'approved' ? 'Game approved.' : 'Game rejected.'); await load(); } }
  if (!allowed) return <Layout><div className="denied-page"><h1>Admin</h1><p>You do not have access to this page.</p></div></Layout>;
  const pending = games.filter(game => game.status === 'pending');
  return <Layout><div className="admin-page"><div className="portal-head"><div><small>ADMIN</small><h1>Game review</h1><p>Approve or reject submitted games before they appear publicly.</p></div></div>{message && <div className="notice">{message}</div>}<div className="review-list">{pending.length ? pending.map(game => <div className="review-card" key={game.id}>{game.thumbnail_url ? <img src={game.thumbnail_url} alt="" /> : <div className="review-placeholder">{game.title.slice(0, 1)}</div>}<div className="review-copy"><small>SUBMITTED BY @{game.profiles?.username || 'developer'}</small><h2>{game.title}</h2><p>{game.description || 'No description provided.'}</p><Link to={`/game/${game.id}`}>Preview submission</Link><textarea value={reason[game.id] || ''} onChange={e => setReason({ ...reason, [game.id]: e.target.value })} placeholder="Reason for rejection (optional)" /></div><div className="review-actions"><button className="primary" onClick={() => moderate(game.id, 'approved')}>Approve</button><button className="danger" onClick={() => moderate(game.id, 'rejected')}>Reject</button></div></div>) : <div className="empty">No games waiting for review.</div>}</div></div></Layout>;
}

function GamePage() {
  const { id } = useParams(); const [game, setGame] = useState<Game | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!id) return; (async () => { const { data, error } = await supabase.from('games').select('*, profiles(username,display_name)').eq('id', id).maybeSingle(); if (error || !data) { setLoading(false); return; } const g = data as Game; setGame(g); setLoading(false); if (g.status === 'approved') { const { data: { user } } = await supabase.auth.getUser(); await supabase.from('game_views').insert({ game_id: g.id, viewer_id: user?.id ?? null }); } })(); }, [id]);
  if (loading) return <Layout><div className="empty-page">Loading...</div></Layout>; if (!game) return <Layout><div className="empty-page">Game not found.</div></Layout>;
  const playable = game.status === 'approved'; const fileUrl = publicUrl('game-files', `${game.id}/${game.entry_point}`);
  return <Layout><div className="game-page">{!playable && <div className="review-banner">This game is <b>{game.status || 'pending'}</b>{game.rejection_reason && <span> — {game.rejection_reason}</span>}</div>}<div className="game-heading">{game.thumbnail_url ? <img src={game.thumbnail_url} alt="" /> : <div className="title-placeholder">{game.title.slice(0, 1)}</div>}<div><small>GAME</small><h1>{game.title}</h1><p>by {game.profiles?.display_name || game.profiles?.username || 'Developer'}</p></div></div>{playable ? <div className="player"><iframe src={fileUrl} title={game.title} sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms" allow="fullscreen; pointer-lock" /><button onClick={() => document.querySelector('.player')?.requestFullscreen()}>Fullscreen</button></div> : <div className="blocked-game"><div><h2>{game.status === 'rejected' ? 'This game was not approved' : 'Waiting for approval'}</h2><p>{game.status === 'rejected' ? 'The developer can resubmit after making changes.' : 'An admin must approve this game before it becomes public.'}</p></div></div>}<div className="game-description"><small>ABOUT THIS GAME</small><p>{game.description || 'No description provided.'}</p></div></div></Layout>;
}

export default function App() {
  return <Routes><Route path="/" element={<Home />} /><Route path="/upload" element={<Upload />} /><Route path="/auth" element={<Auth />} /><Route path="/profile" element={<Profile />} /><Route path="/library" element={<Library />} /><Route path="/developer" element={<Developer />} /><Route path="/admin" element={<Admin />} /><Route path="/game/:id" element={<GamePage />} /><Route path="*" element={<Home />} /></Routes>;
}
