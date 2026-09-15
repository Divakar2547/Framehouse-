import React, { useState, useRef } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { 
  Camera, ChevronRight, FolderOpen, Image, LayoutDashboard, LogOut, Plus, Search, 
  ShieldCheck, Sparkles, Users, X, UploadCloud, CheckCircle2, AlertCircle, 
  ExternalLink, Copy, Check, Lock, UserPlus, UserMinus, BarChart3, Download, Heart
} from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from './context/AuthContext';
import { eventApi, galleryApi, analyticsApi, uploadPhotoFile } from './services/api';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading Framehouse...</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function Shell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Camera size={18} /></span>
          <span>framehouse</span>
        </div>
        <div className="eyebrow">Workspace</div>
        <nav>
          <NavLink to={user?.role === 'ADMIN' ? '/admin/dashboard' : '/team/dashboard'}>
            <LayoutDashboard size={17} />Overview
          </NavLink>
          <NavLink to={user?.role === 'ADMIN' ? '/admin/events' : '/team/events'}>
            <FolderOpen size={17} />Events
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin/analytics">
              <BarChart3 size={17} />Analytics
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user?.name}</strong>
              <small>{user?.role === 'ADMIN' ? 'Lead photographer' : 'Team member'}</small>
            </div>
          </div>
          <button className="icon-button" title="Sign out" onClick={() => signOut().then(() => navigate('/login'))}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function Login({ register = false }) {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = register ? await signUp(name, email, password) : await signIn(email, password);
      navigate(user.role === 'ADMIN' ? '/admin/dashboard' : '/team/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to continue');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="brand light">
          <span className="brand-mark"><Camera size={18} /></span>framehouse
        </div>
        <div className="art-copy">
          <span className="kicker">A quieter place for beautiful work</span>
          <h1>Your best frames,<br /><em>together.</em></h1>
          <p>Coordinate the shoot, shape the story, and hand over a gallery that feels like yours.</p>
        </div>
        <div className="art-footer">Est. 2024 <span>•</span> For teams who care about the details</div>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <div>
          <span className="kicker">{register ? 'Create workspace' : 'Welcome back'}</span>
          <h2>{register ? 'Start your next story.' : 'Good to see you again.'}</h2>
          <p className="muted">{register ? 'Your team’s private studio starts here.' : 'Sign in to pick up where you left off.'}</p>
        </div>
        {register && (
          <label>
            Full name
            <input value={name} onChange={e => setName(e.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button" disabled={busy}>
          {busy ? 'One moment...' : register ? 'Create account' : 'Sign in'}
          <ChevronRight size={17} />
        </button>
        <button type="button" className="text-button" onClick={() => navigate(register ? '/login' : '/register')}>
          {register ? 'Already have an account? Sign in' : 'New to Framehouse? Create an account'}
        </button>
      </form>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['events'], queryFn: eventApi.list });
  const events = data?.data?.events ?? [];
  const photoTotal = events.reduce((sum, event) => sum + (event._count?.photos ?? 0), 0);

  return (
    <>
      <header className="topbar">
        <div>
          <span className="kicker">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          <h1>Good morning, {user?.name?.split(' ')[0] || 'Studio'}.</h1>
        </div>
        {user?.role === 'ADMIN' && (
          <NavLink className="primary-button compact" to="/admin/events/new">
            <Plus size={17} />New event
          </NavLink>
        )}
      </header>
      <section className="hero-banner">
        <div>
          <span className="kicker light-text">The studio pulse</span>
          <h2>Make room for the<br /><em>good stuff.</em></h2>
          <p>{user?.role === 'ADMIN' ? 'Your active studio projects, in one calm view.' : 'Assigned event galleries ready for collaboration.'}</p>
        </div>
        <Sparkles className="hero-spark" size={92} />
      </section>
      <div className="stats-grid">
        <Stat label="Active events" value={String(events.filter(e => e.status === 'ACTIVE' || e.status === 'UPCOMING').length)} icon={<FolderOpen />} />
        <Stat label="Photographs" value={photoTotal.toLocaleString()} icon={<Image />} />
        <Stat label="Team assignments" value={String(events.reduce((sum, e) => sum + (e._count?.members ?? 0), 0))} icon={<Users />} />
        <Stat label="Published galleries" value={String(events.reduce((sum, e) => sum + (e._count?.galleries ?? 0), 0))} icon={<ShieldCheck />} />
      </div>
      <section className="section-heading">
        <div>
          <span className="kicker">Your workspace</span>
          <h2>Recent events</h2>
        </div>
        <NavLink className="text-link" to={user?.role === 'ADMIN' ? '/admin/events' : '/team/events'}>View all <ChevronRight size={15} /></NavLink>
      </section>
      {isLoading ? (
        <div className="empty-state">Loading your events...</div>
      ) : events.length ? (
        <div className="event-grid">
          {events.slice(0, 6).map(event => <EventCard key={event.id} event={event} />)}
        </div>
      ) : (
        <div className="empty-state">
          <FolderOpen size={28} />
          <h3>Your first story starts here.</h3>
          <p>{user?.role === 'ADMIN' ? 'Create an event to give your team a place to work.' : 'You have no assigned events yet.'}</p>
          {user?.role === 'ADMIN' && <NavLink className="primary-button" to="/admin/events/new">Create an event</NavLink>}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EventCard({ event }) {
  const { user } = useAuth();
  const basePath = user?.role === 'ADMIN' ? '/admin/events' : '/team/events';
  return (
    <NavLink className="event-card" to={`${basePath}/${event.id}`}>
      <div className="event-image">
        <Camera size={24} />
        <span>{event.status}</span>
      </div>
      <div className="event-card-body">
        <div>
          <h3>{event.name}</h3>
          <p>{event.location || 'Location to be added'} · {new Date(event.eventDate).toLocaleDateString()}</p>
        </div>
        <ChevronRight size={18} />
      </div>
      <div className="event-meta">
        <span><Image size={14} />{event._count?.photos ?? 0} photos</span>
        <span><Users size={14} />{event._count?.members ?? 0} members</span>
      </div>
    </NavLink>
  );
}

function Events() {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ['events'], queryFn: eventApi.list });
  const [query, setQuery] = useState('');
  const events = (data?.data?.events ?? []).filter(e => e.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <header className="topbar">
        <div>
          <span className="kicker">Workspace / Events</span>
          <h1>All events</h1>
        </div>
        {user?.role === 'ADMIN' && (
          <NavLink className="primary-button compact" to="/admin/events/new">
            <Plus size={17} />New event
          </NavLink>
        )}
      </header>
      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input placeholder="Search events" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <span className="muted">{events.length} projects</span>
      </div>
      <div className="event-grid">
        {events.map(event => <EventCard key={event.id} event={event} />)}
      </div>
    </>
  );
}

function NewEvent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', eventDate: '', location: '', description: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const result = await eventApi.create(form);
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate(`/admin/events/${result.data.event.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create event');
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <span className="kicker">Workspace / New event</span>
          <h1>Set the scene.</h1>
        </div>
      </header>
      <form className="panel form-panel" onSubmit={submit}>
        <div>
          <h2>Event details</h2>
          <p className="muted">A little context helps your team move quickly.</p>
        </div>
        <label>
          Event name
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Arjun & Priya Wedding" required />
        </label>
        <div className="form-row">
          <label>
            Event date
            <input type="date" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} required />
          </label>
          <label>
            Location
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Mumbai, India" />
          </label>
        </div>
        <label>
          Description
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="A short note about the day..." rows={4} />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => navigate(-1)}>Cancel</button>
          <button className="primary-button">Create event <ChevronRight size={17} /></button>
        </div>
      </form>
    </>
  );
}

// ─── Photo Upload Dropzone Modal ──────────────────────────────────────────────
function UploadModal({ eventId, onClose, onComplete }) {
  const [fileList, setFileList] = useState([]); // [{ file, id, status, progress, error, isDuplicate }]
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const handleIncomingFiles = (incoming) => {
    const rawFiles = Array.from(incoming);
    const newItems = rawFiles.map((file, idx) => {
      const id = `${file.name}-${file.size}-${Date.now()}-${idx}`;
      let error = null;
      let status = 'pending';

      if (!file.type.startsWith('image/') && !ALLOWED_TYPES.includes(file.type)) {
        error = 'Invalid file type. Only JPEG, PNG, WebP, HEIC supported.';
        status = 'error';
      } else if (file.size > MAX_FILE_SIZE) {
        error = `File exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`;
        status = 'error';
      }

      return {
        id,
        file,
        name: file.name,
        size: file.size,
        status,
        progress: 0,
        error,
        isDuplicate: false,
      };
    });

    setFileList(prev => [...prev, ...newItems]);
  };

  const uploadSingle = async (item) => {
    setFileList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading', progress: 5, error: null } : f));
    try {
      const result = await uploadPhotoFile(eventId, item.file, (percent) => {
        setFileList(prev => prev.map(f => f.id === item.id ? { ...f, progress: percent } : f));
      });

      if (result?.duplicate) {
        setFileList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'duplicate', progress: 100, isDuplicate: true } : f));
      } else {
        setFileList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'ready', progress: 100 } : f));
      }
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed';
      setFileList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: msg } : f));
      return false;
    }
  };

  const startUpload = async () => {
    setUploading(true);
    const toUpload = fileList.filter(f => f.status === 'pending' || f.status === 'error');
    let anySuccess = false;

    for (const item of toUpload) {
      const ok = await uploadSingle(item);
      if (ok) anySuccess = true;
    }

    setUploading(false);
    if (anySuccess) {
      onComplete();
    }
  };

  const retryItem = async (item) => {
    setUploading(true);
    const ok = await uploadSingle(item);
    setUploading(false);
    if (ok) onComplete();
  };

  const pendingCount = fileList.filter(f => f.status === 'pending').length;

  return (
    <div className="modal-overlay" onClick={uploading ? undefined : onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Upload Photographs</h3>
          <button className="icon-button" onClick={onClose} disabled={uploading}><X size={18} /></button>
        </div>

        <div 
          className="dropzone" 
          onDragOver={e => e.preventDefault()} 
          onDrop={e => { e.preventDefault(); handleIncomingFiles(e.dataTransfer.files); }}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <UploadCloud size={36} />
          <p>Drag photos here or <span>browse files</span></p>
          <small>Select multiple JPEG, PNG, WebP, HEIC up to 50MB</small>
          <input 
            type="file" 
            ref={fileInputRef} 
            multiple 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={e => handleIncomingFiles(e.target.files)} 
          />
        </div>

        {fileList.length > 0 && (
          <div className="upload-file-list">
            <h4>{fileList.length} photos in queue</h4>
            <div className="upload-items">
              {fileList.map((item) => (
                <div key={item.id} className="upload-item">
                  <span className="truncate" style={{ maxWidth: '200px' }} title={item.name}>{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.status === 'error' && (
                      <>
                        <span className="text-danger" style={{ fontSize: '11px' }} title={item.error}>
                          <AlertCircle size={14} /> {item.error || 'Failed'}
                        </span>
                        {!uploading && (
                          <button className="retry-btn" onClick={() => retryItem(item)}>Retry</button>
                        )}
                      </>
                    )}
                    {item.status === 'duplicate' && (
                      <span className="badge-duplicate" style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '3px' }}>
                        Duplicate
                      </span>
                    )}
                    {item.status === 'ready' && (
                      <span className="text-success"><CheckCircle2 size={14} /> Ready</span>
                    )}
                    {item.status === 'uploading' && (
                      <span>{item.progress}%</span>
                    )}
                    {item.status === 'pending' && (
                      <span className="muted">{(item.size / (1024 * 1024)).toFixed(1)} MB</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} disabled={uploading}>Close</button>
          <button 
            className="primary-button" 
            onClick={startUpload} 
            disabled={fileList.length === 0 || uploading || (pendingCount === 0 && !fileList.some(f => f.status === 'error'))}
          >
            {uploading ? 'Uploading & Processing...' : `Upload ${fileList.length} Photos`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Team Member Assignment Modal ─────────────────────────────────────────────
function TeamModal({ eventId, members, onClose, onRefresh }) {
  const [search, setSearch] = useState('');
  const [actionBusy, setActionBusy] = useState({});
  const { data: teamData, isLoading } = useQuery({ 
    queryKey: ['team-members', search], 
    queryFn: () => eventApi.listTeamMembers(search) 
  });
  const allUsers = teamData?.data?.users ?? [];
  const assignedIds = members.map(m => m.userId || m.user?.id);

  const add = async (userId) => {
    setActionBusy(prev => ({ ...prev, [userId]: true }));
    try {
      await eventApi.addMember(eventId, userId);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add member');
    } finally {
      setActionBusy(prev => ({ ...prev, [userId]: false }));
    }
  };

  const remove = async (userId) => {
    setActionBusy(prev => ({ ...prev, [userId]: true }));
    try {
      await eventApi.removeMember(eventId, userId);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    } finally {
      setActionBusy(prev => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Manage Event Team</h3>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="team-search">
          <input 
            placeholder="Search photographers by name or email..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <div className="team-list">
          {isLoading ? (
            <p className="muted text-center py-4">Loading team members...</p>
          ) : (
            allUsers.map(user => {
              const isAssigned = assignedIds.includes(user.id);
              const busy = actionBusy[user.id];
              return (
                <div key={user.id} className="team-item">
                  <div className="team-user-info">
                    <div className="avatar compact">{user.name.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </div>
                  </div>
                  {isAssigned ? (
                    <button 
                      className="secondary-button compact danger-btn" 
                      onClick={() => remove(user.id)}
                      disabled={busy}
                    >
                      <UserMinus size={14} /> {busy ? 'Removing...' : 'Remove'}
                    </button>
                  ) : (
                    <button 
                      className="primary-button compact" 
                      onClick={() => add(user.id)}
                      disabled={busy}
                    >
                      <UserPlus size={14} /> {busy ? 'Assigning...' : 'Assign'}
                    </button>
                  )}
                </div>
              );
            })
          )}
          {!isLoading && allUsers.length === 0 && <p className="muted text-center py-4">No team members found.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Gallery Publishing Modal ────────────────────────────────────────────────
function PublishModal({ eventId, availablePhotos, selectedPhotoIds, onClose, onPublished }) {
  const [form, setForm] = useState({
    title: 'Client Highlights',
    pin: '482917',
    allowDownloads: true,
    showWatermark: false,
    watermarkText: 'Framehouse Studio',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [publishedPin, setPublishedPin] = useState('');

  // Target photos: explicit selection if any, else all ready photos in the event
  const targetPhotoIds = selectedPhotoIds && selectedPhotoIds.length > 0
    ? selectedPhotoIds
    : availablePhotos.filter(p => p.status === 'READY').map(p => p.id);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    // PIN validation: exactly 6 numeric digits
    if (!/^\d{6}$/.test(form.pin)) {
      setError('PIN must be exactly 6 digits (numbers only)');
      return;
    }

    if (targetPhotoIds.length === 0) {
      setError('Cannot publish an empty gallery. Please upload photos first.');
      return;
    }

    setBusy(true);
    try {
      // 1. Create gallery
      const galRes = await galleryApi.create(eventId, form);
      const gallery = galRes.data.gallery;
      
      // 2. Add photos to gallery
      await galleryApi.addPhotos(gallery.id, targetPhotoIds);

      // 3. Publish gallery
      const pubRes = await galleryApi.publish(gallery.id);
      setPublishedUrl(pubRes.data.shareUrl || `${window.location.origin}/gallery/${gallery.slug}`);
      setPublishedPin(form.pin);
      onPublished();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not publish gallery');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Publish Client Gallery</h3>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        {publishedUrl ? (
          <div className="published-success">
            <CheckCircle2 size={48} className="text-success mx-auto" />
            <h3>Your gallery is live!</h3>
            <p>Share this private link and 6-digit access PIN with your client.</p>
            <div className="share-box">
              <input readOnly value={publishedUrl} />
              <button 
                className="secondary-button" 
                onClick={() => navigator.clipboard.writeText(publishedUrl)}
              >
                <Copy size={16} /> Copy Link
              </button>
            </div>
            <div className="pin-badge">
              <Lock size={15} /> <strong>Access PIN:</strong> <code style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.1em' }}>{publishedPin}</code>
            </div>
            <div style={{ marginTop: '16px' }}>
              <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="primary-button">
                Open Client Gallery <ExternalLink size={16} />
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              Gallery Title
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label>
              Access PIN (6 digits)
              <input 
                value={form.pin} 
                maxLength={6} 
                placeholder="e.g. 482917"
                onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} 
                required 
              />
            </label>
            <p className="muted" style={{ margin: '4px 0 12px', fontSize: '11px' }}>
              {targetPhotoIds.length} photos will be included in this gallery.
            </p>
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={form.allowDownloads} 
                onChange={e => setForm({ ...form, allowDownloads: e.target.checked })} 
              />
              Allow full-resolution photo downloads
            </label>
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={form.showWatermark} 
                onChange={e => setForm({ ...form, showWatermark: e.target.checked })} 
              />
              Enable subtle studio watermark
            </label>
            {form.showWatermark && (
              <label>
                Watermark Text
                <input 
                  value={form.watermarkText} 
                  onChange={e => setForm({ ...form, watermarkText: e.target.value })} 
                />
              </label>
            )}
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
              <button className="primary-button" disabled={busy || form.pin.length !== 6}>
                {busy ? 'Publishing...' : `Publish (${targetPhotoIds.length} Photos)`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function EventDetail() {
  const { eventId = '' } = useParams();
  const { user } = useAuth();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['event', eventId], queryFn: () => eventApi.get(eventId) });
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showUpload, setShowUpload] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const photosQuery = useQuery({
    queryKey: ['photos', eventId, search, sortBy, sortOrder],
    queryFn: () => eventApi.photos(eventId, { 
      search: search || undefined, 
      limit: 300,
      sortBy,
      sortOrder
    }),
  });
  const photos = photosQuery.data?.data?.photos ?? [];

  const toggle = (id) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const apply = async (value) => {
    await eventApi.bulkSelect(eventId, selected, value);
    setSelected([]);
    photosQuery.refetch();
    refetch();
  };

  const handleStatusChange = async (nextStatus) => {
    if (!nextStatus || nextStatus === data?.data?.event?.status) return;
    setStatusBusy(true);
    try {
      await eventApi.update(eventId, { status: nextStatus });
      await refetch();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update event status');
    } finally {
      setStatusBusy(false);
    }
  };

  if (isLoading) return <div className="loading-screen">Loading event...</div>;
  const event = data?.data?.event;
  if (!event) return <div className="empty-state">Event not found.</div>;

  const isAdmin = user?.role === 'ADMIN';

  return (
    <>
      <header className="topbar">
        <div>
          <span className="kicker">Events / {event.name}</span>
          <h1>{event.name}</h1>
          <p className="muted">{event.location || 'Location to be added'} · {new Date(event.eventDate).toLocaleDateString()}</p>
        </div>
        <div className="topbar-actions">
          {isAdmin && (
            <label className="status-editor" htmlFor="event-status-select">
              <span className="muted">Status</span>
              <select
                id="event-status-select"
                className="status-select"
                value={event.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusBusy}
                aria-label="Event status"
              >
                <option value="UPCOMING">UPCOMING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </label>
          )}
          <button className="secondary-button" onClick={() => setShowUpload(true)}>
            <UploadCloud size={16} /> Upload Photos
          </button>
          {isAdmin && (
            <>
              <button className="secondary-button" onClick={() => setShowTeam(true)}>
                <Users size={16} /> Manage Team
              </button>
              <button className="primary-button compact" onClick={() => setShowPublish(true)}>
                <ShieldCheck size={16} /> Publish Gallery
              </button>
            </>
          )}
        </div>
      </header>

      <div className="event-summary">
        <Stat label="Total photos" value={String(event._count?.photos ?? photos.length)} icon={<Image />} />
        <Stat label="Selected" value={String(photos.filter(p => p.isSelected).length)} icon={<ShieldCheck />} />
        <Stat label="Assigned Team" value={String(event.members?.length ?? 0)} icon={<Users />} />
      </div>

      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input placeholder="Search photo filename or number (e.g. 34)..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="toolbar-right">
          <span className="muted">Showing {photos.length} photos</span>
          {isAdmin && selected.length > 0 && (
            <div className="selection-actions">
              <button className="secondary-button compact" onClick={() => apply(false)}>Deselect</button>
              <button className="primary-button compact" onClick={() => apply(true)}>Select ({selected.length})</button>
            </div>
          )}
        </div>
      </div>

      <div className="photo-grid">
        {photos.map(photo => (
          <PhotoTile key={photo.id} photo={photo} selected={selected.includes(photo.id)} onClick={() => toggle(photo.id)} />
        ))}
      </div>
      {!photos.length && (
        <div className="empty-state">
          <Image size={32} />
          <h3>No photos in this event yet.</h3>
          <p>Upload high-resolution files to begin curation.</p>
          <button className="primary-button" onClick={() => setShowUpload(true)}>
            <UploadCloud size={16} /> Upload Photos Now
          </button>
        </div>
      )}

      {showUpload && (
        <UploadModal 
          eventId={eventId} 
          onClose={() => setShowUpload(false)} 
          onComplete={() => { setShowUpload(false); photosQuery.refetch(); refetch(); }} 
        />
      )}

      {showTeam && isAdmin && (
        <TeamModal 
          eventId={eventId} 
          members={event.members || []} 
          onClose={() => setShowTeam(false)} 
          onRefresh={() => { refetch(); }} 
        />
      )}

      {showPublish && isAdmin && (
        <PublishModal 
          eventId={eventId} 
          availablePhotos={photos}
          selectedPhotoIds={selected} 
          onClose={() => setShowPublish(false)} 
          onPublished={() => { photosQuery.refetch(); refetch(); }} 
        />
      )}
    </>
  );
}

function PhotoTile({ photo, selected, onClick }) {
  const [hasError, setHasError] = useState(false);
  return (
    <button className={`photo-tile ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="photo-thumbnail">
        {photo.thumbnailUrl && !hasError ? (
          <img 
            src={photo.thumbnailUrl} 
            alt={photo.originalFilename || photo.filename} 
            loading="lazy" 
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="photo-placeholder">
            <Camera size={26} />
          </div>
        )}
        <span className={`photo-tile-status badge-${(photo.status || 'ready').toLowerCase()}`}>
          {photo.status}
        </span>
      </div>
      <div className="photo-caption">
        <span className="truncate">{photo.originalFilename || photo.filename}</span>
        <small>{photo.width && photo.height ? `${photo.width}×${photo.height}` : photo.status} {photo.isSelected ? '· selected' : ''}</small>
      </div>
    </button>
  );
}

// ─── Admin Analytics Page ─────────────────────────────────────────────────────
function AnalyticsView() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-analytics'], queryFn: analyticsApi.dashboard });
  const stats = data?.data?.summary ?? {};
  const recentEvents = data?.data?.recentEvents ?? [];

  if (isLoading) return <div className="loading-screen">Loading analytics...</div>;

  return (
    <>
      <header className="topbar">
        <div>
          <span className="kicker">Studio / Intelligence</span>
          <h1>Gallery Analytics</h1>
        </div>
      </header>
      <div className="stats-grid">
        <Stat label="Total Events" value={String(stats.totalEvents ?? 0)} icon={<FolderOpen />} />
        <Stat label="Photographs" value={String(stats.totalPhotos ?? 0)} icon={<Image />} />
        <Stat label="Total Views" value={String(stats.totalViews ?? 0)} icon={<BarChart3 />} />
        <Stat label="Client Downloads" value={String(stats.totalDownloads ?? 0)} icon={<Download />} />
      </div>
      <section className="section-heading mt-6">
        <div>
          <span className="kicker">Live Overview</span>
          <h2>Active Events Performance</h2>
        </div>
      </section>
      <div className="panel">
        <div className="analytics-table">
          <div className="table-header">
            <span>Event Name</span>
            <span>Date</span>
            <span>Photos</span>
            <span>Status</span>
          </div>
          {recentEvents.map(ev => (
            <div key={ev.id} className="table-row">
              <strong>{ev.name}</strong>
              <span>{new Date(ev.eventDate).toLocaleDateString()}</span>
              <span>{ev._count?.photos ?? 0}</span>
              <span className="status-pill">{ev.status}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Gallery() {
  const { slug = '' } = useParams();
  const info = useQuery({ queryKey: ['gallery', slug], queryFn: () => galleryApi.publicInfo(slug) });
  const [verified, setVerified] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (info.isLoading) return <div className="gallery-loading">Opening gallery...</div>;
  if (info.isError || !info.data?.data?.gallery) {
    return (
      <div className="gallery-loading">
        <h1>Gallery unavailable</h1>
        <p>This gallery may be private or no longer available.</p>
      </div>
    );
  }

  const gallery = info.data.data.gallery;

  if (!verified) {
    const verify = async (e) => {
      e.preventDefault();
      try {
        await galleryApi.verifyPin(slug, pin);
        setVerified(true);
      } catch {
        setError('That PIN doesn’t look right.');
      }
    };
    return (
      <div className="pin-page">
        <div className="pin-card">
          <div className="brand">
            <span className="brand-mark"><Camera size={18} /></span>framehouse
          </div>
          <span className="kicker">Private gallery</span>
          <h1>{gallery.title}</h1>
          <p>{gallery.description || 'Enter your six-digit access code to view the photographs.'}</p>
          <form onSubmit={verify}>
            <input
              className="pin-input"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • • • •"
              required
            />
            <button className="primary-button">Open gallery <ChevronRight size={17} /></button>
            {error && <div className="form-error">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  return <GalleryView slug={slug} gallery={gallery} />;
}

function GalleryView({ slug, gallery }) {
  const photosQuery = useQuery({ queryKey: ['gallery-photos', slug], queryFn: () => galleryApi.photos(slug) });
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const photos = photosQuery.data?.data?.photos ?? [];

  const favorite = async (photo) => {
    const result = await galleryApi.favorite(slug, photo.id);
    setFavoriteIds(ids => result.data.favorited ? [...ids, photo.id] : ids.filter(id => id !== photo.id));
  };

  const [downloadingId, setDownloadingId] = useState(null);

  const download = async (photo) => {
    setDownloadingId(photo.id);
    try {
      const result = await galleryApi.download(slug, photo.id);
      const url = result?.data?.signedUrl;
      if (!url) throw new Error('No download URL available');

      try {
        const res = await fetch(url, { mode: 'cors' });
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = photo.filename || `${photo.originalFilename || 'photo'}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      } catch {
        const a = document.createElement('a');
        a.href = url;
        a.download = photo.filename || 'photo.jpg';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="gallery-page">
      <header className="gallery-header">
        <div className="brand">
          <span className="brand-mark"><Camera size={18} /></span>framehouse
        </div>
        <div className="gallery-title">
          <span className="kicker">{gallery.event?.name}</span>
          <h1>{gallery.title}</h1>
          <p>{gallery.description}</p>
        </div>
        <div className="gallery-count">{gallery.photoCount} photographs</div>
      </header>
      <div className="gallery-toolbar">
        <span>Curated for you</span>
        <span>{favoriteIds.length} favorites</span>
      </div>
      <div className="masonry">
        {photos.map(photo => (
          <figure key={photo.id} className="gallery-photo">
            <button onClick={() => setLightbox(photo)}>
              <img 
                src={photo.galleryUrl || photo.thumbnailUrl || photo.url} 
                alt={photo.filename} 
                loading="lazy" 
              />
            </button>
            <figcaption>
              <span>{photo.filename}</span>
              <div>
                <button
                  title="Favorite"
                  onClick={() => favorite(photo)}
                  className={favoriteIds.includes(photo.id) ? 'favorite active' : 'favorite'}
                >
                  ♥
                </button>
                {gallery.allowDownloads && (
                  <button 
                    title="Download high-resolution photograph" 
                    onClick={() => download(photo)} 
                    className="favorite"
                    disabled={downloadingId === photo.id}
                  >
                    {downloadingId === photo.id ? '⏳' : '↓'}
                  </button>
                )}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}><X /></button>
          <img 
            src={lightbox.galleryUrl || lightbox.thumbnailUrl || lightbox.url} 
            alt={lightbox.filename} 
            onClick={e => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Login register />} />
      <Route path="/gallery/:slug" element={<Gallery />} />
      <Route element={<Protected><Shell /></Protected>}>
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/events" element={<Events />} />
        <Route path="/admin/events/new" element={<NewEvent />} />
        <Route path="/admin/events/:eventId" element={<EventDetail />} />
        <Route path="/admin/analytics" element={<AnalyticsView />} />
        <Route path="/team/dashboard" element={<Dashboard />} />
        <Route path="/team/events" element={<Events />} />
        <Route path="/team/events/:eventId" element={<EventDetail />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
