import { useEffect, useMemo, useState } from 'react';
import {
  Aperture, ArrowRight, CalendarDays, Camera, Check, ChevronDown, ChevronLeft,
  Clock3, Compass, Heart, ImagePlus, MapPin, Menu, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Star, Wallet, X, UserRound, LogOut, BriefcaseBusiness, LayoutDashboard
} from 'lucide-react';
import { api } from './api';

const categories = ['All categories','Weddings','Portraits','Products','Fashion','Events','Commercial','Travel'];
const money = n => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(Number(n || 0));
const today = new Date().toISOString().slice(0,10);

function App() {
  const [user,setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shutterlink_user') || 'null'); } catch { return null; }
  });
  const [photographers,setPhotographers] = useState([]);
  const [filters,setFilters] = useState({ search:'', category:'All categories', city:'', maxPrice:'', minRating:'', date:'' });
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [active,setActive] = useState('discover');
  const [selected,setSelected] = useState(null);
  const [authOpen,setAuthOpen] = useState(false);
  const [authMode,setAuthMode] = useState('login');
  const [bookingTarget,setBookingTarget] = useState(null);
  const [toast,setToast] = useState('');
  const [mobileMenu,setMobileMenu] = useState(false);
  const [bookings,setBookings] = useState([]);
  const [busy,setBusy] = useState(false);

  async function loadPhotographers(nextFilters = filters) {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([k,v]) => {
        if (v && !(k === 'category' && v === 'All categories')) params.set(k,v);
      });
      const data = await api(`/photographers?${params.toString()}`);
      setPhotographers(data.photographers || []);
    } catch (e) { setError(e.message); setPhotographers([]); }
    finally { setLoading(false); }
  }

  async function loadBookings() {
    if (!user) return;
    try { const data = await api('/bookings/mine'); setBookings(data.bookings || []); }
    catch (e) { setToast(e.message); }
  }

  useEffect(() => { loadPhotographers({ search:'', category:'All categories', city:'', maxPrice:'', minRating:'', date:'' }); }, []);
  useEffect(() => { if (user) loadBookings(); else setBookings([]); }, [user]);

  function signIn(data) {
    localStorage.setItem('shutterlink_token', data.token);
    localStorage.setItem('shutterlink_user', JSON.stringify(data.user));
    setUser(data.user); setAuthOpen(false); setToast(`Welcome${data.user.name ? `, ${data.user.name.split(' ')[0]}` : ''}!`);
  }
  function signOut() {
    localStorage.removeItem('shutterlink_token'); localStorage.removeItem('shutterlink_user');
    setUser(null); setActive('discover'); setToast('You have signed out.');
  }
  function updateFilter(key,value) { setFilters(prev => ({...prev,[key]:value})); }
  function doSearch(e) { e?.preventDefault(); loadPhotographers(filters); setActive('discover'); }
  function startBooking(p) {
    if (!user) { setAuthMode('login'); setAuthOpen(true); setToast('Sign in with a client account to book.'); return; }
    if (user.role !== 'client') { setToast('Switch to a client account to make bookings.'); return; }
    setBookingTarget(p);
  }

  async function submitBooking(form) {
    setBusy(true);
    try {
      const result = await api('/bookings', { method:'POST', body:JSON.stringify(form) });
      setBookingTarget(null); setSelected(null); setToast(`Booking #${result.booking.id} created. You can complete demo payment in My bookings.`);
      setActive('bookings'); await loadBookings();
    } catch (e) { setToast(e.message); }
    finally { setBusy(false); }
  }

  async function payDemo(id) {
    setBusy(true);
    try {
      const result = await api(`/bookings/${id}/demo-payment`, { method:'POST', body:JSON.stringify({}) });
      setToast(`${result.message} Reference: ${result.reference}`); await loadBookings();
    } catch (e) { setToast(e.message); }
    finally { setBusy(false); }
  }

  async function saveProfile(form) {
    setBusy(true);
    try {
      await api('/photographers/me', { method:'PUT', body:JSON.stringify(form) });
      setToast('Your profile has been updated.'); await loadPhotographers();
    } catch (e) { setToast(e.message); }
    finally { setBusy(false); }
  }

  async function addPortfolio(form) {
    setBusy(true);
    try {
      await api('/photographers/me/portfolio', { method:'POST', body:JSON.stringify(form) });
      setToast('Portfolio item added.'); await loadPhotographers();
    } catch (e) { setToast(e.message); }
    finally { setBusy(false); }
  }

  const featured = useMemo(() => [...photographers].sort((a,b) => b.rating-a.rating).slice(0,3), [photographers]);

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => {setActive('discover');setSelected(null);}} aria-label="ShutterLink home">
        <span className="brand-mark"><Aperture size={23}/></span>
        <span>shutter<span className="brand-light">link</span><small>THE CREATIVE COLLECTIVE</small></span>
      </button>
      <nav className={`nav-links ${mobileMenu ? 'nav-open' : ''}`}>
        <button className={active==='discover'?'nav-active':''} onClick={() => {setActive('discover');setSelected(null);setMobileMenu(false);}}>Discover</button>
        <button className={active==='how'?'nav-active':''} onClick={() => {setActive('how');setSelected(null);setMobileMenu(false);}}>How it works</button>
        {user && <button className={active==='bookings'?'nav-active':''} onClick={() => {setActive('bookings');setSelected(null);setMobileMenu(false);}}>My bookings</button>}
        {user?.role === 'photographer' && <button className={active==='studio'?'nav-active':''} onClick={() => {setActive('studio');setSelected(null);setMobileMenu(false);}}>My studio</button>}
      </nav>
      <div className="top-actions">
        {user ? <div className="user-chip"><span className="avatar">{user.name?.slice(0,1).toUpperCase()}</span><span className="user-name">{user.name?.split(' ')[0]}</span><button className="icon-button" title="Sign out" onClick={signOut}><LogOut size={17}/></button></div>
          : <><button className="btn-quiet" onClick={() => {setAuthMode('login');setAuthOpen(true);}}>Log in</button><button className="btn-dark small-btn" onClick={() => {setAuthMode('register');setAuthOpen(true);}}>Join the community <ArrowRight size={15}/></button></>}
        <button className="icon-button menu-toggle" onClick={() => setMobileMenu(v=>!v)} aria-label="Toggle menu">{mobileMenu?<X/>:<Menu/>}</button>
      </div>
    </header>

    {active==='discover' && !selected && <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot"/> A BETTER WAY TO BOOK CREATIVITY</div>
          <h1>Find the eye behind<br/>your <em>next big moment.</em></h1>
          <p className="hero-desc">Meet independent photographers who see the world differently. Your people, your vision, your story.</p>
          <div className="hero-proof"><div className="avatar-stack"><span>M</span><span>A</span><span>Z</span><span>+</span></div><div><div className="proof-stars">★★★★★</div><small>Made for moments that matter</small></div></div>
        </div>
        <div className="hero-visual">
          <img className="hero-image" src="https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1400&q=85" alt="Wedding couple captured by a photographer"/>
          <div className="photo-note"><span className="note-icon"><Camera size={17}/></span><div><b>Stories, not just pictures.</b><small>Find your perfect match</small></div><Sparkles size={18} className="note-sparkle"/></div>
          <div className="hero-number">01 <span>/ YOUR STORY STARTS HERE</span></div>
        </div>
      </section>

      <section className="search-panel">
        <div className="search-heading"><div><span className="section-kicker">THE RIGHT PERSON CHANGES EVERYTHING</span><h2>Find your photographer</h2></div><span className="search-count"><Compass size={16}/> Curated creative talent</span></div>
        <form className="filters" onSubmit={doSearch}>
          <label className="filter-field search-field"><span>KEYWORD</span><div><Search size={17}/><input value={filters.search} onChange={e=>updateFilter('search',e.target.value)} placeholder="Name, style, or specialty"/></div></label>
          <label className="filter-field"><span>PHOTOGRAPHY</span><div><Camera size={17}/><select value={filters.category} onChange={e=>updateFilter('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select><ChevronDown size={15}/></div></label>
          <label className="filter-field"><span>LOCATION</span><div><MapPin size={17}/><input value={filters.city} onChange={e=>updateFilter('city',e.target.value)} placeholder="City"/></div></label>
          <button className="btn-coral search-button" type="submit"><Search size={17}/> Find talent</button>
          <div className="filter-extra">
            <label><span>MAX BUDGET</span><select value={filters.maxPrice} onChange={e=>updateFilter('maxPrice',e.target.value)}><option value="">Any budget</option><option value="3000">Up to ₹3,000</option><option value="5000">Up to ₹5,000</option><option value="8000">Up to ₹8,000</option><option value="12000">Up to ₹12,000</option></select></label>
            <label><span>MINIMUM RATING</span><select value={filters.minRating} onChange={e=>updateFilter('minRating',e.target.value)}><option value="">Any rating</option><option value="4">4.0+ stars</option><option value="4.5">4.5+ stars</option><option value="4.8">4.8+ stars</option></select></label>
            <label><span>AVAILABLE ON</span><input type="date" min={today} value={filters.date} onChange={e=>updateFilter('date',e.target.value)}/></label>
            <button className="clear-filters" type="button" onClick={()=>{const f={search:'',category:'All categories',city:'',maxPrice:'',minRating:'',date:''};setFilters(f);loadPhotographers(f);}}>Clear filters</button>
          </div>
        </form>
      </section>

      <section className="talent-section">
        <div className="section-head"><div><span className="section-kicker">GOOD PEOPLE. GREAT PERSPECTIVES.</span><h2>{filters.search || filters.category!=='All categories' || filters.city ? 'Your kind of creative' : 'Photographers worth knowing'}</h2><p>Independent talent, thoughtfully discovered.</p></div><span className="result-count">{loading?'Finding your match…':`${photographers.length} photographer${photographers.length===1?'':'s'} found`}</span></div>
        {error && <div className="error-banner">{error} — make sure the backend and MySQL are running.</div>}
        {loading ? <div className="loading-grid">{[1,2,3].map(n=><div className="skeleton" key={n}/>)}</div>
          : photographers.length ? <div className="photographer-grid">{photographers.map(p=><PhotographerCard key={p.id} p={p} onOpen={()=>setSelected(p)} onBook={()=>startBooking(p)}/>)}</div>
          : <div className="empty-state"><Search size={30}/><h3>No photographers found</h3><p>Try another city, category, or budget.</p><button className="btn-dark" onClick={()=>{const f={search:'',category:'All categories',city:'',maxPrice:'',minRating:'',date:''};setFilters(f);loadPhotographers(f);}}>Show everyone</button></div>}
      </section>

      <section className="bottom-banner"><div className="banner-icon"><Camera size={23}/></div><div><span className="section-kicker">BEHIND THE CAMERA?</span><h2>Your next client is looking for you.</h2><p>Create a photographer account to build your portfolio and get discovered.</p></div><button className="btn-dark" onClick={()=>{setAuthMode('register');setAuthOpen(true);}}>Join as a photographer <ArrowRight size={16}/></button></section>
    </main>}

    {active==='how' && <HowItWorks onJoin={()=>{setAuthMode('register');setAuthOpen(true);}}/>}
    {active==='bookings' && <Bookings bookings={bookings} user={user} onPay={payDemo} busy={busy} onDiscover={()=>setActive('discover')}/>}
    {active==='studio' && user?.role==='photographer' && <Studio onSave={saveProfile} onAdd={addPortfolio} busy={busy}/>}

    {selected && <PhotographerDetail p={selected} onBack={()=>setSelected(null)} onBook={()=>startBooking(selected)}/>}
    {authOpen && <AuthModal mode={authMode} onMode={setAuthMode} onClose={()=>setAuthOpen(false)} onSuccess={signIn}/>}
    {bookingTarget && <BookingModal p={bookingTarget} onClose={()=>setBookingTarget(null)} onSubmit={submitBooking} busy={busy}/>}
    {toast && <div className="toast" role="status"><Check size={17}/><span>{toast}</span><button onClick={()=>setToast('')} aria-label="Dismiss"><X size={15}/></button></div>}
    <footer className="footer"><div className="footer-brand"><Aperture size={20}/> shutterlink</div><span>Made for moments that matter.</span><span>© 2026 ShutterLink · College project demo</span></footer>
  </div>;
}

function PhotographerCard({p,onOpen,onBook}) {
  const [liked,setLiked] = useState(false);
  return <article className="photographer-card">
    <button className="card-image-button" onClick={onOpen} aria-label={`View ${p.name}'s profile`}><img className="card-cover" src={p.cover_image} alt={`${p.name} photography`} loading="lazy"/><span className="image-tag"><Sparkles size={13}/> {p.categories?.[0] || 'Photographer'}</span></button>
    <button className={`heart-button ${liked?'is-liked':''}`} onClick={()=>setLiked(v=>!v)} aria-label="Save photographer"><Heart size={17} fill={liked?'currentColor':'none'}/></button>
    <div className="card-body">
      <div className="card-name-row"><button className="photographer-name" onClick={onOpen}>{p.name}</button><span className="rating"><Star size={14} fill="currentColor"/>{Number(p.rating).toFixed(1)} <small>({p.review_count})</small></span></div>
      <p className="card-headline">{p.headline}</p>
      <div className="card-location"><MapPin size={14}/>{p.city}</div>
      <div className="portfolio-strip">{(p.portfolio||[]).slice(0,3).map(item=><img key={item.id} src={item.image_url} alt={item.title} loading="lazy"/>)}{(!p.portfolio||!p.portfolio.length)&&<span>Portfolio coming soon</span>}</div>
      <div className="card-bottom"><div><small>PACKAGES FROM</small><strong>{money(p.price_from)}<small> / shoot</small></strong></div><button className="btn-outline" onClick={onOpen}>View profile <ArrowRight size={14}/></button></div>
    </div>
  </article>;
}

function AuthModal({mode,onMode,onClose,onSuccess}) {
  const [form,setForm] = useState({name:'',email:'',password:'',role:'client'});
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api(mode==='login'?'/auth/login':'/auth/register',{method:'POST',body:JSON.stringify(form)});
      onSuccess(data);
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <Modal onClose={onClose}><div className="modal-kicker"><Aperture size={20}/> SHUTTERLINK COMMUNITY</div><h2>{mode==='login'?'Welcome back.':'Find your people.'}</h2><p className="modal-sub">{mode==='login'?'Sign in to manage your photography bookings.':'Join as a client or showcase your work as a photographer.'}</p>
    <form className="modal-form" onSubmit={submit}>
      {mode==='register'&&<><label>Full name<input required minLength="2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name"/></label><label>I want to<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="client">Hire a photographer</option><option value="photographer">Offer photography services</option></select></label></>}
      <label>Email address<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label>
      <label>Password<input type="password" required minLength="8" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></label>
      {error&&<div className="form-error">{error}</div>}
      <button className="btn-coral full-btn" disabled={busy}>{busy?'Please wait…':mode==='login'?'Log in':'Create account'} <ArrowRight size={16}/></button>
    </form>
    {mode==='login'&&<div className="demo-login"><b>Demo account</b><span>client@shutterlink.test</span><span>Password: Demo123!</span><button onClick={()=>setForm({name:'',email:'client@shutterlink.test',password:'Demo123!',role:'client'})}>Fill demo credentials</button></div>}
    <p className="switch-auth">{mode==='login'?'New around here?':'Already a member?'} <button onClick={()=>{onMode(mode==='login'?'register':'login');setError('');}}>{mode==='login'?'Create an account':'Log in'}</button></p>
  </Modal>;
}

function BookingModal({p,onClose,onSubmit,busy}) {
  const [form,setForm] = useState({event_date:'',event_time:'10:00',location:p.city,category:p.categories?.[0]||'Portraits',notes:''});
  const [error,setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    try { await onSubmit({...form,photographer_id:p.id}); }
    catch(e) { setError(e.message); }
  }
  return <Modal onClose={onClose}><div className="modal-kicker"><CalendarDays size={19}/> LET'S MAKE A PLAN</div><h2>Book {p.name.split(' ')[0]}</h2><p className="modal-sub">A booking request for a shoot with a clear next step.</p>
    <div className="booking-summary"><img src={p.cover_image} alt=""/><div><b>{p.name}</b><span>{p.headline}</span><strong>{money(p.price_from)} <small>starting package</small></strong></div></div>
    <form className="modal-form" onSubmit={submit}>
      <div className="form-row"><label>Shoot date<input required type="date" min={today} value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})}/></label><label>Start time<input required type="time" value={form.event_time} onChange={e=>setForm({...form,event_time:e.target.value})}/></label></div>
      <label>Shoot location<input required value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Venue or neighbourhood"/></label>
      <label>Photography type<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{(p.categories||categories.slice(1)).map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Anything else? <textarea rows="3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Mood, timings, or special requests…"/></label>
      {error&&<div className="form-error">{error}</div>}
      <div className="payment-note"><ShieldCheck size={17}/><span>You'll review a demo payment after creating the request. No real money is charged.</span></div>
      <button className="btn-coral full-btn" disabled={busy}>{busy?'Creating request…':'Request booking'} <ArrowRight size={16}/></button>
    </form>
  </Modal>;
}

function Modal({children,onClose}) {
  useEffect(()=>{const f=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f);},[onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal-card"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19}/></button>{children}</div></div>;
}

function PhotographerDetail({p,onBack,onBook}) {
  return <main className="detail-page">
    <button className="back-link" onClick={onBack}><ChevronLeft size={17}/> Back to discover</button>
    <div className="detail-hero"><img src={p.cover_image} alt={p.name}/><div className="detail-hero-overlay"><span className="eyebrow light-eyebrow">PHOTOGRAPHER PROFILE</span><h1>{p.name}</h1><p>{p.headline}</p><div className="detail-meta"><span><MapPin size={16}/>{p.city}</span><span><Star size={16} fill="currentColor"/>{Number(p.rating).toFixed(1)} ({p.review_count} reviews)</span><span><Wallet size={16}/>{money(p.price_from)} / shoot</span></div></div></div>
    <div className="detail-content"><section><span className="section-kicker">A LITTLE ABOUT THE ARTIST</span><h2>Every frame has a feeling.</h2><p className="bio-text">{p.bio || 'This photographer is ready to tell your story.'}</p><div className="category-pills">{(p.categories||[]).map(c=><span key={c}>{c}</span>)}</div><div className="portfolio-heading"><div><span className="section-kicker">SELECTED WORK</span><h2>The portfolio</h2></div><span>{(p.portfolio||[]).length} projects</span></div><div className="portfolio-grid">{(p.portfolio||[]).map((item,i)=><article className={`portfolio-item ${i===0?'portfolio-tall':''}`} key={item.id}><img src={item.image_url} alt={item.title}/><div><span>{item.category}</span><b>{item.title}</b></div></article>)}</div>{!p.portfolio?.length&&<p>Portfolio images will be added soon.</p>}</section><aside className="booking-aside"><span className="section-kicker">LET'S CREATE SOMETHING</span><h3>Make a little magic.</h3><p>Share your date and what you're dreaming up. The photographer can take it from there.</p><div className="price-large">{money(p.price_from)}<small> starting package</small></div><div className="aside-perk"><Check size={16}/> Direct booking request</div><div className="aside-perk"><Check size={16}/> Availability date check</div><div className="aside-perk"><Check size={16}/> Demo payment flow</div><button className="btn-coral full-btn" onClick={onBook}>Request a booking <ArrowRight size={16}/></button><small className="secure-note"><ShieldCheck size={13}/> Demo project · no real payment</small></aside></div>
  </main>;
}

function Bookings({bookings,user,onPay,busy,onDiscover}) {
  return <main className="dashboard-page"><div className="dashboard-heading"><span className="section-kicker">YOUR SHUTTERLINK</span><h1>{user?.role==='client'?'Your plans, in one place.':'Your upcoming shoots.'}</h1><p>Keep track of shoot details and booking status.</p></div>
    {!bookings.length?<div className="empty-state"><CalendarDays size={34}/><h3>No bookings yet</h3><p>Your next favourite frame could start with a search.</p><button className="btn-dark" onClick={onDiscover}>Discover photographers <ArrowRight size={15}/></button></div>
    :<div className="booking-list">{bookings.map(b=><article className="booking-row" key={b.id}><div className="booking-date"><CalendarDays size={19}/><b>{new Date(`${b.event_date}T12:00:00`).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</b><small>{new Date(`${b.event_date}T12:00:00`).getFullYear()}</small></div><div className="booking-info"><b>{user?.role==='client'?b.photographer_name:b.client_name}</b><span>{b.category} · {b.location}</span><small><Clock3 size={13}/> {String(b.event_time).slice(0,5)} · Booking #{b.id}</small></div><div className="booking-price"><b>{money(b.total_amount)}</b><span className={`status status-${b.status}`}>{b.status}</span></div>{user?.role==='client'&&b.status==='pending'&&<button className="btn-coral pay-btn" disabled={busy} onClick={()=>onPay(b.id)}><Wallet size={15}/> Demo pay</button>}</article>)}</div>}
    <div className="demo-warning"><ShieldCheck size={18}/><div><b>Demo payments only</b><p>Clicking “Demo pay” confirms the booking in this project's local database. No card details are collected and no real money is moved.</p></div></div>
  </main>;
}

function Studio({onSave,onAdd,busy}) {
  const [profile,setProfile] = useState({headline:'Independent photographer',bio:'',city:'Mumbai',categories:'Portraits, Weddings',price_from:'2500',cover_image:''});
  const [item,setItem] = useState({title:'',image_url:'',category:'Portraits'});
  return <main className="dashboard-page"><div className="dashboard-heading"><span className="section-kicker">YOUR CREATIVE SPACE</span><h1>Make your work findable.</h1><p>Keep your profile current and add images that show your point of view.</p></div>
    <div className="studio-grid"><form className="studio-card" onSubmit={e=>{e.preventDefault();onSave({...profile,categories:profile.categories.split(',').map(s=>s.trim()).filter(Boolean),price_from:Number(profile.price_from)});}}><div className="studio-card-heading"><UserRound/><div><h2>Profile details</h2><p>Tell clients what makes your work yours.</p></div></div><label>Headline<input required value={profile.headline} onChange={e=>setProfile({...profile,headline:e.target.value})}/></label><label>City<input required value={profile.city} onChange={e=>setProfile({...profile,city:e.target.value})}/></label><label>Categories <small>(comma separated)</small><input required value={profile.categories} onChange={e=>setProfile({...profile,categories:e.target.value})}/></label><label>Starting package price (₹)<input type="number" min="0" required value={profile.price_from} onChange={e=>setProfile({...profile,price_from:e.target.value})}/></label><label>Cover image URL<input type="url" value={profile.cover_image} onChange={e=>setProfile({...profile,cover_image:e.target.value})} placeholder="https://…"/></label><label>Bio<textarea rows="4" value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})}/></label><button className="btn-coral full-btn" disabled={busy}>Save profile <Check size={16}/></button></form>
    <form className="studio-card" onSubmit={e=>{e.preventDefault();onAdd(item);setItem({title:'',image_url:'',category:'Portraits'});}}><div className="studio-card-heading"><ImagePlus/><div><h2>Add to portfolio</h2><p>Use a publicly accessible image URL.</p></div></div><label>Project title<input required value={item.title} onChange={e=>setItem({...item,title:e.target.value})} placeholder="Golden hour portraits"/></label><label>Image URL<input required type="url" value={item.image_url} onChange={e=>setItem({...item,image_url:e.target.value})} placeholder="https://…"/></label><label>Category<select value={item.category} onChange={e=>setItem({...item,category:e.target.value})}>{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label><div className="portfolio-tip"><ImagePlus size={22}/><div><b>Show the work, not just the gear.</b><p>A strong portfolio gives clients a feel for your style. Only upload work you have permission to share.</p></div></div><button className="btn-dark full-btn" disabled={busy}>Add portfolio item <ArrowRight size={16}/></button></form></div>
  </main>;
}

function HowItWorks({onJoin}) {
  return <main className="how-page"><div className="dashboard-heading"><span className="section-kicker">SIMPLE BY DESIGN</span><h1>Good work. Good people.<br/><em>No guesswork.</em></h1><p>A calmer way to find the right photographer for the moment you want to remember.</p></div><div className="steps-grid"><article><span>01</span><Search size={27}/><h2>Find your fit</h2><p>Search by style, category, city, budget, rating, and the date you need.</p></article><article><span>02</span><CalendarDays size={27}/><h2>Make a plan</h2><p>Explore portfolios, share shoot details, and create a booking request.</p></article><article><span>03</span><ShieldCheck size={27}/><h2>Confirm with confidence</h2><p>Review the booking and try the demo payment flow. No real money is charged.</p></article></div><div className="how-cta"><h2>Ready to tell your story?</h2><button className="btn-coral" onClick={onJoin}>Join ShutterLink <ArrowRight size={16}/></button></div></main>;
}

export default App;
