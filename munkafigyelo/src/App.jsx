import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Bell, BellOff, Bookmark, BookmarkCheck, BriefcaseBusiness, Building2, CalendarDays,
  ChevronDown, ChevronRight, CircleHelp, Clock3, ExternalLink, Filter, Gauge,
  Flag, LayoutDashboard, Mail, MapPin, Menu, Phone, PlusCircle, Radar, RefreshCw, Search, Send, Settings,
  Share2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, TrendingUp, X, Zap
} from 'lucide-react'

const nav = [
  ['Áttekintés', LayoutDashboard, 'overview'], ['Találatok', Radar, 'results'], ['Mentett leadek', Bookmark, 'saved'], ['Saját hirdetéseim', BriefcaseBusiness, 'myads'],
  ['Értesítések', Bell, 'notifications'], ['Beállítások', Settings, 'settings'], ['Admin központ', ShieldCheck, 'admin']
]
const defaultTrades = ['Burkoló','Villanyszerelő','Kőműves','Tetőfedő','Festő','Térkövező','Közbeszerzés','Egyéb']
const defaultCounties = ['Budapest','Pest','Győr-Moson-Sopron','Komárom-Esztergom','Csongrád-Csanád','Bács-Kiskun']

function formatAge(date) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
  if (minutes < 1) return { minutes, age: 'most' }
  if (minutes < 60) return { minutes, age: `${minutes} perce` }
  if (minutes < 1440) return { minutes, age: `${Math.floor(minutes / 60)} órája` }
  return { minutes, age: `${Math.floor(minutes / 1440)} napja` }
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}

function sessionId() {
  let id = localStorage.getItem('szakilead-session')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('szakilead-session', id) }
  return id
}

function track(event, details = {}) {
  fetch('/api/events',{ method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
    body:JSON.stringify({ sessionId:sessionId(),event,leadId:details.leadId,metadata:details.metadata || {} }) }).catch(()=>{})
}

function App() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [query, setQuery] = useState('')
  const [trade, setTrade] = useState('Minden szakma')
  const [county, setCounty] = useState('Minden terület')
  const [fresh, setFresh] = useState('Bármikor')
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem('szakilead-saved') || '[]'))
  const [selected, setSelected] = useState(null)
  const [onlySaved, setOnlySaved] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState(false)
  const [pushState, setPushState] = useState('checking')
  const [pushMessage, setPushMessage] = useState('')
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [myAdsOpen, setMyAdsOpen] = useState(false)
  const [editingAd, setEditingAd] = useState(null)
  const [verificationNotice, setVerificationNotice] = useState(() => new URLSearchParams(location.search).get('verified') === '1')
  const [pushFilters, setPushFilters] = useState(() => JSON.parse(localStorage.getItem('szakilead-push-filters') || '{"trades":[],"counties":[],"minScore":60,"urgentOnly":false}'))

  async function loadLeads() {
    setLoading(true); setApiError('')
    try {
      const response = await fetch('/api/leads')
      if (!response.ok) throw new Error('A szerver nem válaszol.')
      const data = await response.json()
      const normalized = (data.leads || []).map(lead => ({ ...lead, ...formatAge(lead.publishedAt) }))
      setLeads(normalized)
      setSaved(previous => {
        const validIds = new Set(normalized.map(lead => lead.id))
        const cleaned = previous.filter(id => validIds.has(id))
        localStorage.setItem('szakilead-saved', JSON.stringify(cleaned))
        return cleaned
      })
    } catch (error) { setApiError(error.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadLeads()
    track('page_view')
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushState('unsupported'); return
    }
    navigator.serviceWorker.register('/sw.js').then(async registration => {
      const subscription = await registration.pushManager.getSubscription()
      setPushState(subscription ? 'enabled' : Notification.permission === 'denied' ? 'denied' : 'disabled')
    }).catch(() => setPushState('unsupported'))
  }, [])

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('lead')
    if (requested && leads.length) setSelected(leads.find(lead => String(lead.id) === requested) || null)
  }, [leads])

  useEffect(() => {
    if (query.trim().length < 3) return
    const timer = setTimeout(() => track('search_used',{metadata:{trade,county}}),900)
    return () => clearTimeout(timer)
  }, [query,trade,county])

  const trades = useMemo(() => [...new Set([...defaultTrades, ...leads.map(x => x.trade)])], [leads])
  const counties = useMemo(() => [...new Set([...defaultCounties, ...leads.map(x => x.county).filter(Boolean)])], [leads])
  const filtered = useMemo(() => leads.filter(lead => {
    const text = `${lead.title} ${lead.excerpt} ${lead.city} ${lead.trade}`.toLowerCase()
    const ageOk = fresh === 'Bármikor' || (fresh === '24 órán belül' && lead.minutes < 1440) || (fresh === '3 órán belül' && lead.minutes < 180)
    return text.includes(query.toLowerCase()) && (trade === 'Minden szakma' || lead.trade === trade) &&
      (county === 'Minden terület' || lead.county === county) && ageOk && (!onlySaved || saved.includes(lead.id))
  }), [leads, query, trade, county, fresh, onlySaved, saved])

  const todayCount = leads.filter(x => x.minutes < 1440).length
  const highCount = leads.filter(x => x.score >= 85).length

  async function enablePush() {
    setPushState('working'); setPushMessage('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setPushState(permission === 'denied' ? 'denied' : 'disabled'); return }
      const [registration, configResponse] = await Promise.all([navigator.serviceWorker.ready, fetch('/api/config')])
      const config = await configResponse.json()
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(config.vapidPublicKey) })
      const filters = pushFilters
      const response = await fetch('/api/push/subscribe',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription,filters}) })
      if (!response.ok) throw new Error('Az értesítés regisztrációja sikertelen.')
      setPushState('enabled'); setPushMessage('Azonnali értesítések bekapcsolva.')
      track('push_enable',{metadata:{trade,county}})
    } catch (error) { setPushState('disabled'); setPushMessage(error.message) }
  }

  async function disablePush() {
    setPushState('working'); setPushMessage('')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/push/subscribe',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})})
        await subscription.unsubscribe()
      }
      setPushState('disabled'); setPushMessage('Az értesítések kikapcsolva.')
      track('push_disable')
    } catch (error) { setPushState('enabled'); setPushMessage(error.message) }
  }

  async function savePushPreferences(filters) {
    setPushFilters(filters); localStorage.setItem('szakilead-push-filters',JSON.stringify(filters))
    if (pushState !== 'enabled') return true
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return false
    const response = await fetch('/api/push/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint,filters})})
    if (!response.ok) throw new Error('A push-beállítások mentése sikertelen.')
    return true
  }

  function toggleSaved(id) {
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id]
    setSaved(next); localStorage.setItem('szakilead-saved', JSON.stringify(next))
  }
  function clearFilters() { setQuery(''); setTrade('Minden szakma'); setCounty('Minden terület'); setFresh('Bármikor'); setOnlySaved(false) }
  function handleNavigation(action) {
    if (action === 'saved') setOnlySaved(true)
    if (action === 'overview' || action === 'results') { setOnlySaved(false); if (action === 'results') document.querySelector('.results-head')?.scrollIntoView({behavior:'smooth'}) }
    if (action === 'notifications') setNotice(true)
    if (action === 'settings') setSettingsOpen(true)
    if (action === 'myads') setMyAdsOpen(true)
    if (action === 'admin') location.href='/admin.html'
    setMobileNav(false)
  }
  function openLead(lead) { setSelected(lead); track('lead_open',{leadId:lead.id,metadata:{trade:lead.trade,source:lead.source}}) }
  async function shareApp() {
    track('share_click')
    const data = { title:'SzakiLead Figyelő',text:'Friss szakmunkák és építőipari lehetőségek egy helyen.',url:location.origin }
    if (navigator.share) { try { await navigator.share(data); return } catch { /* megosztás megszakítva */ } }
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.origin)}`,'szakilead-share','width=720,height=520')
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <button className="close-menu" onClick={() => setMobileNav(false)} aria-label="Menü bezárása"><X /></button>
      <div className="brand"><div className="brand-mark"><Radar /></div><div><strong>SzakiLead</strong><span>FIGYELŐ</span></div></div>
      <nav>{nav.map(([label, Icon, action]) => <button key={label} className={(action === 'overview' && !onlySaved) || (action === 'saved' && onlySaved) ? 'active' : ''} onClick={() => handleNavigation(action)}><Icon />{label}{label === 'Értesítések' && pushState === 'enabled' && <em>✓</em>}</button>)}</nav>
      <div className="side-card"><Sparkles /><b>LeadRadar</b><p>Az új RSS/API találatokat relevancia alapján szűri és pontozza.</p><span><i /> Szerveres figyelés</span></div>
      <div className="profile"><div>SL</div><span><b>SzakiLead fiók</b><small>Éles rendszer</small></span><ChevronRight /></div>
    </aside>
    {mobileNav && <div className="backdrop" onClick={() => setMobileNav(false)} />}

    <main>
      <header><button className="menu-btn" aria-label="Menü megnyitása" onClick={() => setMobileNav(true)}><Menu /></button><div><h1>Munkafigyelő központ <span>👋</span></h1><p>Friss, ellenőrzött szakmunka-hirdetések és azonnali értesítések.</p></div><div className="header-actions"><button className="submit-action" aria-label="Hirdetés feladása" onClick={() => { setSubmissionOpen(true); track('submission_open') }}><PlusCircle /> <span>Hirdetés feladása</span></button><button className="share-action" aria-label="Megosztás Facebookon" onClick={shareApp}><Share2 /> <span>Megosztás</span></button><button className="icon-btn" aria-label="Értesítések megnyitása" onClick={() => setNotice(!notice)}><Bell />{pushState === 'enabled' && <i />}</button></div></header>

      {notice && <div className="notification-pop"><b>Push értesítések</b><p>{pushState === 'enabled' ? 'Az azonnali értesítések aktívak.' : 'Kapcsold be az értesítéseket, hogy ne maradj le egy munkáról sem.'}</p><button className="mini-action" onClick={pushState === 'enabled' ? disablePush : enablePush}>{pushState === 'enabled' ? 'Kikapcsolás' : 'Bekapcsolás'}</button></div>}
      {verificationNotice && <div className="verification-banner"><ShieldCheck/><span><b>E-mail-cím megerősítve.</b> A hirdetésed adminisztrátori ellenőrzésre vár.</span><button onClick={()=>setVerificationNotice(false)}><X/></button></div>}

      <PushBanner state={pushState} message={pushMessage} enable={enablePush} disable={disablePush} />

      <section className="stats">
        <Stat icon={Radar} label="Új találat 24 órában" value={todayCount} note="Adatbázisból" color="orange" />
        <Stat icon={Gauge} label="Magas relevancia" value={highCount} note="85% feletti" color="blue" />
        <Stat icon={BookmarkCheck} label="Mentett lead" value={saved.length} note="Saját listád" color="green" />
        <Stat icon={TrendingUp} label="Összes aktív lead" value={leads.length} note="Élő adatok" color="purple" />
      </section>

      <section className="search-panel">
        <div className="panel-title"><div><SlidersHorizontal /><span><b>Találatok szűrése</b><small>A push az aktuális szakma és terület szerint is beállítható</small></span></div><button onClick={clearFilters}>Szűrők törlése</button></div>
        <div className="filters">
          <label className="search-box"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Mire keresel? Pl. burkolás, tető..." /></label>
          <Select value={trade} set={setTrade} icon={BriefcaseBusiness} items={['Minden szakma',...trades]} />
          <Select value={county} set={setCounty} icon={MapPin} items={['Minden terület',...counties]} />
          <Select value={fresh} set={setFresh} icon={CalendarDays} items={['Bármikor','3 órán belül','24 órán belül']} />
        </div>
      </section>

      <section className="results-head"><div><h2>{onlySaved ? 'Mentett leadek' : 'Legfrissebb találatok'}</h2><p><b>{filtered.length}</b> releváns lehetőség a beállításaid alapján</p></div><button onClick={loadLeads}><RefreshCw /> Frissítés</button></section>

      <section className="lead-list">
        {loading && <div className="empty loading"><RefreshCw /><h3>Találatok frissítése…</h3></div>}
        {apiError && <div className="empty error"><ShieldCheck /><h3>Nem érhető el az adatforrás</h3><p>{apiError}</p><button onClick={loadLeads}>Újrapróbálás</button></div>}
        {!loading && !apiError && filtered.map(lead => <LeadCard key={lead.id} lead={lead} isSaved={saved.includes(lead.id)} toggleSaved={toggleSaved} open={() => openLead(lead)} />)}
        {!loading && !apiError && !filtered.length && <div className="empty"><Search /><h3>Nincs ilyen találat</h3><p>Az adatbázisban jelenleg nincs a szűrésnek megfelelő aktív lead.</p><button onClick={clearFilters}>Összes találat mutatása</button></div>}
      </section>
      <footer><ShieldCheck /> Moderált ügyfélhirdetések és engedélyezett adatforrások. Névtelen használati statisztika, push csak hozzájárulás után. <a href="/adatvedelem.html" target="_blank">Adatvédelem</a><span>SZAKILEAD PRO</span></footer>
    </main>

    {selected && <LeadModal lead={selected} saved={saved.includes(selected.id)} toggle={() => toggleSaved(selected.id)} close={() => setSelected(null)} sourceClick={() => track('source_click',{leadId:selected.id,metadata:{source:selected.source}})} />}
    {submissionOpen && <SubmissionModal close={() => setSubmissionOpen(false)} submitted={() => { setSubmissionOpen(false); track('submission_sent') }} />}
    {editingAd && <SubmissionModal initial={editingAd.submission} management={editingAd} close={()=>setEditingAd(null)} submitted={()=>{setEditingAd(null);setMyAdsOpen(true)}} />}
    {myAdsOpen && <ManageAdsModal close={()=>setMyAdsOpen(false)} edit={item=>{setMyAdsOpen(false);setEditingAd(item)}} />}
    {settingsOpen && <SettingsModal close={() => setSettingsOpen(false)} pushState={pushState} enablePush={enablePush} disablePush={disablePush} leadCount={leads.length} savedCount={saved.length} clearSaved={() => { setSaved([]); localStorage.setItem('szakilead-saved','[]') }} trades={trades} counties={counties} filters={pushFilters} saveFilters={savePushPreferences} />}
  </div>
}

function PushBanner({state,message,enable,disable}) {
  if (state === 'unsupported') return <section className="push-banner warning"><BellOff /><div><b>A push ezen a böngészőn nem támogatott</b><span>Telepítsd az alkalmazást vagy használj modern böngészőt.</span></div></section>
  return <section className={`push-banner ${state === 'enabled' ? 'enabled' : ''}`}><div className="push-icon">{state === 'enabled' ? <Bell /> : <Zap />}</div><div><b>{state === 'enabled' ? 'Azonnali push értesítések aktívak' : 'Értesülj elsőként az új munkákról'}</b><span>{message || (state === 'enabled' ? 'A szerver háttérben is elküldi a neked megfelelő leadeket.' : 'Egy koppintás, és az új leadekről bezárt alkalmazásnál is üzenetet kapsz.')}</span></div><button disabled={state === 'working' || state === 'checking' || state === 'denied'} onClick={state === 'enabled' ? disable : enable}>{state === 'working' || state === 'checking' ? 'Ellenőrzés…' : state === 'denied' ? 'Böngészőben tiltva' : state === 'enabled' ? 'Kikapcsolás' : 'Push bekapcsolása'}</button></section>
}

function Stat({icon:Icon,label,value,note,color}) { return <article className="stat"><div className={`stat-icon ${color}`}><Icon /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article> }
function Select({value,set,icon:Icon,items}) { return <label className="select-wrap"><Icon /><select value={value} onChange={e => set(e.target.value)}>{items.map(i => <option key={i}>{i}</option>)}</select><ChevronDown /></label> }

function LeadCard({lead,isSaved,toggleSaved,open}) {
  return <article className="lead-card"><div className="score"><span>{lead.score}%</span><small>AI pontszám</small></div><div className="lead-main"><div className="badges"><span className="trade">{lead.trade}</span>{lead.urgent && <span className="urgent"><Zap /> Sürgős</span>}<span className="source">{lead.source}</span>{lead.isDemo && <span className="demo">MINTA</span>}</div><h3 onClick={open}>{lead.title}</h3><p>{lead.excerpt}</p><div className="meta"><span><MapPin />{lead.city || lead.county || 'Nincs helyszín'}</span><span><Clock3 />{lead.age}</span><span><Building2 />{lead.budget}</span></div></div><div className="card-actions"><button className={`save ${isSaved?'saved':''}`} onClick={() => toggleSaved(lead.id)} aria-label="Mentés">{isSaved?<BookmarkCheck/>:<Bookmark/>}</button><button className="detail" onClick={open}>Részletek <ChevronRight /></button></div></article>
}

function LeadModal({lead,saved,toggle,close,sourceClick}) {
  const [contactOpen,setContactOpen]=useState(false)
  const [reportOpen,setReportOpen]=useState(false)
  function openSource(){ if (!lead.sourceUrl) return; sourceClick(); window.open(lead.sourceUrl,'_blank','noopener,noreferrer') }
  return <div className="modal-bg" onClick={close}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" aria-label="Részletek bezárása" onClick={close}><X/></button><div className="modal-score"><Radar/><span><b>{lead.score}%</b> relevancia</span></div><div className="badges"><span className="trade">{lead.trade}</span>{lead.urgent&&<span className="urgent"><Zap/> Sürgős</span>}</div><h2>{lead.title}</h2><p className="modal-desc">{lead.excerpt}</p><div className="modal-grid"><div><MapPin/><span><small>Helyszín</small><b>{lead.city||lead.county||'Nincs megadva'}</b></span></div><div><Clock3/><span><small>Közzétéve</small><b>{lead.age}</b></span></div><div><Building2/><span><small>Becsült érték</small><b>{lead.budget}</b></span></div><div><Sparkles/><span><small>Értékelés</small><b>{lead.tone}</b></span></div></div>{contactOpen&&<ContactForm lead={lead} done={()=>{setContactOpen(false);track('contact_sent',{leadId:lead.id})}}/>}{reportOpen&&<ReportForm lead={lead} done={()=>{setReportOpen(false);track('report_sent',{leadId:lead.id})}}/>}<div className="why"><b>Védett kapcsolatfelvétel</b><p>A megrendelő e-mail-címe nem nyilvános. Az üzenetedet a SzakiLead továbbítja neki.</p></div><div className="modal-actions"><button className="report-button" onClick={()=>setReportOpen(!reportOpen)}><Flag/> Jelentés</button><button className="secondary" onClick={toggle}>{saved?<BookmarkCheck/>:<Bookmark/>}{saved?'Mentve':'Mentés későbbre'}</button>{lead.sourceUrl&&<button className="secondary" onClick={openSource}><ExternalLink/> Forrás</button>}{lead.hasContactForm&&<button className="primary" onClick={()=>setContactOpen(!contactOpen)}><Mail/> Kapcsolatfelvétel</button>}</div></div></div>
}

function ContactForm({lead,done}) {
  const [form,setForm]=useState({name:'',email:'',phone:'',message:'',website:''});const [status,setStatus]=useState('idle');const [message,setMessage]=useState('')
  const change=event=>setForm(previous=>({...previous,[event.target.name]:event.target.value}))
  async function submit(event){event.preventDefault();setStatus('working');setMessage('');try{const response=await fetch(`/api/leads/${lead.id}/contact`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Az üzenet nem küldhető el.');setStatus('done');setMessage('Az üzenetet továbbítottuk a megrendelőnek.');setTimeout(done,1800)}catch(error){setStatus('idle');setMessage(error.message)}}
  return <form className="inline-form" onSubmit={submit}><h3>Kapcsolatfelvétel a megrendelővel</h3><div><input name="name" value={form.name} onChange={change} required minLength="2" placeholder="Neved"/><input name="email" value={form.email} onChange={change} required type="email" placeholder="E-mail-címed"/><input name="phone" value={form.phone} onChange={change} type="tel" placeholder="Telefonszámod (nem kötelező)"/></div><textarea name="message" value={form.message} onChange={change} required minLength="20" maxLength="1500" placeholder="Írd meg röviden, hogyan tudsz segíteni…"/><input className="honey" name="website" value={form.website} onChange={change}/>{message&&<p className={status==='done'?'form-success':'form-error'}>{message}</p>}<button disabled={status==='working'||status==='done'}><Send/> {status==='working'?'Küldés…':'Üzenet továbbítása'}</button></form>
}

function ReportForm({lead,done}) {
  const [form,setForm]=useState({reason:'már nem aktuális',details:'',email:'',website:''});const [message,setMessage]=useState('')
  const change=event=>setForm(previous=>({...previous,[event.target.name]:event.target.value}))
  async function submit(event){event.preventDefault();try{const response=await fetch(`/api/leads/${lead.id}/report`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const data=await response.json();if(!response.ok)throw new Error(data.error||'A jelentés sikertelen.');setMessage('Köszönjük, megvizsgáljuk a bejelentést.');setTimeout(done,1500)}catch(error){setMessage(error.message)}}
  return <form className="inline-form report-form" onSubmit={submit}><h3><AlertTriangle/> Hirdetés jelentése</h3><select name="reason" value={form.reason} onChange={change}>{['már nem aktuális','hibás adatok','csalásgyanú','személyes adat','egyéb'].map(item=><option key={item}>{item}</option>)}</select><textarea name="details" value={form.details} onChange={change} maxLength="1000" placeholder="Részletek (nem kötelező)"/><input name="email" value={form.email} onChange={change} type="email" placeholder="E-mail visszajelzéshez (nem kötelező)"/><input className="honey" name="website" value={form.website} onChange={change}/>{message&&<p>{message}</p>}<button><Flag/> Jelentés elküldése</button></form>
}

function SubmissionModal({close,submitted,initial,management}) {
  const [form,setForm] = useState(initial ? {...initial,expiryDays:30,consent:true,website:''} : {title:'',excerpt:'',city:'',county:'',trade:'Burkoló',budget:'',contactName:'',contactEmail:'',contactPhone:'',sourceUrl:'',expiryDays:30,consent:false,website:''})
  const [state,setState] = useState('idle')
  const [message,setMessage] = useState('')
  const set = event => setForm(previous => ({...previous,[event.target.name]:event.target.type==='checkbox'?event.target.checked:event.target.value}))
  async function send(event) {
    event.preventDefault(); setState('working'); setMessage('')
    if (!form.contactEmail.trim()) { setState('idle'); setMessage('Az e-mailes megerősítéshez e-mail-cím szükséges.'); return }
    try {
      const response = await fetch(management ? `/api/submissions/${management.id}/manage` : '/api/submissions',{method:management?'PUT':'POST',headers:{'Content-Type':'application/json',...(management?{'X-Manage-Token':management.token}:{})},body:JSON.stringify(form)})
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'A beküldés sikertelen.')
      if (!management && data.submission?.manageToken) {
        const stored=JSON.parse(localStorage.getItem('szakilead-managed-ads')||'[]')
        localStorage.setItem('szakilead-managed-ads',JSON.stringify([...stored.filter(item=>item.id!==data.submission.id),{id:data.submission.id,token:data.submission.manageToken}]))
      }
      setState('done'); setMessage(management?'A módosítást elmentettük, és újra ellenőrzésre küldtük.':data.submission?.verificationSent?'Megerősítő levelet küldtünk. Kattints a levélben található linkre.':'A hirdetés elkészült. Helyi tesztben az alábbi megerősítő link használható.')
      if (data.submission?.debugVerificationUrl || data.debugVerificationUrl) setMessage(`${data.submission?.debugVerificationUrl || data.debugVerificationUrl}`)
      setTimeout(submitted,management?1800:4500)
    } catch(error) { setState('idle'); setMessage(error.message) }
  }
  return <div className="modal-bg" onClick={close}><div className="modal submission-modal" onClick={event=>event.stopPropagation()}><button className="modal-close" aria-label="Hirdetésfeladás bezárása" onClick={close}><X/></button><div className="modal-score"><Send/><span><b>{management?'Hirdetés módosítása':'Hirdetés feladása'}</b> szakembert keresőknek</span></div><h2>{management?'Módosítsd a hirdetés adatait':'Milyen munkára keresel szakembert?'}</h2><p className="modal-desc">A kapcsolati adataid nem jelennek meg nyilvánosan. A szakemberek üzenetét a rendszer továbbítja neked.</p>{state==='done'?<div className="submit-success"><ShieldCheck/><h3>Sikeres mentés</h3>{message.startsWith('http')?<p><a href={message}>E-mail-cím megerősítése</a></p>:<p>{message}</p>}</div>:<form className="submission-form" onSubmit={send}><label><span>Munka címe</span><input name="title" value={form.title} onChange={set} minLength="10" maxLength="180" required placeholder="Pl. Burkolót keresek fürdőszobához"/></label><label className="wide"><span>Munka részletes leírása</span><textarea name="excerpt" value={form.excerpt} onChange={set} minLength="20" maxLength="1200" required placeholder="Mi a feladat, mekkora a terület, mikor lenne aktuális?"/></label><label><span>Település</span><input name="city" value={form.city} onChange={set} maxLength="100" required placeholder="Pl. Győr"/></label><label><span>Megye / terület</span><input name="county" value={form.county} onChange={set} maxLength="100" placeholder="Pl. Győr-Moson-Sopron"/></label><label><span>Szakma</span><select name="trade" value={form.trade} onChange={set}>{['Burkoló','Villanyszerelő','Kőműves','Tetőfedő','Festő','Térkövező','Ács','Gépész','Vízszerelő','Kertépítő','Bontás','Takarítás','Egyéb'].map(item=><option key={item}>{item}</option>)}</select></label><label><span>Keret (ha ismert)</span><input name="budget" value={form.budget} onChange={set} maxLength="100" placeholder="Pl. ajánlatkérés vagy 500 000 Ft"/></label><label><span>Kapcsolattartó neve</span><input name="contactName" value={form.contactName} onChange={set} minLength="2" maxLength="100" required placeholder="Pl. Kovács Péter"/></label><label><span>Telefonszám (nem nyilvános)</span><input name="contactPhone" type="tel" value={form.contactPhone} onChange={set} maxLength="40" placeholder="Pl. +36 30 123 4567"/></label><label><span>E-mail-cím (megerősítéshez)</span><input name="contactEmail" type="email" value={form.contactEmail} onChange={set} maxLength="180" required placeholder="Pl. peter@email.hu"/></label><label><span>Hirdetés időtartama</span><select name="expiryDays" value={form.expiryDays} onChange={set}>{[[7,'7 nap'],[14,'14 nap'],[30,'30 nap'],[60,'60 nap']].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label className="wide"><span>Külső hirdetés linkje (nem kötelező)</span><input name="sourceUrl" type="url" value={form.sourceUrl} onChange={set} placeholder="https://facebook.com/..."/></label><input className="honey" name="website" value={form.website} onChange={set} tabIndex="-1" autoComplete="off"/>{!management&&<label className="consent wide"><input name="consent" type="checkbox" checked={form.consent} onChange={set} required/><span>Hozzájárulok, hogy a munkaleírás nyilvánosan megjelenjen, és a SzakiLead az elérhetőségeimet kizárólag az üzenetek továbbításához kezelje.</span></label>}{message&&<p className="form-error wide">{message}</p>}<div className="modal-actions wide"><button type="button" className="secondary" onClick={close}>Mégse</button><button className="primary" disabled={state==='working'}><Send/> {state==='working'?'Mentés…':management?'Módosítás mentése':'Hirdetés beküldése'}</button></div></form>}</div></div>
}

const statusLabels={unverified:'E-mailre vár',pending:'Ellenőrzés alatt',active:'Aktív',closed:'Lezárt',expired:'Lejárt',rejected:'Elutasított'}
function ManageAdsModal({close,edit}) {
  const [items,setItems]=useState([]);const [loading,setLoading]=useState(true);const [message,setMessage]=useState('')
  async function load(){setLoading(true);const stored=JSON.parse(localStorage.getItem('szakilead-managed-ads')||'[]');const results=await Promise.all(stored.map(async item=>{try{const response=await fetch(`/api/submissions/${item.id}/manage`,{headers:{'X-Manage-Token':item.token}});if(!response.ok)return null;const data=await response.json();return {...item,submission:data.submission}}catch{return null}}));const valid=results.filter(Boolean);setItems(valid);localStorage.setItem('szakilead-managed-ads',JSON.stringify(valid.map(({id,token})=>({id,token}))));setLoading(false)}
  useEffect(()=>{load()},[])
  async function action(item,type){if(type==='delete'&&!confirm('Biztosan végleg törlöd a hirdetést?'))return;const response=await fetch(type==='delete'?`/api/submissions/${item.id}`:`/api/submissions/${item.id}/close`,{method:type==='delete'?'DELETE':'POST',headers:{'X-Manage-Token':item.token}});const data=await response.json();if(!response.ok){setMessage(data.error||'A művelet sikertelen.');return}await load()}
  return <div className="modal-bg" onClick={close}><div className="modal manage-modal" onClick={event=>event.stopPropagation()}><button className="modal-close" onClick={close}><X/></button><div className="modal-score"><BriefcaseBusiness/><span><b>Saját hirdetéseim</b> ezen az eszközön</span></div><h2>Hirdetések kezelése</h2>{loading?<p>Betöltés…</p>:items.length?<div className="managed-list">{items.map(item=><article key={item.id}><div><span className={`status ${item.submission.status}`}>{item.submission.status}</span><h3>{item.submission.title}</h3><p>{item.submission.city} • lejár: {item.submission.expiresAt?.slice(0,10)}</p></div><div><button onClick={()=>edit(item)} disabled={['closed','expired','rejected'].includes(item.submission.status)}>Módosítás</button><button onClick={()=>action(item,'close')} disabled={['closed','expired'].includes(item.submission.status)}>Lezárás</button><button className="danger" onClick={()=>action(item,'delete')}><Trash2/> Törlés</button></div></article>)}</div>:<div className="empty"><BriefcaseBusiness/><h3>Nincs kezelt hirdetés ezen az eszközön</h3><p>A feladott hirdetések kezelési joga ebben a böngészőben marad.</p></div>}{message&&<p className="form-error">{message}</p>}</div></div>
}

function SettingsModal({close,pushState,enablePush,disablePush,leadCount,savedCount,clearSaved,trades,counties,filters,saveFilters}) {
  const [draft,setDraft]=useState(filters);const [message,setMessage]=useState('')
  const toggle=(key,value)=>setDraft(previous=>({...previous,[key]:previous[key].includes(value)?previous[key].filter(item=>item!==value):[...previous[key],value]}))
  async function save(){try{await saveFilters(draft);setMessage('A push-beállításokat elmentettük.')}catch(error){setMessage(error.message)}}
  return <div className="modal-bg" onClick={close}><div className="modal settings-modal" onClick={event=>event.stopPropagation()}><button className="modal-close" aria-label="Beállítások bezárása" onClick={close}><X/></button><div className="modal-score"><Settings/><span><b>Beállítások</b> SzakiLead Pro</span></div><h2>Értesítési beállítások</h2><p className="modal-desc">Több szakmát és területet is kijelölhetsz. Üres lista esetén minden új munkáról értesítünk.</p><div className="settings-list"><div><span><Bell/><b>Push értesítések</b><small>{pushState==='enabled'?'Aktív – az új munkákról üzenetet kapsz.':'Nincs bekapcsolva ezen a böngészőn.'}</small></span><button disabled={pushState==='working'||pushState==='checking'||pushState==='denied'} onClick={pushState==='enabled'?disablePush:enablePush}>{pushState==='enabled'?'Kikapcsolás':pushState==='denied'?'Böngészőben tiltva':'Bekapcsolás'}</button></div></div><div className="preference-section"><b>Szakmák</b><div className="check-grid">{trades.filter(item=>item!=='Minden szakma').map(item=><label key={item}><input type="checkbox" checked={draft.trades.includes(item)} onChange={()=>toggle('trades',item)}/><span>{item}</span></label>)}</div></div><div className="preference-section"><b>Területek</b><div className="check-grid">{counties.filter(item=>item!=='Minden terület').map(item=><label key={item}><input type="checkbox" checked={draft.counties.includes(item)} onChange={()=>toggle('counties',item)}/><span>{item}</span></label>)}</div></div><div className="preference-row"><label><span>Minimum relevancia: <b>{draft.minScore}%</b></span><input type="range" min="0" max="100" step="5" value={draft.minScore} onChange={event=>setDraft({...draft,minScore:Number(event.target.value)})}/></label><label className="urgent-toggle"><input type="checkbox" checked={draft.urgentOnly} onChange={event=>setDraft({...draft,urgentOnly:event.target.checked})}/><span>Csak sürgős munkák</span></label></div><button className="save-preferences" onClick={save}>Beállítások mentése</button>{message&&<p className="form-success">{message}</p>}<div className="settings-list"><div><span><Bookmark/><b>Mentett leadek</b><small>{savedCount} munka van elmentve ezen az eszközön.</small></span><button disabled={!savedCount} onClick={clearSaved}>Mentések törlése</button></div><div><span><Radar/><b>Adatforrások</b><small>{leadCount} aktív lead • TED • RSS/API • ügyfélhirdetések</small></span></div></div><div className="settings-links"><a href="/admin.html"><ShieldCheck/> Admin központ</a><a href="/adatvedelem.html" target="_blank"><ExternalLink/> Adatvédelem</a></div></div></div>
}

export default App
