import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Flame, ShieldAlert, CheckCircle2, Radio, Users, Clock,
  Bell, Activity, Lock, MessageSquare, Send, Siren, Delete,
  LogOut, Shield, HeartPulse, AlertTriangle, Ambulance, Star,
} from "lucide-react";
import { supabase } from "./supabase";
import { initFCM, listenForeground } from "./firebase";

const DEPTS = {
  fire: {
    id: "fire", name: "Fire", short: "FIRE", accent: "#ff3b3b", dim: "#7a1515",
    icon: Flame,
    alerts: [
      { id: "ALL_CALL",       label: "ALL CALL",       sub: "Report to station now",       color: "#ff3b3b", icon: Flame },
      { id: "STRUCTURE_FIRE", label: "STRUCTURE FIRE", sub: "Working fire — full response", color: "#ff6a2b", icon: Flame },
      { id: "MUTUAL_AID",     label: "MUTUAL AID",     sub: "Support requested",            color: "#4a9eff", icon: Radio },
      { id: "STAND_DOWN",     label: "STAND DOWN",     sub: "Cancel / all clear",           color: "#2dd483", icon: CheckCircle2 },
    ],
  },
  police: {
    id: "police", name: "Police", short: "PD", accent: "#4a7eff", dim: "#1a3580",
    icon: Shield,
    alerts: [
      { id: "BACKUP",    label: "BACKUP",    sub: "Officer needs assistance",  color: "#4a7eff", icon: ShieldAlert },
      { id: "ALL_UNITS", label: "ALL UNITS", sub: "Respond to location",       color: "#7a9fff", icon: Users },
      { id: "PURSUIT",   label: "PURSUIT",   sub: "In progress — clear radio", color: "#ff3b3b", icon: Siren },
      { id: "CODE_4",    label: "CODE 4",    sub: "All clear — stand down",    color: "#2dd483", icon: CheckCircle2 },
    ],
  },
  emt: {
    id: "emt", name: "EMT", short: "EMS", accent: "#2dd483", dim: "#0d6640",
    icon: HeartPulse,
    alerts: [
      { id: "MEDICAL",   label: "MEDICAL CALL",  sub: "Respond — patient transport", color: "#2dd483", icon: HeartPulse },
      { id: "MCI",       label: "MASS CASUALTY", sub: "MCI — all crews respond",      color: "#ff3b3b", icon: Siren },
      { id: "TRANSPORT", label: "TRANSPORT",     sub: "Move to receiving facility",   color: "#4a9eff", icon: Ambulance },
      { id: "CLEAR",     label: "CLEARED",       sub: "Return to service",            color: "#2dd483", icon: CheckCircle2 },
    ],
  },
  cert: {
    id: "cert", name: "CERT", short: "CERT", accent: "#f97316", dim: "#7a3608",
    icon: Star,
    alerts: [
      { id: "MOBILIZE",  label: "MOBILIZE",        sub: "Report to staging area",      color: "#f97316", icon: Star },
      { id: "SAR",       label: "SEARCH & RESCUE",  sub: "Active search — all members", color: "#ffae33", icon: AlertTriangle },
      { id: "FIRST_AID", label: "FIRST AID",        sub: "Medical support needed",      color: "#2dd483", icon: HeartPulse },
      { id: "MAJOR",     label: "MAJOR INCIDENT",   sub: "All agencies — respond now",  color: "#ff3b3b", icon: Siren, allAgency: true },
    ],
  },
};

const USERS = [
  { id:"f1", name:"Capt. T. Vega",  rank:"Captain",     dept:"fire",   role:"officer",   pin:"7411" },
  { id:"f2", name:"R. Diaz",        rank:"Firefighter", dept:"fire",   role:"responder", pin:"1234" },
  { id:"f3", name:"L. Nguyen",      rank:"Firefighter", dept:"fire",   role:"responder", pin:"1234" },
  { id:"p1", name:"Sgt. M. Cole",   rank:"Sergeant",    dept:"police", role:"officer",   pin:"2580" },
  { id:"p2", name:"J. Park",        rank:"Officer",     dept:"police", role:"responder", pin:"1234" },
  { id:"p3", name:"D. Frost",       rank:"Officer",     dept:"police", role:"responder", pin:"1234" },
  { id:"e1", name:"Lt. S. Tran",    rank:"Lieutenant",  dept:"emt",    role:"officer",   pin:"3690" },
  { id:"e2", name:"K. Okafor",      rank:"Paramedic",   dept:"emt",    role:"responder", pin:"1234" },
  { id:"e3", name:"P. Marsh",       rank:"EMT",         dept:"emt",    role:"responder", pin:"1234" },
  { id:"c1", name:"Dir. A. Reyes",  rank:"Director",    dept:"cert",   role:"officer",   pin:"9000" },
  { id:"c2", name:"H. Vyn",         rank:"CERT Member", dept:"cert",   role:"responder", pin:"1234" },
  { id:"c3", name:"B. Santos",      rank:"CERT Member", dept:"cert",   role:"responder", pin:"1234" },
];

const fmtTime = (d) => d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
const fmtFull = (d) => d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });
const deptUsers = (deptId) => USERS.filter(u => u.dept === deptId);

const mapDispatch = (row) => ({
  key: row.id,
  dept: row.dept,
  alertId: row.alert_id,
  label: row.label,
  sub: row.sub,
  color: row.color,
  allAgency: row.all_agency,
  target: row.target,
  acked: row.acked,
  by: row.dispatched_by,
  at: new Date(row.created_at),
  icon: DEPTS[row.dept]?.alerts.find(a => a.id === row.alert_id)?.icon || Flame,
});

const mapMessage = (row) => ({
  id: row.id,
  userId: row.user_id,
  name: row.user_name,
  role: row.user_role,
  dept: row.dept,
  text: row.text,
  system: row.is_system,
  clr: row.color,
  bg: row.bg,
  at: new Date(row.created_at),
});

/* ── Login ──────────────────────────────────────────────────────── */
function Login({ onAuth }) {
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const [deptFilter, setDeptFilter] = useState("all");

  const submit = (p) => {
    if (p.length !== 4) return;
    if (p === sel.pin) onAuth(sel);
    else { setErr(true); setPin(""); setTimeout(() => setErr(false), 600); }
  };
  const press = (n) => {
    const np = (pin + n).slice(0, 4);
    setPin(np);
    if (np.length === 4) setTimeout(() => submit(np), 120);
  };

  const deptList = Object.values(DEPTS);
  const shown = deptFilter === "all" ? USERS : USERS.filter(u => u.dept === deptFilter);

  return (
    <div className="login">
      <div className="login-head">
        <span className="brand-mark"><Flame size={20} /></span>
        <div>
          <div className="brand-name">RESPOND</div>
          <div className="brand-sub">MULTI-AGENCY DISPATCH</div>
        </div>
      </div>
      {!sel ? (
        <>
          <div className="dept-filter">
            <button className={deptFilter==="all"?"df on":"df"} onClick={()=>setDeptFilter("all")}>ALL</button>
            {deptList.map(d => (
              <button key={d.id} className={deptFilter===d.id?"df on":"df"}
                style={deptFilter===d.id?{"--ac":d.accent}:{}}
                onClick={()=>setDeptFilter(d.id)}>{d.short}</button>
            ))}
          </div>
          <div className="user-list">
            {shown.map(u => {
              const D = DEPTS[u.dept];
              return (
                <button key={u.id} className="user-row" onClick={()=>{setSel(u);setPin("");}}>
                  <span className="avatar" style={{background:`linear-gradient(135deg,${D.accent},${D.dim})`}}>
                    {u.name.split(" ").pop()[0]}
                  </span>
                  <div className="user-meta">
                    <span className="user-name">{u.name}</span>
                    <span className="user-rank">{u.rank} · {D.name}</span>
                  </div>
                  {u.role==="officer"
                    ? <span className="role-pill officer" style={{"--ac":D.accent}}><Shield size={10}/> DISPATCH</span>
                    : <span className="role-pill responder">{D.short}</span>}
                </button>
              );
            })}
          </div>
          <p className="demo-note">Officers: Fire 7411 · PD 2580 · EMS 3690 · CERT 9000 · Crew: 1234</p>
        </>
      ) : (
        <div className={`pinpad ${err?"shake":""}`}>
          <button className="back" onClick={()=>{setSel(null);setPin("");}}>← back</button>
          <span className="avatar lg" style={{background:`linear-gradient(135deg,${DEPTS[sel.dept].accent},${DEPTS[sel.dept].dim})`}}>
            {sel.name.split(" ").pop()[0]}
          </span>
          <div className="pin-name">{sel.name}</div>
          <div className="pin-rank">{sel.rank} · {DEPTS[sel.dept].name}</div>
          <div className="dots">
            {[0,1,2,3].map(i=>(
              <span key={i} className={`dot ${pin.length>i?"on":""} ${err?"bad":""}`}
                style={pin.length>i?{background:DEPTS[sel.dept].accent,borderColor:DEPTS[sel.dept].accent}:{}}/>
            ))}
          </div>
          <div className="keypad">
            {[1,2,3,4,5,6,7,8,9].map(n=>(
              <button key={n} onClick={()=>press(String(n))}>{n}</button>
            ))}
            <span/><button onClick={()=>press("0")}>0</button>
            <button className="del" onClick={()=>setPin(pin.slice(0,-1))}><Delete size={20}/></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Hold button ────────────────────────────────────────────────── */
function HoldButton({ alert, onFire }) {
  const [progress, setProgress] = useState(0);
  const raf = useRef(null); const start = useRef(0); const HOLD_MS = 1100;
  const Icon = alert.icon;

  const tick = useCallback((t) => {
    if (!start.current) start.current = t;
    const p = Math.min(1, (t - start.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) { onFire(alert); cancel(); return; }
    raf.current = requestAnimationFrame(tick);
  }, [alert, onFire]);

  const begin = () => { start.current = 0; raf.current = requestAnimationFrame(tick); };
  const cancel = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null; start.current = 0; setProgress(0);
  };

  const R=28, C=2*Math.PI*R;
  return (
    <button onPointerDown={begin} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      className="hold-btn" style={{"--clr":alert.color}}>
      <div className="hold-ring">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={R} stroke="rgba(255,255,255,.1)" strokeWidth="3.5" fill="none"/>
          <circle cx="36" cy="36" r={R} stroke="var(--clr)" strokeWidth="3.5" fill="none" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C*(1-progress)} transform="rotate(-90 36 36)"
            style={{transition:progress===0?"stroke-dashoffset .25s ease":"none"}}/>
        </svg>
        <Icon size={24} strokeWidth={2.2} style={{color:alert.color}} className="hold-icon"/>
      </div>
      <span className="hold-label">{alert.label}</span>
      <span className="hold-sub">{alert.sub}</span>
      {alert.allAgency && <span className="all-agency-badge">ALL AGENCIES</span>}
      <span className="hold-hint">{progress>0?"HOLD…":"HOLD TO SEND"}</span>
    </button>
  );
}

/* ── Dispatch view ──────────────────────────────────────────────── */
function DispatchView({ log, online, onFire, dept }) {
  const D = DEPTS[dept];
  const live = log.filter(e=>e.dept===dept||e.allAgency)[0];
  return (
    <div className="scroll">
      <div className="status-grid">
        <div className="stat"><Users size={14}/><span className="stat-num">{online}</span><span className="stat-lbl">on duty</span></div>
        <div className="stat"><Activity size={14}/><span className="stat-num">{log.filter(e=>e.dept===dept).length}</span><span className="stat-lbl">today</span></div>
        <div className="stat"><span className="pulse-dot" style={{color:D.accent}}>●</span><span className="stat-num" style={{color:D.accent}}>LIVE</span><span className="stat-lbl">network</span></div>
      </div>
      {live && (
        <div className="live-banner" style={{"--clr":live.color}}>
          <div className="live-row">
            <span className="live-tag">{live.allAgency?"⚡ ALL-AGENCY":"LAST DISPATCH"}</span>
            <span className="live-time">{fmtFull(live.at)}</span>
          </div>
          <div className="live-label">{live.label}</div>
          <div className="ack-bar"><div className="ack-fill" style={{width:`${(live.acked/live.target)*100}%`}}/></div>
          <span className="ack-text">{live.acked}/{live.target} acknowledged</span>
        </div>
      )}
      <p className="section-cap">SELECT ALERT · HOLD TO SEND</p>
      <div className="btn-grid">{D.alerts.map(a=><HoldButton key={a.id} alert={a} onFire={onFire}/>)}</div>
      <p className="section-cap">DISPATCH LOG</p>
      <div className="log">
        {log.filter(e=>e.dept===dept||e.allAgency).length===0 && <div className="log-empty">No dispatches yet today.</div>}
        {log.filter(e=>e.dept===dept||e.allAgency).map(e=>(
          <div className="log-row" key={e.key} style={{"--clr":e.color}}>
            <span className="log-dot"/>
            <div className="log-main">
              <span className="log-label">{e.label} {e.allAgency&&<span className="mini-tag">ALL AGENCY</span>}</span>
              <span className="log-meta">{e.acked}/{e.target} acked · by {e.by}</span>
            </div>
            <span className="log-time">{fmtTime(e.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Alerts view ────────────────────────────────────────────────── */
function AlertsView({ live, onAck, acked, log }) {
  return (
    <div className="scroll">
      {!live ? (
        <div className="resp-idle">
          <div className="idle-ring" style={{borderColor:"var(--accent)"}}><Bell size={28}/></div>
          <p className="idle-title">STANDING BY</p>
          <p className="idle-sub">You'll be alerted the moment a call drops.</p>
        </div>
      ) : (
        <div className="resp-active" style={{"--clr":live.color}}>
          {live.allAgency && <span className="all-call-tag">⚡ ALL-AGENCY ALERT</span>}
          <span className="resp-flash">INCOMING</span>
          <div className="resp-icon"><live.icon size={42} strokeWidth={2.2}/></div>
          <h2 className="resp-label">{live.label}</h2>
          <p className="resp-sub">{live.sub}</p>
          <span className="resp-time">Dispatched {fmtFull(live.at)} · {live.by}</span>
          <button className="ack-btn" onClick={onAck} disabled={acked}>
            {acked?"✓ EN ROUTE — ACKNOWLEDGED":"ACKNOWLEDGE — ON MY WAY"}
          </button>
        </div>
      )}
      {log.length>0 && (
        <>
          <p className="section-cap" style={{marginTop:24}}>RECENT</p>
          <div className="log">
            {log.map(e=>(
              <div className="log-row" key={e.key} style={{"--clr":e.color}}>
                <span className="log-dot"/>
                <div className="log-main">
                  <span className="log-label">{e.label}</span>
                  <span className="log-meta">by {e.by} {e.allAgency&&"· All Agency"}</span>
                </div>
                <span className="log-time">{fmtTime(e.at)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Chat view ──────────────────────────────────────────────────── */
function ChatView({ messages, onSend, user }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  const send = () => { const t=text.trim(); if(!t) return; onSend(t); setText(""); };
  const D = DEPTS[user.dept];
  return (
    <div className="chat-wrap">
      <div className="chat-dept-tag" style={{background:`${D.accent}22`,color:D.accent}}>
        <D.icon size={12}/> {D.name} Channel
      </div>
      <div className="chat-scroll">
        {messages.map(m=>
          m.system ? (
            <div key={m.id} className="chat-system" style={{color:m.clr||"#ff7676",background:m.bg||"rgba(255,59,59,.1)"}}>
              <Siren size={12}/> {m.text}
            </div>
          ) : (
            <div key={m.id} className={`chat-msg ${m.userId===user.id?"mine":""}`}>
              {m.userId!==user.id && (
                <span className="chat-sender">
                  {m.name}
                  {m.role==="officer"&&<span className="mini-pill"><Shield size={9}/></span>}
                  <span className="dept-dot" style={{background:DEPTS[m.dept]?.accent||"#888"}}/>
                </span>
              )}
              <div className="bubble" style={m.userId===user.id?{background:`linear-gradient(135deg,${D.accent},${D.dim})`}:{}}>{m.text}</div>
              <span className="chat-time">{fmtTime(m.at)}</span>
            </div>
          )
        )}
        <div ref={endRef}/>
      </div>
      <div className="chat-input">
        <input value={text} onChange={e=>setText(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder={`Message ${D.name} crew…`} maxLength={300}/>
        <button onClick={send} disabled={!text.trim()} style={{background:D.accent}}><Send size={18}/></button>
      </div>
    </div>
  );
}

/* ── Root ───────────────────────────────────────────────────────── */
export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("alerts");
  const [now, setNow] = useState(new Date());
  const [log, setLog] = useState([]);
  const [messages, setMessages] = useState([]);
  const [acked, setAcked] = useState(false);
  const [connected, setConnected] = useState(false);
  const [foregroundAlert, setForegroundAlert] = useState(null);
  const ackTimer = useRef(null);

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);

  // Foreground FCM messages (app is open)
  useEffect(()=>{
    const unsub = listenForeground(alert => {
      setForegroundAlert(alert);
      setTimeout(()=>setForegroundAlert(null), 6000);
    });
    return unsub;
  },[]);

  // Load initial data + subscribe to real-time + poll fallback
  // Cursors track actual DB timestamps (not client clock) to avoid clock-skew gaps
  const cursorMsg      = useRef(null);
  const cursorDispatch = useRef(null);

  useEffect(()=>{
    let dispatchChannel, messageChannel, pollTimer;

    async function initialLoad() {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const [{ data: dispatches }, { data: msgs }] = await Promise.all([
        supabase.from('dispatches').select('*')
          .gte('created_at', todayStart.toISOString())
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('messages').select('*')
          .order('created_at', { ascending: true }).limit(100),
      ]);
      if (dispatches?.length) {
        setLog(dispatches.map(mapDispatch));
        // Cursor = oldest dispatch (list is desc, so last item is oldest... we want newest)
        cursorDispatch.current = dispatches[0].created_at;
      }
      if (msgs?.length) {
        setMessages(msgs.map(mapMessage));
        cursorMsg.current = msgs[msgs.length - 1].created_at;
      }
    }

    // Poll only fetches NEW rows using DB timestamps as cursor — never overwrites state
    async function pollNew() {
      const [{ data: newDispatches }, { data: newMsgs }] = await Promise.all([
        cursorDispatch.current
          ? supabase.from('dispatches').select('*').gt('created_at', cursorDispatch.current).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
        cursorMsg.current
          ? supabase.from('messages').select('*').gt('created_at', cursorMsg.current).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);
      if (newDispatches?.length) {
        cursorDispatch.current = newDispatches[newDispatches.length - 1].created_at;
        setLog(l => {
          const ids = new Set(l.map(x => x.key));
          const add = newDispatches.filter(d => !ids.has(d.id)).map(mapDispatch);
          return add.length ? [...add, ...l] : l;
        });
        setAcked(false);
        if (navigator.vibrate) navigator.vibrate([40,30,80]);
      }
      if (newMsgs?.length) {
        cursorMsg.current = newMsgs[newMsgs.length - 1].created_at;
        setMessages(m => {
          const ids = new Set(m.map(x => x.id));
          const add = newMsgs.filter(msg => !ids.has(msg.id)).map(mapMessage);
          return add.length ? [...m, ...add] : m;
        });
      }
    }

    async function init() {
      const { count } = await supabase.from('messages').select('*', { count:'exact', head:true });
      if (count === 0) {
        await supabase.from('messages').insert([
          { user_id:'f1', user_name:'Capt. T. Vega', user_role:'officer', dept:'fire',   text:'Morning crew — apparatus check at 0700.', is_system:false },
          { user_id:'p1', user_name:'Sgt. M. Cole',  user_role:'officer', dept:'police', text:'Briefing in 10. Stay sharp.',              is_system:false },
        ]);
      }
      await initialLoad();

      // Real-time: new dispatches
      dispatchChannel = supabase.channel('rt-dispatches-v3')
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'dispatches' }, payload => {
          setLog(l => l.some(e => e.key===payload.new.id) ? l : [mapDispatch(payload.new), ...l]);
          setAcked(false);
          if (navigator.vibrate) navigator.vibrate([40,30,80]);
        })
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'dispatches' }, payload => {
          setLog(l => l.map(e => e.key===payload.new.id ? {...e, acked:payload.new.acked} : e));
        })
        .subscribe(status => { if (status==='SUBSCRIBED') setConnected(true); });

      // Real-time: new messages
      messageChannel = supabase.channel('rt-messages-v3')
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload => {
          setMessages(m => m.some(x => x.id===payload.new.id) ? m : [...m, mapMessage(payload.new)]);
        })
        .subscribe();

      // Poll every 4s — only adds NEW rows, never replaces existing state
      pollTimer = setInterval(pollNew, 4000);
    }

    init();
    return () => {
      if (dispatchChannel) supabase.removeChannel(dispatchChannel);
      if (messageChannel) supabase.removeChannel(messageChannel);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  const pushMsg = useCallback(async (m) => {
    // Optimistic update — show immediately, deduplicate when real-time fires
    const tempId = 'tmp-' + Math.random().toString(36).slice(2);
    const optimistic = { id: tempId, userId: m.userId||'system', name: m.name||'System',
      role: m.role||'system', dept: m.dept||null, text: m.text,
      system: !!m.system, clr: m.clr||null, bg: m.bg||null, at: new Date() };
    setMessages(prev => [...prev, optimistic]);

    const { data } = await supabase.from('messages').insert({
      user_id:   m.userId  || 'system',
      user_name: m.name    || 'System',
      user_role: m.role    || 'system',
      dept:      m.dept    || null,
      text:      m.text,
      is_system: !!m.system,
      color:     m.clr     || null,
      bg:        m.bg      || null,
    }).select().single();

    // Replace temp entry with real one from DB and advance cursor
    if (data) {
      setMessages(prev => prev.map(x => x.id===tempId ? mapMessage(data) : x));
      if (data.created_at > (cursorMsg.current || '')) cursorMsg.current = data.created_at;
    }
  }, [cursorMsg]);

  const fire = useCallback(async (alert) => {
    if (!user) return;
    if (navigator.vibrate) navigator.vibrate([40,30,80]);
    const target = alert.allAgency ? USERS.length : deptUsers(user.dept).length;

    // Optimistic update — show dispatch instantly
    const tempKey = 'tmp-' + Math.random().toString(36).slice(2);
    const optimisticEntry = {
      key: tempKey, dept: user.dept, alertId: alert.id,
      label: alert.label, sub: alert.sub, color: alert.color,
      allAgency: !!alert.allAgency, target, acked: 0,
      by: user.name, at: new Date(), icon: alert.icon,
    };
    setLog(l => [optimisticEntry, ...l]);
    setAcked(false);

    const { data: dispatch, error } = await supabase.from('dispatches').insert({
      dept:             user.dept,
      alert_id:         alert.id,
      label:            alert.label,
      sub:              alert.sub,
      color:            alert.color,
      all_agency:       !!alert.allAgency,
      target,
      acked:            0,
      dispatched_by:    user.name,
      dispatched_by_id: user.id,
    }).select().single();

    if (error || !dispatch) { console.error('Dispatch failed:', error); return; }

    // Replace temp entry with real DB entry and advance cursor
    setLog(l => l.map(e => e.key===tempKey ? mapDispatch(dispatch) : e));
    if (dispatch.created_at > (cursorDispatch.current || '')) cursorDispatch.current = dispatch.created_at;

    await pushMsg({
      system: true,
      text: `${alert.label} dispatched by ${user.name} (${DEPTS[user.dept].name})`,
      clr: alert.color,
      bg: `${alert.color}18`,
    });

    // Simulate crew acks rolling in
    if (ackTimer.current) clearInterval(ackTimer.current);
    let n = 0;
    ackTimer.current = setInterval(async () => {
      n += 1;
      await supabase.from('dispatches').update({ acked: Math.min(target - 1, n) }).eq('id', dispatch.id);
      if (n === 1) {
        await pushMsg({ userId:'f2', name:'R. Diaz', role:'responder', dept:'fire', text:'Copy — en route.' });
      }
      if (n >= target - 1) clearInterval(ackTimer.current);
    }, 900);
  }, [user, pushMsg]);

  const ack = useCallback(async () => {
    setAcked(true);
    if (navigator.vibrate) navigator.vibrate(25);
    if (log[0]) {
      await supabase.from('dispatches')
        .update({ acked: Math.min(log[0].target, log[0].acked + 1) })
        .eq('id', log[0].key);
    }
  }, [log]);

  const sendChat = useCallback((text) => {
    if (!user) return;
    pushMsg({ userId:user.id, name:user.name, role:user.role, dept:user.dept, text });
  }, [user, pushMsg]);

  if (!user) return (
    <div className="app-root">
      <style>{STYLES}</style>
      <Login onAuth={u => { setUser(u); setTab("alerts"); initFCM(u.id, u.dept); }}/>
    </div>
  );

  const D = DEPTS[user.dept];
  const isOfficer = user.role === "officer";
  const tabs = isOfficer
    ? [{id:"dispatch",icon:Siren,label:"Dispatch"},{id:"alerts",icon:Bell,label:"Alerts"},{id:"chat",icon:MessageSquare,label:"Chat"}]
    : [{id:"alerts",icon:Bell,label:"Alerts"},{id:"chat",icon:MessageSquare,label:"Chat"}];

  const myLog = log.filter(e => e.dept===user.dept || e.allAgency);
  const live = myLog[0] || null;
  const deptMessages = messages.filter(m => m.system || m.dept===user.dept || !m.dept);

  return (
    <div className="app-root" style={{"--accent":D.accent,"--accent-dim":D.dim}}>
      <style>{STYLES}</style>
      {foregroundAlert && (
        <div className="fg-toast" onClick={()=>setForegroundAlert(null)}>
          <Siren size={14}/> <strong>{foregroundAlert.title}</strong> — {foregroundAlert.body}
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" style={{background:`linear-gradient(135deg,${D.accent},${D.dim})`}}>
            <D.icon size={15}/>
          </span>
          <div className="brand-text">
            <span className="brand-name">RESPOND</span>
            <span className="brand-sub">{D.name.toUpperCase()} · STATION 1</span>
          </div>
        </div>
        <div className="top-right">
          <div className="clock"><Clock size={11}/>{fmtFull(now)}</div>
          <div className={`conn-dot ${connected?"on":""}`} title={connected?"Live":"Connecting…"}/>
          <button className="logout" onClick={()=>{setUser(null);setLog([]);}}><LogOut size={15}/></button>
        </div>
      </header>
      <div className="who">
        <span className="avatar xs" style={{background:`linear-gradient(135deg,${D.accent},${D.dim})`}}>
          {user.name.split(" ").pop()[0]}
        </span>
        <span className="who-name">{user.name}</span>
        <span className="role-pill" style={isOfficer?{"--ac":D.accent,"background":`${D.accent}28`,"color":D.accent}:{}}>
          {isOfficer?<><Shield size={10}/> DISPATCH</>:"RESPONDER"}
        </span>
      </div>
      <main className="body">
        {tab==="dispatch" && isOfficer  && <DispatchView log={log} online={deptUsers(user.dept).length} onFire={fire} dept={user.dept}/>}
        {tab==="dispatch" && !isOfficer && <div className="locked"><Lock size={34}/><p>Dispatch is restricted to officers.</p></div>}
        {tab==="alerts"   && <AlertsView live={live} onAck={ack} acked={acked} log={myLog}/>}
        {tab==="chat"     && <ChatView messages={deptMessages} onSend={sendChat} user={user}/>}
      </main>
      <nav className="tabbar">
        {tabs.map(t=>{const I=t.icon;return(
          <button key={t.id} className={tab===t.id?"tb on":"tb"} onClick={()=>setTab(t.id)}
            style={tab===t.id?{color:D.accent}:{}}>
            <I size={20}/><span>{t.label}</span>
          </button>
        );})}
      </nav>
    </div>
  );
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
.app-root{max-width:440px;margin:0 auto;height:100vh;height:100dvh;display:flex;flex-direction:column;
  background:radial-gradient(120% 55% at 50% -8%,#15161b 0%,#0c0d11 55%,#08090c 100%);
  color:#e9e9ee;font-family:'Barlow',sans-serif;overflow:hidden;}
.brand-mark{width:30px;height:30px;border-radius:7px;display:grid;place-items:center;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.3);}
.brand-name{font-family:'Oswald';font-weight:700;font-size:16px;letter-spacing:2px;}
.brand-sub{font-size:9px;letter-spacing:1.6px;color:#85858f;}
.fg-toast{display:flex;align-items:center;gap:8px;padding:11px 16px;background:#ff3b3b;color:#fff;
  font-family:'Oswald';font-size:12px;letter-spacing:.5px;cursor:pointer;animation:slideDown .3s ease;}
@keyframes slideDown{from{transform:translateY(-100%);opacity:0;}to{transform:translateY(0);opacity:1;}}
.conn-dot{width:8px;height:8px;border-radius:50%;background:#444;transition:.4s;}
.conn-dot.on{background:#2dd483;box-shadow:0 0 6px #2dd483;}
.login{flex:1;padding:28px 20px;overflow-y:auto;}
.login-head{display:flex;align-items:center;gap:13px;margin-bottom:24px;}
.login-head .brand-mark{width:44px;height:44px;border-radius:11px;background:linear-gradient(135deg,#ff3b3b,#a01010);}
.dept-filter{display:flex;gap:7px;margin-bottom:16px;flex-wrap:wrap;}
.df{padding:7px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:transparent;
  color:#7d7d87;font-family:'Oswald';font-size:11px;letter-spacing:1.5px;cursor:pointer;transition:.15s;}
.df.on{background:var(--ac,#ff3b3b);color:#fff;border-color:transparent;}
.user-list{display:flex;flex-direction:column;gap:8px;}
.user-row{display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:13px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);cursor:pointer;transition:.18s;text-align:left;}
.user-row:hover{background:rgba(255,255,255,.07);}
.avatar{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;flex-shrink:0;
  font-family:'Oswald';font-weight:700;font-size:17px;color:#fff;}
.avatar.lg{width:64px;height:64px;border-radius:16px;font-size:26px;}
.avatar.xs{width:26px;height:26px;border-radius:7px;font-size:12px;}
.user-meta{flex:1;display:flex;flex-direction:column;}
.user-name{font-weight:600;font-size:15px;}
.user-rank{font-size:11px;color:#85858f;}
.role-pill{display:inline-flex;align-items:center;gap:4px;font-family:'Oswald';font-size:9.5px;
  letter-spacing:1.2px;padding:4px 9px;border-radius:20px;font-weight:600;}
.role-pill.officer{background:rgba(255,59,59,.16);color:#ff7676;}
.role-pill.responder{background:rgba(255,255,255,.08);color:#9a9aa3;}
.demo-note{margin-top:16px;font-family:'JetBrains Mono';font-size:9.5px;color:#5c5c66;text-align:center;}
.pinpad{display:flex;flex-direction:column;align-items:center;padding-top:6px;}
.pinpad.shake{animation:shake .4s;}
@keyframes shake{0%,100%{transform:translateX(0);}20%,60%{transform:translateX(-9px);}40%,80%{transform:translateX(9px);}}
.back{align-self:flex-start;background:none;border:none;color:#85858f;font-size:13px;cursor:pointer;margin-bottom:14px;}
.pin-name{font-family:'Oswald';font-weight:600;font-size:19px;margin-top:12px;letter-spacing:.5px;}
.pin-rank{font-size:12px;color:#85858f;margin-bottom:20px;}
.dots{display:flex;gap:15px;margin-bottom:28px;}
.dot{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.25);transition:.15s;}
.keypad{display:grid;grid-template-columns:repeat(3,72px);gap:14px;}
.keypad button{width:72px;height:72px;border-radius:50%;font-family:'JetBrains Mono';font-size:26px;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#fff;cursor:pointer;transition:.12s;}
.keypad button:active{background:rgba(255,255,255,.16);transform:scale(.94);}
.keypad .del{background:none;border:none;color:#85858f;}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:13px 16px 11px;border-bottom:1px solid rgba(255,255,255,.06);}
.brand{display:flex;align-items:center;gap:9px;}
.brand-text{display:flex;flex-direction:column;line-height:1.1;}
.top-right{display:flex;align-items:center;gap:9px;}
.clock{display:flex;align-items:center;gap:5px;font-family:'JetBrains Mono';font-size:11px;
  color:#a7a7b0;background:rgba(255,255,255,.04);padding:5px 9px;border-radius:6px;}
.logout{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#9a9aa3;
  width:31px;height:31px;border-radius:8px;display:grid;place-items:center;cursor:pointer;}
.who{display:flex;align-items:center;gap:8px;padding:9px 16px;border-bottom:1px solid rgba(255,255,255,.05);background:rgba(255,255,255,.02);}
.who-name{font-weight:600;font-size:13px;flex:1;}
.body{flex:1;overflow:hidden;display:flex;flex-direction:column;}
.scroll{flex:1;overflow-y:auto;padding:14px 16px 16px;}
.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;}
.stat{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);border-radius:11px;
  padding:11px 10px;display:flex;flex-direction:column;gap:3px;color:#9a9aa3;}
.stat-num{font-family:'JetBrains Mono';font-weight:700;font-size:19px;color:#fff;}
.stat-lbl{font-size:9px;letter-spacing:1px;text-transform:uppercase;}
.pulse-dot{font-size:10px;animation:pulse 1.4s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
.live-banner{border:1px solid var(--clr);border-radius:13px;padding:13px;margin-bottom:15px;
  background:linear-gradient(180deg,color-mix(in srgb,var(--clr) 12%,transparent),transparent);}
.live-row{display:flex;justify-content:space-between;align-items:center;}
.live-tag{font-family:'Oswald';font-size:10px;letter-spacing:2px;color:var(--clr);}
.live-time{font-family:'JetBrains Mono';font-size:11px;color:#9a9aa3;}
.live-label{font-family:'Oswald';font-weight:700;font-size:24px;letter-spacing:1px;margin:5px 0 9px;}
.ack-bar{height:6px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;}
.ack-fill{height:100%;background:var(--clr);border-radius:4px;transition:width .6s ease;}
.ack-text{font-family:'JetBrains Mono';font-size:11px;color:#b5b5bd;margin-top:6px;display:block;}
.section-cap{font-family:'Oswald';font-size:11px;letter-spacing:2.4px;color:#74747e;margin:4px 0 10px;}
.btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;}
.hold-btn{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;
  padding:15px 10px 28px;border-radius:15px;cursor:pointer;user-select:none;touch-action:none;
  background:rgba(255,255,255,.04);border:1px solid color-mix(in srgb,var(--clr) 35%,transparent);transition:transform .12s;}
.hold-btn:active{transform:scale(.97);}
.hold-ring{position:relative;width:72px;height:72px;display:grid;place-items:center;}
.hold-ring svg{position:absolute;inset:0;}
.hold-icon{position:relative;}
.hold-label{font-family:'Oswald';font-weight:700;font-size:13px;letter-spacing:.8px;color:#fff;text-align:center;}
.hold-sub{font-size:9.5px;color:#9a9aa3;text-align:center;line-height:1.2;}
.hold-hint{position:absolute;bottom:8px;font-family:'JetBrains Mono';font-size:8px;letter-spacing:1px;color:var(--clr);}
.all-agency-badge{font-family:'JetBrains Mono';font-size:8px;letter-spacing:1px;padding:2px 7px;
  border-radius:10px;background:rgba(255,59,59,.2);color:#ff7676;}
.log{display:flex;flex-direction:column;gap:7px;}
.log-empty{font-size:12px;color:#6a6a73;padding:14px;text-align:center;border:1px dashed rgba(255,255,255,.1);border-radius:10px;}
.log-row{display:flex;align-items:center;gap:11px;padding:11px 13px;background:rgba(255,255,255,.035);border-radius:10px;border-left:3px solid var(--clr);}
.log-dot{width:7px;height:7px;border-radius:50%;background:var(--clr);flex-shrink:0;}
.log-main{flex:1;display:flex;flex-direction:column;}
.log-label{font-family:'Oswald';font-weight:600;font-size:13px;letter-spacing:.5px;}
.log-meta{font-family:'JetBrains Mono';font-size:10px;color:#8a8a93;}
.log-time{font-family:'JetBrains Mono';font-size:11px;color:#9a9aa3;}
.mini-tag{font-family:'JetBrains Mono';font-size:9px;background:rgba(255,59,59,.2);color:#ff8a8a;padding:1px 5px;border-radius:4px;margin-left:4px;}
.resp-idle{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:60px;gap:13px;}
.idle-ring{width:88px;height:88px;border-radius:50%;display:grid;place-items:center;border:2px solid;color:#5e5e68;animation:breathe 3s infinite;}
@keyframes breathe{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.05);}50%{box-shadow:0 0 0 13px rgba(255,255,255,0);}}
.idle-title{font-family:'Oswald';font-weight:600;letter-spacing:3px;font-size:15px;color:#cfcfd6;}
.idle-sub{font-size:13px;color:#7d7d87;max-width:230px;}
.all-call-tag{font-family:'Oswald';font-size:11px;letter-spacing:3px;color:#ff7676;background:rgba(255,59,59,.15);padding:5px 14px;border-radius:20px;}
.resp-active{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:16px;gap:7px;}
.resp-flash{font-family:'Oswald';font-weight:700;letter-spacing:5px;font-size:13px;color:var(--clr);animation:flash 1s steps(2) infinite;}
@keyframes flash{50%{opacity:.25;}}
.resp-icon{width:100px;height:100px;border-radius:50%;display:grid;place-items:center;color:var(--clr);
  border:2px solid var(--clr);margin:4px 0;animation:ring 1.4s infinite;}
@keyframes ring{0%,100%{box-shadow:0 0 36px -8px var(--clr);}50%{box-shadow:0 0 52px 2px var(--clr);}}
.resp-label{font-family:'Oswald';font-weight:700;font-size:30px;letter-spacing:1px;color:#fff;}
.resp-sub{font-size:14px;color:#b5b5bd;}
.resp-time{font-family:'JetBrains Mono';font-size:10.5px;color:#8a8a93;}
.ack-btn{margin-top:20px;width:100%;padding:17px;border:none;border-radius:13px;font-family:'Oswald';
  font-weight:700;font-size:15px;letter-spacing:1px;background:var(--clr);color:#08080a;cursor:pointer;}
.ack-btn:disabled{background:rgba(45,212,131,.16);color:#2dd483;border:1px solid rgba(45,212,131,.4);}
.locked{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#6a6a73;padding:40px;text-align:center;}
.locked p{font-size:14px;max-width:220px;}
.chat-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.chat-dept-tag{display:flex;align-items:center;gap:6px;padding:7px 14px;font-family:'Oswald';font-size:11px;letter-spacing:2px;}
.chat-scroll{flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:10px;}
.chat-system{align-self:center;display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono';
  font-size:11px;padding:6px 12px;border-radius:20px;text-align:center;}
.chat-msg{display:flex;flex-direction:column;max-width:78%;align-self:flex-start;gap:2px;}
.chat-msg.mine{align-self:flex-end;align-items:flex-end;}
.chat-sender{font-size:11px;color:#9a9aa3;font-weight:600;display:flex;align-items:center;gap:4px;padding-left:3px;}
.mini-pill{display:inline-grid;place-items:center;width:15px;height:15px;border-radius:5px;background:rgba(255,59,59,.2);color:#ff7676;}
.dept-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.bubble{padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.35;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.06);border-bottom-left-radius:4px;}
.chat-msg.mine .bubble{border:none;color:#fff;border-bottom-left-radius:14px;border-bottom-right-radius:4px;}
.chat-time{font-family:'JetBrains Mono';font-size:9.5px;color:#6a6a73;padding:0 4px;}
.chat-input{display:flex;gap:9px;padding:11px 13px;border-top:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.2);}
.chat-input input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);
  border-radius:22px;padding:11px 16px;color:#fff;font-family:'Barlow';font-size:14px;outline:none;}
.chat-input input:focus{border-color:var(--accent,#ff3b3b);}
.chat-input button{width:44px;height:44px;border-radius:50%;border:none;color:#fff;
  display:grid;place-items:center;cursor:pointer;flex-shrink:0;transition:.15s;}
.chat-input button:disabled{background:rgba(255,255,255,.08)!important;color:#5c5c66;}
.tabbar{display:flex;border-top:1px solid rgba(255,255,255,.08);background:rgba(10,10,13,.95);
  padding-bottom:env(safe-area-inset-bottom);}
.tb{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 0 12px;
  background:none;border:none;color:#6a6a73;cursor:pointer;font-family:'Oswald';font-size:10px;letter-spacing:1px;transition:.15s;}
.tb span{text-transform:uppercase;}
`;
