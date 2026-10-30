import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { api, type Profile, type Course, type Resource, type Assignment, type Quiz, type Announcement, type Grade, type ChatMessage, type Complaint } from './lib/api'
import { Dialog } from './Dialog'
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, Check, CheckCheck,
  ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, Clock3, FileText, GraduationCap,
  LayoutDashboard, LifeBuoy, LockKeyhole, LogOut, Menu, MessageCircle, MoreHorizontal, Plus, Search,
  Send, Settings2, ShieldCheck, Sparkles, UserRound, X, Megaphone, Layers3,
} from 'lucide-react'

type Page = 'Overview'|'My courses'|'Resources'|'Assignments'|'Quizzes'|'Announcements'|'My marks'|'Class chat'|'Complaints'|'Profile'
const nav: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard }, { label: 'My courses', icon: BookOpen }, { label: 'Resources', icon: Layers3 },
  { label: 'Assignments', icon: ClipboardCheck }, { label: 'Quizzes', icon: CircleHelp }, { label: 'Announcements', icon: Megaphone },
  { label: 'My marks', icon: Activity }, { label: 'Class chat', icon: MessageCircle }, { label: 'Complaints', icon: LifeBuoy },
]
const colors = ['#58786e', '#d07c5a', '#6d75a7', '#b19a61']
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'GU'
const date = (value?: string|null) => value ? new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : 'No due date'
const shortDate = (value?: string|null) => value ? new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile|null>(null)
  const [page, setPage] = useState<Page>('Overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [authMode, setAuthMode] = useState<'login'|'reset'|'update'>('login')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY' || window.location.hash.includes('type=invite')) setAuthMode('update')
      else if (next) setAuthMode('login')
    })
    if (window.location.hash.includes('type=recovery') || window.location.hash.includes('type=invite')) setAuthMode('update')
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !supabase) { setProfile(null); return }
    api<{ profile: Profile }>('/me').then(({ profile: value }) => setProfile(value)).catch(() => setProfile({
      id: session.user.id, full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Campus member',
      email: session.user.email || '', role: session.user.app_metadata?.role || 'student',
    }))
  }, [session])

  const signOut = async () => { await supabase?.auth.signOut(); setProfile(null); setPage('Overview') }
  if (!ready) return <div className="boot-screen"><span className="brand-mark">G</span><span>Opening your campus…</span></div>
  if (!isSupabaseConfigured) return <SetupScreen />
  if (authMode !== 'login' && !session) return <AuthScreen mode={authMode} onMode={setAuthMode} />
  if (session && authMode === 'update') return <AuthScreen mode="update" onMode={setAuthMode} />
  if (!session) return <AuthScreen mode="login" onMode={setAuthMode} />
  return <AppShell page={page} setPage={setPage} profile={profile} setProfile={setProfile} signOut={signOut} mobileNav={mobileNav} setMobileNav={setMobileNav} />
}

function SetupScreen() {
  return <main className="setup-screen"><div className="setup-orbit orbit-a"/><div className="setup-orbit orbit-b"/><section className="setup-card">
    <div className="brand-lockup"><span className="brand-mark">G</span><div><b>GUTECH</b><small>LEARNING CAMPUS</small></div></div>
    <div className="setup-icon"><Settings2 size={21}/></div><p className="eyebrow">ONE LAST STEP</p><h1>Connect your campus.</h1>
    <p className="muted">The app is ready for your Supabase project. Add the project URL and publishable key to <code>FrontEnd/.env</code>, then restart the development server.</p>
    <pre><code>VITE_SUPABASE_URL=https://…supabase.co<br/>VITE_SUPABASE_ANON_KEY=…</code></pre>
    <div className="setup-note"><ShieldCheck size={17}/><span>Only the public client key belongs in the browser. Keep the service role key in <code>Backend/.env</code>.</span></div>
  </section><span className="setup-footer">A considered space for learning, at every step.</span></main>
}

function AuthScreen({ mode, onMode }: { mode: 'login'|'reset'|'update'; onMode: (m:'login'|'reset'|'update')=>void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
      } else if (mode === 'reset') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` })
        if (err) throw err
        setMessage('If an account exists for that email, a password reset link is on its way.')
      } else {
        if (password.length < 10) throw new Error('Use at least 10 characters for your new password.')
        if (password !== confirm) throw new Error('Those passwords do not match.')
        const { error: err } = await supabase.auth.updateUser({ password })
        if (err) throw err
        setMessage('Your password has been updated. You can continue to your campus.')
        onMode('login')
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.') } finally { setBusy(false) }
  }
  const title = mode === 'login' ? 'Welcome back.' : mode === 'reset' ? 'A fresh start.' : 'Choose a new password.'
  return <main className="auth-screen"><div className="auth-left"><div className="brand-lockup"><span className="brand-mark">G</span><div><b>GUTECH</b><small>LEARNING CAMPUS</small></div></div>
    <div className="auth-manifesto"><span className="eyebrow light-eyebrow">YOUR CAMPUS, IN ONE PLACE</span><h1>Learn with<br/><em>intention.</em></h1><p>Everything you need for a thoughtful, connected learning experience.</p><div className="auth-bottomline"><span><span className="live-dot"/> Campus access</span><span>Muscat · Oman</span></div></div>
    <div className="auth-decoration decor-one"/><div className="auth-decoration decor-two"/></div>
    <div className="auth-right"><div className="auth-card"><div className="auth-mobile-brand"><span className="brand-mark">G</span><b>GUTECH</b></div><p className="eyebrow">{mode === 'login' ? 'INTERNAL LEARNING PORTAL' : 'ACCOUNT SECURITY'}</p><h2>{title}</h2><p className="muted">{mode === 'login' ? 'Sign in with your institution account to continue.' : mode === 'reset' ? 'Enter your institution email and we’ll send a secure reset link.' : 'Your new password must be at least 10 characters.'}</p>
      <form onSubmit={submit} className="auth-form">{mode !== 'update' && <label>Institution email<input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@gutech.edu.om"/></label>}
        {mode !== 'reset' && <label>Password<input autoComplete={mode==='login'?'current-password':'new-password'} type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='login'?'Enter your password':'At least 10 characters'}/></label>}
        {mode==='update' && <label>Confirm password<input autoComplete="new-password" type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Re-enter your password"/></label>}
        {error && <div className="form-error">{error}</div>}{message && <div className="form-success">{message}</div>}
        <button className="button button-primary button-wide" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in securely':mode==='reset'?'Send reset link':'Update password'}<ArrowRight size={17}/></button>
      </form>{mode==='login'?<button className="text-button forgot-button" onClick={()=>{onMode('reset');setError('');setMessage('')}}>Forgot your password?</button>:<button className="text-button forgot-button" onClick={()=>{onMode('login');setError('');setMessage('')}}><ArrowLeft size={15}/> Back to sign in</button>}
      <div className="internal-note"><LockKeyhole size={15}/> Internal accounts only. Contact your administrator if you need access.</div>
    </div><span className="auth-copyright">© 2026 GUTECH · Learning, thoughtfully.</span></div></main>
}

function AppShell({ page, setPage, profile, setProfile, signOut, mobileNav, setMobileNav }: { page: Page; setPage:(p:Page)=>void; profile:Profile|null; setProfile:(p:Profile|null)=>void; signOut:()=>void; mobileNav:boolean; setMobileNav:(v:boolean)=>void }) {
  const role = profile?.role || 'student'
  return <div className="app-layout">
    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}><div className="sidebar-brand"><span className="brand-mark">G</span><div><strong>GUTECH</strong><small>LEARNING CAMPUS</small></div><button className="icon-button sidebar-close" onClick={()=>setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE <ChevronDown size={13}/></div><div className="workspace-switch"><div className="workspace-symbol"><GraduationCap size={17}/></div><div><b>My campus</b><small>Academic year 2025–26</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">LEARNING</div><nav>{nav.slice(0,6).map(({label,icon:Icon})=><NavItem key={label} label={label} icon={<Icon size={17}/>} active={page===label} onClick={()=>{setPage(label);setMobileNav(false)}} badge={label==='Announcements'?undefined:undefined}/>)}</nav>
      <div className="nav-label nav-label-spaced">MY ACADEMICS</div><nav>{nav.slice(6).map(({label,icon:Icon})=><NavItem key={label} label={label} icon={<Icon size={17}/>} active={page===label} onClick={()=>{setPage(label);setMobileNav(false)}}/>)}</nav>
      {(role==='teacher'||role==='admin') && <div className="staff-note"><Sparkles size={15}/><span><b>{role==='admin'?'Administrator':'Teacher'} access</b><small>Manage your campus workspace</small></span></div>}
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><LifeBuoy size={16}/></div><b>Need a hand?</b><p>Our campus team is here to help.</p><button onClick={()=>setPage('Complaints')}>Get support <ArrowRight size={13}/></button></div>
        <button className={`profile-switch ${page==='Profile'?'profile-active':''}`} onClick={()=>{setPage('Profile');setMobileNav(false)}}><Avatar name={profile?.full_name||''} image={profile?.avatar_url}/><span className="profile-switch-text"><b>{profile?.full_name||'Campus member'}</b><small>{role[0].toUpperCase()+role.slice(1)}</small></span><MoreHorizontal size={17}/></button>
        <button className="sidebar-signout" onClick={signOut}><LogOut size={15}/> Sign out</button>
      </div></aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button menu-button" onClick={()=>setMobileNav(true)} aria-label="Open menu"><Menu size={21}/></button><div className="breadcrumb">Campus <ChevronRight size={14}/><strong>{page}</strong></div></div><div className="topbar-actions"><div className="term-pill"><span/> Spring semester <ChevronDown size={13}/></div><button className="icon-button notification-button" aria-label="Notifications"><Bell size={18}/><i/></button><button className="top-profile" onClick={()=>setPage('Profile')}><Avatar name={profile?.full_name||''} image={profile?.avatar_url}/><ChevronDown size={14}/></button></div></header>
      <Content page={page} setPage={setPage} profile={profile} setProfile={setProfile}/>
    </main>
  </div>
}

function NavItem({label,icon,active,onClick,badge}:{label:string;icon:ReactNode;active:boolean;onClick:()=>void;badge?:string}) { return <button className={`nav-item ${active?'nav-active':''}`} onClick={onClick}>{icon}<span>{label}</span>{badge&&<i>{badge}</i>}</button> }
function Avatar({name,image}:{name:string;image?:string|null}) { return image?<img className="avatar" src={image} alt=""/>:<span className="avatar avatar-initials">{initials(name)}</span> }

function Content({ page, setPage, profile, setProfile }: { page:Page; setPage:(p:Page)=>void; profile:Profile|null; setProfile:(p:Profile|null)=>void }) {
  const [courses,setCourses]=useState<Course[]>([]); const [resources,setResources]=useState<Resource[]>([]); const [assignments,setAssignments]=useState<Assignment[]>([]); const [quizzes,setQuizzes]=useState<Quiz[]>([])
  const [announcements,setAnnouncements]=useState<Announcement[]>([]); const [grades,setGrades]=useState<Grade[]>([]); const [complaints,setComplaints]=useState<Complaint[]>([]); const [messages,setMessages]=useState<ChatMessage[]>([])
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [dialog,setDialog]=useState<string|null>(null); const [search,setSearch]=useState('')
  const refresh = useCallback(async () => {
    if (!supabase) return
    setBusy(true); setError('')
    const requests = [api<{courses:Course[]}>('/courses'),api<{resources:Resource[]}>('/resources'),api<{assignments:Assignment[]}>('/assessments?type=assignment'),api<{quizzes:Quiz[]}>('/assessments?type=quiz'),api<{announcements:Announcement[]}>('/announcements'),api<{grades:Grade[]}>('/marks'),api<{complaints:Complaint[]}>('/complaints')]
    const results=await Promise.allSettled(requests)
    const [c,r,a,q,n,g,co]=results
    if(c.status==='fulfilled')setCourses(c.value.courses||[])
    if(r.status==='fulfilled')setResources(r.value.resources||[])
    if(a.status==='fulfilled')setAssignments(a.value.assignments||[])
    if(q.status==='fulfilled')setQuizzes(q.value.quizzes||[])
    if(n.status==='fulfilled')setAnnouncements(n.value.announcements||[])
    if(g.status==='fulfilled')setGrades(g.value.grades||[])
    if(co.status==='fulfilled')setComplaints(co.value.complaints||[])
    const failed=results.find(x=>x.status==='rejected')
    if(failed?.status==='rejected')setError(failed.reason instanceof Error?failed.reason.message:'Some information could not be loaded.')
    setBusy(false)
  },[])
  useEffect(()=>{refresh()},[refresh])
  const notify=(text:string)=>{setNotice(text);window.setTimeout(()=>setNotice(''),3600)}
  const submit=async(path:string,body:FormData|Record<string,unknown>,method='POST')=>{
    try{await api(path,{method,body:body instanceof FormData?body:JSON.stringify(body)});setDialog(null);notify('Saved successfully.');await refresh();return true}catch(e){setError(e instanceof Error?e.message:'Unable to save.');return false}
  }
  const shared={courses,resources,assignments,quizzes,announcements,grades,complaints,messages,setMessages,busy,error,notice,dialog,setDialog,search,setSearch,refresh,notify,submit,profile,setProfile,setPage}
  const titles:Record<Page,[string,string]>={
    'Overview':['A good day to make progress.','Here’s what’s happening across your campus.'], 'My courses':['Your learning, in progress.','Everything you’re studying, all in one place.'],
    Resources:['A place for useful things.','Course materials, gathered and ready when you are.'], Assignments:['Small steps, real progress.','Keep an eye on what’s due and what you’ve completed.'],
    Quizzes:['Check what you know.','Your course quizzes and results.'], Announcements:['From your campus.','Notes and updates from the people teaching you.'],
    'My marks':['Progress you can see.','Your published results across all courses.'], 'Class chat':['Learning is better together.','Conversations with the people in your courses.'],
    Complaints:['We’re here to listen.','Raise a concern privately and follow it through.'], Profile:['Your space, your details.','Keep your account information up to date.'],
  }
  return <div className="content-wrap"><div className="page-heading"><div><div className="eyebrow page-eyebrow">{new Date().toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase()} <span className="heading-spark">✳</span> YOUR LEARNING SPACE</div><h1>{titles[page][0]}</h1><p>{titles[page][1]}</p></div><div className="heading-actions"><button className="button button-light" onClick={()=>refresh()}><Activity size={15}/> {busy?'Refreshing':'Refresh'}</button>{canCreate(page,profile)&&<button className="button button-primary" onClick={()=>setDialog(createType(page,profile))}><Plus size={16}/>{createLabel(page,profile)}</button>}</div></div>
    {error&&<div className="inline-error"><span>{error}</span><button onClick={()=>setError('')}><X size={15}/></button></div>}{notice&&<div className="toast"><Check size={16}/>{notice}</div>}
    {page==='Overview'?<Overview {...shared}/>:page==='My courses'?<CoursesPage {...shared}/>:page==='Resources'?<ResourcesPage {...shared}/>:page==='Assignments'?<AssessmentsPage kind="assignment" {...shared}/>:page==='Quizzes'?<AssessmentsPage kind="quiz" {...shared}/>:page==='Announcements'?<AnnouncementsPage {...shared}/>:page==='My marks'?<MarksPage {...shared}/>:page==='Class chat'?<ChatPage {...shared}/>:page==='Complaints'?<ComplaintsPage {...shared}/>:<ProfilePage profile={profile} setProfile={setProfile} notify={notify}/>}
    {dialog&&<Dialog type={dialog} courses={courses} profile={profile} onClose={()=>setDialog(null)} onSubmit={submit}/>}</div>
}
function canCreate(page:Page,profile:Profile|null){return (page==='Overview'&&profile?.role==='admin')||(page==='My courses'&&profile?.role==='admin')||(['Resources','Assignments','Quizzes','Announcements'].includes(page)&&(profile?.role==='teacher'||profile?.role==='admin'))}
function createType(page:Page,profile?:Profile|null){return page==='Overview'?'account':page==='My courses'?(profile?.role==='admin'?'assign':'course'):page==='Resources'?'resource':page==='Assignments'?'assignment':page==='Quizzes'?'quiz':page==='Announcements'?'announcement':'complaint'}
function createLabel(page:Page,profile?:Profile|null){return page==='Overview'?'Invite a user':page==='My courses'?(profile?.role==='admin'?'Assign a student':'Create course'):page==='Resources'?'Upload resource':page==='Assignments'?'New assignment':page==='Quizzes'?'Create quiz':page==='Announcements'?'New announcement':'Register complaint'}

type Shared={courses:Course[];resources:Resource[];assignments:Assignment[];quizzes:Quiz[];announcements:Announcement[];grades:Grade[];complaints:Complaint[];messages:ChatMessage[];setMessages:(m:ChatMessage[])=>void;busy:boolean;error:string;notice:string;dialog:string|null;setDialog:(v:string|null)=>void;search:string;setSearch:(v:string)=>void;refresh:()=>void;notify:(s:string)=>void;submit:(path:string,body:FormData|Record<string,unknown>,method?:string)=>Promise<boolean>;profile:Profile|null;setProfile:(p:Profile|null)=>void;setPage:(p:Page)=>void}

function Overview(s:Shared){
 const upcoming=[...s.assignments,...s.quizzes].sort((a,b)=>new Date(a.due_at||'2100').getTime()-new Date(b.due_at||'2100').getTime()).slice(0,4)
 const unseen=s.resources.filter(r=>!r.seen_at).length
 return <><div className="welcome-banner"><div className="welcome-copy"><span className="welcome-kicker"><Sparkles size={14}/> YOUR SEMESTER, AT A GLANCE</span><h2>Make room for<br/><em>what’s next.</em></h2><p>A clear view of your classes, deadlines and little wins.</p><button className="welcome-link" onClick={()=>s.setPage('My courses')}>Explore my courses <ArrowRight size={15}/></button></div><div className="banner-art"><div className="sun-disc"/><div className="banner-arc arc-large"/><div className="banner-arc arc-small"/><div className="banner-book book-one"/><div className="banner-book book-two"/><span className="art-star star-a">✳</span><span className="art-star star-b">✦</span><span className="art-label">LEARN<br/>AT YOUR<br/>OWN PACE</span></div><div className="banner-index">01 <span>/ 04</span></div></div>
  <div className="stat-grid"><StatCard icon={<BookOpen size={18}/>}label="Enrolled courses"value={String(s.courses.length).padStart(2,'0')}detail="Your current semester"tone="sage"/><StatCard icon={<Clock3 size={18}/>}label="Coming up" value={String(upcoming.length).padStart(2,'0')} detail="Things on your plate"tone="peach"/><StatCard icon={<Layers3 size={18}/>}label="New resources"value={String(unseen).padStart(2,'0')}detail="Ready when you are"tone="lavender"/><StatCard icon={<CheckCheck size={18}/>}label="Published marks"value={String(s.grades.length).padStart(2,'0')}detail="Your latest results"tone="gold"/></div>
  <div className="overview-grid"><section className="panel course-panel"><PanelTitle title="Your courses"kicker="PICK UP WHERE YOU LEFT OFF"action="See all"onAction={()=>s.setPage('My courses')}/>{s.courses.length?<div className="course-list">{s.courses.slice(0,4).map((course,i)=><CourseRow key={course.id} course={course} index={i} onClick={()=>s.setPage('Resources')}/>)}</div>:<Empty title="Your courses will appear here"text="Once a course is assigned to your account, it will be ready to explore."/>}</section>
  <section className="panel deadline-panel"><PanelTitle title="On the horizon"kicker="UP NEXT"action="All work"onAction={()=>s.setPage('Assignments')}/>{upcoming.length?<div className="deadline-list">{upcoming.map((item,i)=><div className="deadline-item"key={item.id}><div className={`deadline-date date-tone-${i%3}`}><b>{item.due_at?new Date(item.due_at).getDate():'—'}</b><small>{item.due_at?new Date(item.due_at).toLocaleDateString('en',{month:'short'}):'OPEN'}</small></div><div className="deadline-copy"><b>{item.title}</b><small>{item.course_name||courseName(item.course_id,s.courses)} · {'duration_minutes'in item?'Quiz':'Assignment'}</small></div><ChevronRight size={16}/></div>)}</div>:<Empty title="A little breathing room"text="You’re all caught up on upcoming work."/>}</section></div>
  <div className="overview-bottom"><section className="panel announcement-panel"><PanelTitle title="Campus notes"kicker="THE LATEST"action="All announcements"onAction={()=>s.setPage('Announcements')}/>{s.announcements.slice(0,2).map(a=><article className="announcement-preview"key={a.id}><div className="announcement-dot"/><div><b>{a.title}</b><p>{a.body}</p><small>{a.course_name||courseName(a.course_id,s.courses)} · {shortDate(a.created_at)}</small></div></article>)}{!s.announcements.length&&<Empty title="No announcements yet"text="When your teachers share an update, you’ll see it here."/>}</section><section className="quote-card"><span className="quote-mark">“</span><p>Education is not the filling of a pail, but the lighting of a fire.</p><span className="quote-author">W. B. YEATS <i/></span><span className="quote-glyph">✳</span></section></div></>
}
function StatCard({icon,label,value,detail,tone}:{icon:ReactNode;label:string;value:string;detail:string;tone:string}){return <div className="stat-card"><span className={`stat-icon tone-${tone}`}>{icon}</span><div className="stat-main"><span>{label}</span><b>{value}</b></div><small>{detail}</small></div>}
function PanelTitle({title,kicker,action,onAction}:{title:string;kicker:string;action?:string;onAction?:()=>void}){return <div className="panel-title"><div><small>{kicker}</small><h3>{title}</h3></div>{action&&<button className="text-button"onClick={onAction}>{action}<ArrowRight size={14}/></button>}</div>}
function CourseRow({course,index,onClick}:{course:Course;index:number;onClick?:()=>void}){return <button className="course-row"onClick={onClick}><span className="course-mark"style={{'--course-color':course.color||colors[index%4]} as CSSProperties}>{course.code?.slice(0,2)||'CL'}</span><span className="course-row-copy"><b>{course.name}</b><small>{course.code} <i/> {course.teacher_name||'Course instructor'}</small></span><span className="course-progress"><span><i style={{width:`${[68,42,84,55][index%4]}%`}}/></span><small>{[68,42,84,55][index%4]}% complete</small></span><ChevronRight size={16}/></button>}
function Empty({title,text}:{title:string;text:string}){return <div className="empty-state"><span><Layers3 size={19}/></span><b>{title}</b><p>{text}</p></div>}
function courseName(id:string,courses:Course[]){return courses.find(c=>c.id===id)?.name||'Course'}

function CoursesPage(s:Shared){return <div className="panel page-panel"><div className="toolbar"><div className="search-box"><Search size={16}/><input placeholder="Search your courses" value={s.search} onChange={e=>s.setSearch(e.target.value)}/></div><span className="muted small">{s.courses.length} courses</span>{(s.profile?.role==='teacher'||s.profile?.role==='admin')&&<button className="button button-light button-small"onClick={()=>s.setDialog('course')}><Plus size={13}/> New course</button>}</div>{s.courses.filter(c=>`${c.name} ${c.code} ${c.teacher_name}`.toLowerCase().includes(s.search.toLowerCase())).length?<div className="course-cards">{s.courses.filter(c=>`${c.name} ${c.code} ${c.teacher_name}`.toLowerCase().includes(s.search.toLowerCase())).map((c,i)=><article className="course-card"key={c.id}><div className="course-card-art"style={{'--course-color':c.color||colors[i%4]} as CSSProperties}><span className="course-mark">{c.code?.slice(0,2)||'CL'}</span><span className="course-card-index">{String(i+1).padStart(2,'0')} / COURSE</span><span className="course-card-glyph">✳</span></div><div className="course-card-body"><small>{c.code}</small><h3>{c.name}</h3><p>{c.teacher_name||'Your course instructor'}{c.student_count?` · ${c.student_count} classmates`:''}</p><div className="course-card-footer"><span><i className="live-dot"/> Active course</span><button onClick={()=>s.setPage('Resources')}>Open course <ArrowRight size={14}/></button></div></div></article>)}</div>:<Empty title="No courses found"text="Your assigned courses will show up here."/>}</div>}

function ResourcesPage(s:Shared){const [filter,setFilter]=useState('All resources');const resources=s.resources.filter(r=>`${r.title} ${r.description||''} ${r.course_name||''}`.toLowerCase().includes(s.search.toLowerCase()));const markSeen=async(r:Resource)=>{try{await api(`/resources/${r.id}/seen`,{method:'POST'});s.notify('Marked as seen.');s.refresh()}catch(e){s.notify(e instanceof Error?e.message:'Unable to update status.')}};return <div className="panel page-panel"><div className="toolbar"><div className="search-box"><Search size={16}/><input placeholder="Search resources"value={s.search}onChange={e=>s.setSearch(e.target.value)}/></div><select className="select-control"value={filter}onChange={e=>setFilter(e.target.value)}><option>All resources</option><option>Not seen</option><option>Seen</option></select></div>{resources.length?<div className="data-list">{resources.filter(r=>filter==='All resources'||(filter==='Seen'?Boolean(r.seen_at):!r.seen_at)).map((r,i)=><div className="data-row"key={r.id}><span className={`file-icon file-tone-${i%4}`}><FileText size={18}/></span><div className="data-main"><b>{r.title}</b><small>{r.course_name||courseName(r.course_id,s.courses)} · {r.file_name||'Course material'} · {shortDate(r.created_at)}</small></div>{r.seen_at?<span className="status-pill status-seen"><Check size={13}/> Seen</span>:<button className="button button-outline button-small"onClick={()=>markSeen(r)}>Mark as seen</button>}{(s.profile?.role==='teacher'||s.profile?.role==='admin')&&<button className="text-button"onClick={()=>s.setDialog('resource-views:'+r.id)}>Read receipts</button>}{r.file_url&&<a className="icon-button"href={r.file_url}target="_blank"rel="noreferrer"aria-label="Download resource"><ArrowDownToLine size={17}/></a>}</div>)}</div>:<Empty title="No resources yet"text="Materials shared with your courses will be gathered here."/>}</div>}

function AssessmentsPage({kind,...s}:{kind:'assignment'|'quiz'}&Shared){const rows=kind==='assignment'?s.assignments:s.quizzes;const label=kind==='assignment'?'assignment':'quiz';return <div className="panel page-panel"><div className="toolbar"><div className="search-box"><Search size={16}/><input placeholder={`Search ${label}s`}value={s.search}onChange={e=>s.setSearch(e.target.value)}/></div><span className="muted small">{rows.length} {label}s</span></div>{rows.filter(x=>`${x.title} ${x.course_name||''}`.toLowerCase().includes(s.search.toLowerCase())).length?<div className="assessment-grid">{rows.filter(x=>`${x.title} ${x.course_name||''}`.toLowerCase().includes(s.search.toLowerCase())).map(a=><article className="assessment-card"key={a.id}><div className="assessment-top"><span className={`assessment-symbol assess-${kind}`} >{kind==='assignment'?<ClipboardCheck size={18}/>:<CircleHelp size={18}/>}</span><span className={`status-pill ${a.status==='graded'?'status-seen':'status-open'}`}>{a.status||'Open'}</span></div><small>{a.course_name||courseName(a.course_id,s.courses)}</small><h3>{a.title}</h3><p>{a.description||`Complete your ${label} and submit before the deadline.`}</p><div className="assessment-meta"><span><CalendarDays size={14}/> Due {date(a.due_at)}</span><span>{kind==='quiz'&&'duration_minutes'in a?<><Clock3 size={14}/>{a.duration_minutes} min</>:<ClipboardCheck size={14}/>} {a.max_marks} marks</span></div>{a.marks!=null&&<div className="assessment-result"><span>Published mark</span><b>{a.marks}<small> / {a.max_marks}</small></b></div>}<button className="button button-outline button-wide"onClick={()=>s.setDialog(kind==='assignment'&&s.profile?.role!=='student'?`grade:${a.id}`:`${kind}:${a.id}`)}>{kind==='assignment'&&s.profile?.role!=='student'?'Review submissions':a.status==='submitted'||a.status==='graded'?'View details':kind==='quiz'?'Start quiz':'Submit assignment'}<ArrowRight size={15}/></button></article>)}</div>:<Empty title={`No ${label}s to show`}text={`Your course ${label}s will appear here when they’re ready.`}/>}</div>}

function AnnouncementsPage(s:Shared){return <div className="announcement-feed">{s.announcements.length?s.announcements.filter(a=>`${a.title} ${a.body} ${a.course_name||''}`.toLowerCase().includes(s.search.toLowerCase())).map((a,i)=><article className="panel announcement-card"key={a.id}><div className="announcement-card-top"><span className={`announcement-badge badge-${i%3}`}><Megaphone size={17}/></span><span className="announcement-date">{shortDate(a.created_at)}</span></div><span className="announcement-course">{a.course_name||courseName(a.course_id,s.courses)}</span><h3>{a.title}</h3><p>{a.body}</p><div className="announcement-byline"><Avatar name={a.author_name||'Teacher'}/><span><b>{a.author_name||'Course instructor'}</b><small>Course announcement</small></span></div></article>):<div className="panel"><Empty title="No announcements yet"text="Updates from your instructors will appear here."/></div>}</div>}

function MarksPage(s:Shared){const average=s.grades.length?Math.round(s.grades.reduce((sum,g)=>sum+(g.marks/g.max_marks)*100,0)/s.grades.length):0;return <><div className="marks-summary"><div><small>YOUR CURRENT AVERAGE</small><b>{s.grades.length?`${average}%`:'—'}</b><span>Across {s.grades.length} published assessments</span></div><div className="marks-ornament">✳</div><div className="marks-note"><Sparkles size={17}/><span>Every result is a snapshot of your growth. Keep showing up.</span></div></div><div className="panel page-panel"><div className="panel-title"><div><small>ASSESSMENT RECORD</small><h3>Published marks</h3></div><span className="muted small">{s.grades.length} results</span></div>{s.grades.length?<div className="data-list">{s.grades.map(g=><div className="grade-row"key={g.id}><span className={`grade-type ${g.assessment_type==='quiz'?'grade-quiz':''}`}>{g.assessment_type==='quiz'?<CircleHelp size={17}/>:<ClipboardCheck size={17}/>}</span><div className="data-main"><b>{g.title}</b><small>{g.course_name} · {shortDate(g.graded_at)}</small></div><div className="grade-score"><b>{g.marks}<small> / {g.max_marks}</small></b><span>Published</span></div><div className="grade-track"><i style={{width:`${Math.min(100,Math.round(g.marks/g.max_marks*100))}%`}}/></div></div>)}</div>:<Empty title="Your marks will appear here"text="When a teacher publishes a result, you’ll find it in this space."/>}</div></>}

function ChatPage(s:Shared){const [course,setCourse]=useState('');const [text,setText]=useState('');const [sending,setSending]=useState(false);useEffect(()=>{if(!course&&s.courses[0])setCourse(s.courses[0].id)},[s.courses,course]);const load=useCallback(async()=>{if(!course)return;try{const res=await api<{messages:ChatMessage[]}>(`/courses/${course}/chat`);s.setMessages(res.messages||[])}catch(e){s.notify(e instanceof Error?e.message:'Unable to load chat.')}},[course]);useEffect(()=>{load()},[load]);const send=async(e:FormEvent)=>{e.preventDefault();if(!text.trim())return;setSending(true);try{await api(`/courses/${course}/chat`,{method:'POST',body:JSON.stringify({body:text.trim()})});setText('');await load()}catch(e){s.notify(e instanceof Error?e.message:'Message could not be sent.')}finally{setSending(false)}};return <div className="chat-layout panel"><aside className="chat-rooms"><div className="chat-room-head"><small>YOUR CLASSROOMS</small><h3>Course chats</h3></div>{s.courses.map((c,i)=><button key={c.id}className={`chat-room ${course===c.id?'chat-room-active':''}`}onClick={()=>setCourse(c.id)}><span className="course-mark"style={{'--course-color':c.color||colors[i%4]} as CSSProperties}>{c.code?.slice(0,2)||'CL'}</span><span><b>{c.name}</b><small>{c.code}</small></span><ChevronRight size={15}/></button>)}</aside><section className="chat-conversation"><div className="chat-heading"><div className="chat-course-icon"><MessageCircle size={17}/></div><div><b>{courseName(course,s.courses)}</b><small>Course classroom · Keep it kind, keep it useful.</small></div><button className="icon-button"aria-label="Chat options"><MoreHorizontal size={18}/></button></div><div className="chat-messages">{s.messages.length?s.messages.map(m=><div key={m.id}className={`chat-message ${m.user_id===s.profile?.id?'chat-mine':''}`}>{m.user_id!==s.profile?.id&&<Avatar name={m.author_name}/>}<div><small>{m.user_id===s.profile?.id?'You':m.author_name} · {new Date(m.created_at).toLocaleTimeString('en',{hour:'numeric',minute:'2-digit'})}</small><p>{m.body}</p></div></div>):<div className="chat-empty"><span><MessageCircle size={19}/></span><b>Start a conversation</b><p>Share a question or help a classmate out.</p></div>}</div><form className="chat-compose"onSubmit={send}><input value={text}onChange={e=>setText(e.target.value)}placeholder="Write a message to your class…"maxLength={2000}/><button className="button button-primary"disabled={sending||!text.trim()}aria-label="Send message"><Send size={16}/></button></form><small className="chat-footnote"><ShieldCheck size={12}/> Only people assigned to this course can see the conversation.</small></section></div>}

function ComplaintsPage(s:Shared){return <div className="panel page-panel"><div className="complaint-intro"><div className="complaint-icon"><LifeBuoy size={19}/></div><div><b>A private line to our campus team.</b><p>Only you and authorized support staff can view your complaint. We’ll share updates here.</p></div></div>{s.complaints.length?<div className="data-list">{s.complaints.map(c=><article className="complaint-row"key={c.id}><div className="complaint-ref"><small>REFERENCE</small><b>{c.reference_code}</b></div><div className="data-main"><b>{c.subject}</b><small>{c.category} · Submitted {shortDate(c.created_at)}</small>{c.response&&<p className="complaint-response">{c.response}</p>}</div><span className={`status-pill complaint-status status-${c.status.replaceAll(' ','-')}`}>{c.status}</span></article>)}</div>:<Empty title="Nothing raised at the moment"text="If something needs attention, our campus team is here to help."/>}<div className="complaint-bottom"><span><LockKeyhole size={14}/> Private and only visible to authorized staff</span><button className="button button-primary"onClick={()=>s.setDialog('complaint')}><Plus size={15}/> Register a complaint</button></div></div>}

function ProfilePage({profile,setProfile,notify}:{profile:Profile|null;setProfile:(p:Profile|null)=>void;notify:(s:string)=>void}){const [name,setName]=useState(profile?.full_name||'');const [department,setDepartment]=useState(profile?.department||'');const [studentId,setStudentId]=useState(profile?.student_id||'');const [saving,setSaving]=useState(false);useEffect(()=>{setName(profile?.full_name||'');setDepartment(profile?.department||'');setStudentId(profile?.student_id||'')},[profile]);const save=async(e:FormEvent)=>{e.preventDefault();setSaving(true);try{const res=await api<{profile:Profile}>('/me',{method:'PATCH',body:JSON.stringify({full_name:name,department,student_id:studentId})});setProfile(res.profile);notify('Your profile has been updated.')}catch(e){notify(e instanceof Error?e.message:'Could not update your profile.')}finally{setSaving(false)}};return <div className="profile-grid"><section className="panel profile-hero"><div className="profile-cover"><div className="profile-avatar-large"><Avatar name={profile?.full_name||''}image={profile?.avatar_url}/></div><span className="cover-glyph">✳</span></div><div className="profile-hero-body"><span className="status-pill status-seen"><span className="live-dot"/> Active account</span><h2>{profile?.full_name||'Campus member'}</h2><p>{profile?.email}</p><div className="profile-tags"><span><GraduationCap size={14}/>{profile?.role||'Student'}</span>{profile?.department&&<span><BookOpen size={13}/>{profile.department}</span>}</div></div></section><section className="panel profile-form-panel"><div className="panel-title"><div><small>YOUR DETAILS</small><h3>Profile information</h3></div><UserRound size={18}/></div><form className="profile-form"onSubmit={save}><label>Full name<input value={name}onChange={e=>setName(e.target.value)}required/></label><label>Institution email<input value={profile?.email||''}disabled/><small>Email is managed by your institution.</small></label><div className="form-columns"><label>{profile?.role==='student'?'Student ID':'Department'}<input value={profile?.role==='student'?studentId:department}onChange={e=>profile?.role==='student'?setStudentId(e.target.value):setDepartment(e.target.value)}placeholder={profile?.role==='student'?'e.g. 24S1234':'e.g. Computing'}/></label><label>Account role<input value={(profile?.role||'student').replace(/^./,s=>s.toUpperCase())}disabled/></label></div><div className="profile-actions"><span><ShieldCheck size={14}/> Your account is institution managed</span><button className="button button-primary"disabled={saving}>{saving?'Saving…':'Save changes'}<ArrowRight size={15}/></button></div></form></section><button className="profile-security panel"onClick={async()=>{try{if(profile?.email){await supabase?.auth.resetPasswordForEmail(profile.email);notify('If your account is eligible, a reset link is on its way.')}}catch{notify('Could not request a password reset.')}}}><span className="security-icon"><LockKeyhole size={17}/></span><span><b>Password & sign-in</b><small>Reset your password through your institution email</small></span><ArrowRight size={17}/></button></div>}
