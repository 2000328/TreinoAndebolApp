import { useState, useMemo, useEffect, useRef } from "react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import clubLogo from "@/imports/FC-Infesta-Louros.png";
import {
  Activity, Users, BarChart3, Trophy,
  ChevronLeft, ChevronRight, Plus, Clock, MapPin,
  Edit2, Save, X, Trash2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

// ── API ────────────────────────────────────────────────────────────────────────

const API = "https://icdqeecsmpvxwdajgisd.supabase.co/functions/v1/make-server-8a2c2059";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZHFlZWNzbXB2eHdkYWpnaXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTM0NTksImV4cCI6MjEwNDM2OTQ1OX0.zV77ENnMkqapGDwV6TvlSFIkrC9Cj6avPGM5FNcTp6I";
const HEADERS = { "Content-Type": "application/json", "Authorization": `Bearer ${ANON_KEY}` };

async function apiFetch(path: string) {
  const r = await fetch(`${API}${path}`, { headers: HEADERS });
  return r.json();
}
async function apiSave(path: string, data: unknown) {
  await fetch(`${API}${path}`, { method: "PUT", headers: HEADERS, body: JSON.stringify(data) });
}

// ── Navigation ─────────────────────────────────────────────────────────────────

type Page =
  | { id: "home" }
  | { id: "training-cal" }
  | { id: "training-detail"; date: string }
  | { id: "attendance-sessions" }
  | { id: "attendance-detail"; sessionId: string }
  | { id: "dashboard" }
  | { id: "games-list" }
  | { id: "games-detail"; gameId: string };

// ── Types ──────────────────────────────────────────────────────────────────────

type AttendanceStatus = "present" | "absent" | "justified" | "injured";
type BlockKey =
  | "activation" | "individualTech" | "collectiveTech"
  | "individualTactics" | "collectiveTactics" | "gameSituations"
  | "specialGameSituations" | "cooldown" | "finalTalk";

interface TrainingSession {
  id: string; date: string; startTime: string; endTime: string; location: string;
  blocks: Record<BlockKey, number>;
  blockNotes: Record<BlockKey, string>;
}
interface Player {
  id: string; cipa: string; shirtNumber: number;
  firstName: string; lastName: string; nickname: string; isGoalkeeper: boolean;
}
interface AttendanceRecord { sessionId: string; playerId: string; status: AttendanceStatus; }
interface GoalEvent { playerId: string; minute: number; }
interface Game {
  id: string; date: string; time: string; location: string;
  opponent: string; isHome: boolean; result: string;
  scorers: GoalEvent[]; goalsConceded: GoalEvent[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BLOCK_LABELS: Record<BlockKey, string> = {
  activation: "Ativação", individualTech: "Técnica Individual",
  collectiveTech: "Técnica Coletiva", individualTactics: "Tática Individual",
  collectiveTactics: "Tática Coletiva", gameSituations: "Situações de Jogo",
  specialGameSituations: "Situações Especiais de Jogo",
  cooldown: "Regresso à Calma", finalTalk: "Palestra Final",
};
const BLOCK_COLORS: Record<BlockKey, string> = {
  activation: "#fbbf24", individualTech: "#60a5fa", collectiveTech: "#3b82f6",
  individualTactics: "#a78bfa", collectiveTactics: "#8b5cf6",
  gameSituations: "#f97316", specialGameSituations: "#ef4444",
  cooldown: "#2dd4bf", finalTalk: "#94a3b8",
};
const BLOCK_KEYS = Object.keys(BLOCK_LABELS) as BlockKey[];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_PT = ["D","S","T","Q","Q","S","S"];
const TODAY = new Date().toISOString().split("T")[0];

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }
function formatDate(d: string) { const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; }
function totalBlockMin(s: TrainingSession) { return Object.values(s.blocks).reduce((a,b)=>a+b,0); }
function mkBlocks(vals: number[]): Record<BlockKey, number> {
  return Object.fromEntries(BLOCK_KEYS.map((k,i)=>[k,vals[i]??0])) as Record<BlockKey,number>;
}
function mkNotes(): Record<BlockKey, string> {
  return Object.fromEntries(BLOCK_KEYS.map(k=>[k,""])) as Record<BlockKey,string>;
}
function gameOutcome(g: Game): "win"|"loss"|"draw"|null {
  if (!g.result) return null;
  const [a,b]=g.result.split("-").map(Number);
  const my=g.isHome?a:b, op=g.isHome?b:a;
  return my>op?"win":my<op?"loss":"draw";
}

// ── Seed Data ──────────────────────────────────────────────────────────────────

const INITIAL_PLAYERS: Player[] = [
  { id:"p1",  cipa:"2345678", shirtNumber:1,  firstName:"Ricardo", lastName:"Ferreira", nickname:"Ric",      isGoalkeeper:true  },
  { id:"p2",  cipa:"3456789", shirtNumber:16, firstName:"Bruno",   lastName:"Santos",   nickname:"Bru",      isGoalkeeper:true  },
  { id:"p3",  cipa:"4567890", shirtNumber:4,  firstName:"Carlos",  lastName:"Oliveira", nickname:"Caco",     isGoalkeeper:false },
  { id:"p4",  cipa:"5678901", shirtNumber:5,  firstName:"Pedro",   lastName:"Mendes",   nickname:"Pedró",    isGoalkeeper:false },
  { id:"p5",  cipa:"6789012", shirtNumber:7,  firstName:"João",    lastName:"Rodrigues",nickname:"Jota",     isGoalkeeper:false },
  { id:"p6",  cipa:"7890123", shirtNumber:9,  firstName:"André",   lastName:"Costa",    nickname:"Dré",      isGoalkeeper:false },
  { id:"p7",  cipa:"8901234", shirtNumber:11, firstName:"Miguel",  lastName:"Pereira",  nickname:"Migs",     isGoalkeeper:false },
  { id:"p8",  cipa:"9012345", shirtNumber:13, firstName:"Rui",     lastName:"Almeida",  nickname:"Ruivo",    isGoalkeeper:false },
  { id:"p9",  cipa:"0123456", shirtNumber:15, firstName:"Tiago",   lastName:"Nunes",    nickname:"Tiguinho", isGoalkeeper:false },
  { id:"p10", cipa:"1234560", shirtNumber:17, firstName:"Luís",    lastName:"Cardoso",  nickname:"Cardo",    isGoalkeeper:false },
];

const INITIAL_SESSIONS: TrainingSession[] = [
  { id:"s1", date:"2026-07-21", startTime:"19:00", endTime:"21:00", location:"Pavilhão Municipal",
    blocks: mkBlocks([10,20,25,15,20,25,10,5,10]),
    blockNotes: {...mkNotes(), activation:"Corrida ligeira + mobilização articular. Foco nos tornozelos.", gameSituations:"3x3 com GR. Transições rápidas."} },
  { id:"s2", date:"2026-07-23", startTime:"19:00", endTime:"21:00", location:"Pavilhão Municipal",
    blocks: mkBlocks([10,30,20,20,25,30,0,5,5]),
    blockNotes: {...mkNotes(), individualTech:"Trabalho de passe a uma mão. Séries de 3x10 rep.", collectiveTactics:"Bloco defensivo 6-0 com saída a pressionar."} },
  { id:"s3", date:"2026-07-16", startTime:"19:30", endTime:"21:30", location:"Pavilhão Desportivo Norte",
    blocks: mkBlocks([15,25,20,10,20,30,15,10,10]), blockNotes: mkNotes() },
  { id:"s4", date:"2026-07-14", startTime:"19:00", endTime:"21:00", location:"Pavilhão Municipal",
    blocks: mkBlocks([10,15,30,20,25,20,0,10,5]), blockNotes: mkNotes() },
];

function mkA(sid:string,p:string[],a:string[],j:string[],l:string[]): AttendanceRecord[] { return [
  ...p.map(id=>({sessionId:sid,playerId:id,status:"present" as AttendanceStatus})),
  ...a.map(id=>({sessionId:sid,playerId:id,status:"absent"  as AttendanceStatus})),
  ...j.map(id=>({sessionId:sid,playerId:id,status:"justified" as AttendanceStatus})),
  ...l.map(id=>({sessionId:sid,playerId:id,status:"injured" as AttendanceStatus})),
];}

const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  ...mkA("s1",["p1","p3","p4","p5","p6","p7","p8","p10"],["p2"],[],["p9"]),
  ...mkA("s2",["p1","p2","p3","p5","p6","p8","p9","p10"],["p7"],["p4"],[]),
  ...mkA("s3",["p1","p2","p4","p5","p6","p7","p9","p10"],["p3"],[],["p8"]),
  ...mkA("s4",["p1","p2","p3","p4","p6","p8","p9","p10"],[],["p5"],["p7"]),
];

const INITIAL_GAMES: Game[] = [
  { id:"g1", date:"2026-07-19", time:"15:00", location:"Pavilhão Municipal", opponent:"SC Braga", isHome:true, result:"28-24",
    scorers:[{playerId:"p5",minute:8},{playerId:"p6",minute:12},{playerId:"p8",minute:15},{playerId:"p5",minute:22},{playerId:"p7",minute:28},{playerId:"p6",minute:35},{playerId:"p4",minute:41},{playerId:"p5",minute:45}],
    goalsConceded:[{playerId:"p1",minute:10},{playerId:"p1",minute:18},{playerId:"p1",minute:30},{playerId:"p2",minute:42}] },
  { id:"g2", date:"2026-07-12", time:"11:00", location:"Pavilhão Norte Porto", opponent:"FC Porto", isHome:false, result:"22-27",
    scorers:[{playerId:"p5",minute:5},{playerId:"p6",minute:9},{playerId:"p3",minute:20},{playerId:"p8",minute:33},{playerId:"p10",minute:40}],
    goalsConceded:[{playerId:"p2",minute:7},{playerId:"p2",minute:14},{playerId:"p1",minute:25},{playerId:"p1",minute:30},{playerId:"p1",minute:42}] },
];

// ── Shared UI ──────────────────────────────────────────────────────────────────

function PageHeader({ title, onBack, action }: { title: string; onBack?: ()=>void; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/60 flex-shrink-0">
      {onBack && (
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-secondary active:bg-secondary/80 transition-colors">
          <ChevronLeft size={22} />
        </button>
      )}
      <h1 className="font-bold flex-1 tracking-wide" style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.15rem",letterSpacing:"0.04em"}}>
        {title.toUpperCase()}
      </h1>
      {action}
    </div>
  );
}

// ── CalendarGrid ───────────────────────────────────────────────────────────────

function CalendarGrid({ year, month, selected, marked, onSelect }: {
  year:number; month:number; selected:string;
  marked:Set<string>; onSelect:(d:string)=>void;
}) {
  const days = new Date(year,month+1,0).getDate();
  const first = new Date(year,month,1).getDay();
  const cells: (number|null)[] = [...Array(first).fill(null), ...Array.from({length:days},(_,i)=>i+1)];

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_PT.map((d,i) => (
          <div key={i} className="text-center text-[11px] text-muted-foreground font-semibold py-2 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day,i) => {
          if (!day) return <div key={i}/>;
          const date=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isSel=date===selected, isToday=date===TODAY, hasMark=marked.has(date);
          return (
            <button key={i} onClick={()=>onSelect(date)}
              className={`relative h-11 w-full rounded-xl text-sm font-semibold transition-all active:scale-95
                ${isSel?"bg-primary text-white shadow-lg":isToday?"bg-primary/20 text-primary":"hover:bg-secondary text-foreground"}`}>
              {day}
              {hasMark && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSel?"bg-white/70":"bg-primary"}`}/>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page: Home ─────────────────────────────────────────────────────────────────

function HomePage({ sessions, players, attendance, games, push }: {
  sessions:TrainingSession[]; players:Player[];
  attendance:AttendanceRecord[]; games:Game[];
  push:(p:Page)=>void;
}) {
  const totalMin = sessions.reduce((s,x)=>s+totalBlockMin(x),0);
  const gStats = useMemo(()=>{ let w=0,l=0,d=0; for(const g of games){ if(!g.result) continue; const[a,b]=g.result.split("-").map(Number); const my=g.isHome?a:b,op=g.isHome?b:a; if(my>op)w++;else if(my<op)l++;else d++; } return{w,l,d}; },[games]);
  const totalPresent = attendance.filter(r=>r.status==="present").length;
  const avgPresence = sessions.length>0 ? (totalPresent/sessions.length).toFixed(1) : "—";

  const cards = [
    { page:{id:"training-cal"} as Page, icon:Activity, label:"Unidade de Treino", sub:`${sessions.length} treinos registados`, color:"#f97316", bg:"rgba(249,115,22,0.13)" },
    { page:{id:"attendance-sessions"} as Page, icon:Users, label:"Presenças", sub:`${players.length} jogadores · média ${avgPresence}`, color:"#60a5fa", bg:"rgba(96,165,250,0.13)" },
    { page:{id:"dashboard"} as Page, icon:BarChart3, label:"Dashboard", sub:`${Math.floor(totalMin/60)}h ${totalMin%60}min de treino`, color:"#34d399", bg:"rgba(52,211,153,0.13)" },
    { page:{id:"games-list"} as Page, icon:Trophy, label:"Jogos", sub:`${games.length} jogos · ${gStats.w}V ${gStats.d}E ${gStats.l}D`, color:"#fbbf24", bg:"rgba(251,191,36,0.13)" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col p-5 pb-10">
      {/* Hero */}
      <div className="pt-10 pb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Época 2026/27</p>
          <h1 className="text-4xl font-black" style={{fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.02em"}}>AndebolPro</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de Equipa</p>
        </div>
        <ImageWithFallback
          src={clubLogo}
          alt="FC Infesta"
          className="w-28 h-28 object-contain flex-shrink-0"
        />
      </div>

      {/* Vertical list */}
      <div className="flex flex-col gap-2 flex-1">
        {cards.map((c,i) => {
          const Icon = c.icon;
          return (
            <button key={i} onClick={()=>push(c.page)}
              className="w-full bg-card border border-border rounded-2xl flex items-center gap-4 px-4 active:scale-[0.98] active:bg-secondary/60 transition-all"
              style={{minHeight:"72px"}}>
              {/* Colored icon */}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor:c.bg}}>
                <Icon size={22} style={{color:c.color}}/>
              </div>
              {/* Labels */}
              <div className="flex-1 text-left py-4">
                <div className="font-bold leading-tight" style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.1rem"}}>{c.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>
              </div>
              {/* Chevron */}
              <ChevronRight size={18} className="text-muted-foreground flex-shrink-0"/>
            </button>
          );
        })}
      </div>

      <p className="text-center text-[10px] text-muted-foreground mt-6 font-mono">{TODAY}</p>
    </div>
  );
}

// ── Page: Training Calendar ────────────────────────────────────────────────────

function TrainingCalPage({ sessions, pop, push }: {
  sessions:TrainingSession[]; pop:()=>void; push:(p:Page)=>void;
}) {
  const now = new Date();
  const [cy,setCY] = useState(now.getFullYear());
  const [cm,setCM] = useState(now.getMonth());
  const [selected,setSelected] = useState(TODAY);
  const dates = useMemo(()=>new Set(sessions.map(s=>s.date)),[sessions]);

  function prevMonth(){ if(cm===0){setCY(y=>y-1);setCM(11);}else setCM(m=>m-1); }
  function nextMonth(){ if(cm===11){setCY(y=>y+1);setCM(0);}else setCM(m=>m+1); }

  const monthSessions = sessions
    .filter(s=>s.date.startsWith(`${cy}-${String(cm+1).padStart(2,"0")}`))
    .sort((a,b)=>a.date.localeCompare(b.date));

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader title="Unidade de Treino" onBack={pop}
        action={
          <button onClick={()=>push({id:"training-detail",date:selected})}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={16}/>
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {/* Calendar */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-secondary transition-colors"><ChevronLeft size={20}/></button>
            <span className="font-bold text-base">{MONTHS_PT[cm]} {cy}</span>
            <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-secondary transition-colors"><ChevronRight size={20}/></button>
          </div>
          <CalendarGrid year={cy} month={cm} selected={selected} marked={dates}
            onSelect={d=>{ setSelected(d); push({id:"training-detail",date:d}); }}/>
        </div>

        {/* Sessions this month */}
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {MONTHS_PT[cm]} — {monthSessions.length} treino{monthSessions.length!==1?"s":""}
          </p>
          {monthSessions.length===0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem treinos este mês</p>
          ) : (
            <div className="space-y-2">
              {monthSessions.map(s=>(
                <button key={s.id} onClick={()=>push({id:"training-detail",date:s.date})}
                  className="w-full bg-card border border-border rounded-xl p-4 text-left flex items-center gap-4 hover:border-primary/30 active:scale-[0.98] transition-all">
                  <div className="w-11 h-11 bg-primary/15 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-primary font-black leading-none" style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.1rem"}}>{s.date.split("-")[2]}</span>
                    <span className="text-primary text-[9px] font-semibold uppercase">{MONTHS_PT[parseInt(s.date.split("-")[1])-1].slice(0,3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{s.startTime} – {s.endTime}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{s.location}</div>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">{totalBlockMin(s)}min</div>
                  <ChevronRight size={16} className="text-muted-foreground flex-shrink-0"/>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page: Training Detail ──────────────────────────────────────────────────────

function TrainingDetailPage({ date, sessions, setSessions, pop }: {
  date:string; sessions:TrainingSession[];
  setSessions:React.Dispatch<React.SetStateAction<TrainingSession[]>>; pop:()=>void;
}) {
  const existing = sessions.find(s=>s.date===date) ?? null;
  const [editing,setEditing] = useState<TrainingSession|null>(null);
  const [isNew,setIsNew] = useState(false);
  const [expandedBlock,setExpandedBlock] = useState<BlockKey|null>(null);

  function startNew(){
    setEditing({id:uid(),date,startTime:"19:00",endTime:"21:00",location:"",blocks:mkBlocks([10,20,20,15,20,25,10,5,10]),blockNotes:mkNotes()});
    setIsNew(true);
  }
  function startEdit(){
    if(!existing) return;
    setEditing({...existing,blocks:{...existing.blocks},blockNotes:{...existing.blockNotes}});
    setIsNew(false);
  }
  function save(){
    if(!editing) return;
    setSessions(prev=>isNew?[...prev,editing]:prev.map(s=>s.id===editing.id?editing:s));
    setEditing(null); setIsNew(false);
  }
  function del(){
    if(!existing) return;
    setSessions(prev=>prev.filter(s=>s.id!==existing.id));
    pop();
  }

  const view = editing ?? existing;
  const blockTotal = view ? totalBlockMin(view) : 0;

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader title={formatDate(date)} onBack={()=>{setEditing(null);pop();}}
        action={
          editing ? (
            <button onClick={save} className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold">
              <Save size={15}/> Guardar
            </button>
          ) : existing ? (
            <div className="flex gap-2">
              <button onClick={startEdit} className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"><Edit2 size={17}/></button>
              <button onClick={del} className="p-2 rounded-xl text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"><Trash2 size={17}/></button>
            </div>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!view && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
              <Activity size={28} className="text-muted-foreground opacity-40"/>
            </div>
            <p className="text-muted-foreground text-center">Sem treino neste dia</p>
            <button onClick={startNew} className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
              <Plus size={18}/> Criar Treino
            </button>
          </div>
        )}

        {view && (
          <>
            {/* Info card */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Informações</p>
              <div className="grid grid-cols-2 gap-4">
                {([["Hora de Início","startTime","time"],["Hora de Fim","endTime","time"]] as const).map(([label,field,type])=>(
                  <div key={field}>
                    <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
                    {editing ? (
                      <input type={type} value={editing[field]}
                        onChange={e=>setEditing(p=>p&&({...p,[field]:e.target.value}))}
                        className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm w-full text-foreground"/>
                    ) : (
                      <div className="flex items-center gap-2 text-sm font-medium"><Clock size={14} className="text-primary"/>{view[field]}</div>
                    )}
                  </div>
                ))}
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1.5">Local</p>
                  {editing ? (
                    <input type="text" value={editing.location} placeholder="Local do treino"
                      onChange={e=>setEditing(p=>p&&({...p,location:e.target.value}))}
                      className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm w-full text-foreground"/>
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-medium"><MapPin size={14} className="text-primary"/>{view.location||<span className="text-muted-foreground italic">Sem local</span>}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Blocks card */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Blocos de Treino</p>
                <span className="text-xs font-mono text-muted-foreground">{blockTotal} min</span>
              </div>

              {blockTotal>0 && (
                <div className="flex h-2.5 rounded-full overflow-hidden mb-4 gap-0.5">
                  {BLOCK_KEYS.map(key=>{ const val=view.blocks[key]; if(!val) return null;
                    return <div key={key} style={{width:`${(val/blockTotal)*100}%`,backgroundColor:BLOCK_COLORS[key]}} className="rounded-full"/>;
                  })}
                </div>
              )}

              <div className="space-y-1">
                {BLOCK_KEYS.map(key=>{
                  const isExpanded=expandedBlock===key;
                  const note=view.blockNotes?.[key]??"";
                  const hasNote=note.trim().length>0;
                  return (
                    <div key={key} className={`rounded-xl overflow-hidden transition-all ${isExpanded?"bg-secondary/50 border border-border/60":"border border-transparent"}`}>
                      <button type="button" onClick={()=>setExpandedBlock(isExpanded?null:key)}
                        className="w-full flex items-center gap-3 px-3 py-3 text-left">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:BLOCK_COLORS[key]}}/>
                        <span className="text-sm flex-1 font-medium">{BLOCK_LABELS[key]}</span>
                        {hasNote&&!isExpanded&&<span className="w-1.5 h-1.5 rounded-full bg-primary/70 flex-shrink-0"/>}
                        {editing ? (
                          <div className="flex items-center gap-1.5" onClick={e=>e.stopPropagation()}>
                            <input type="number" min={0} max={120} value={editing.blocks[key]}
                              onChange={e=>setEditing(p=>p&&({...p,blocks:{...p.blocks,[key]:parseInt(e.target.value)||0}}))}
                              className="bg-background border border-border rounded-lg px-2 py-1 text-sm w-14 text-right text-foreground"/>
                            <span className="text-xs text-muted-foreground">min</span>
                          </div>
                        ) : (
                          <span className="text-sm tabular-nums text-muted-foreground flex-shrink-0 w-14 text-right">
                            {view.blocks[key]>0?`${view.blocks[key]}m`:"—"}
                          </span>
                        )}
                        <ChevronRight size={14} className={`text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isExpanded?"rotate-90":""}`}/>
                      </button>
                      {isExpanded&&(
                        <div className="px-4 pb-3">
                          <div className="h-px bg-border/50 mb-3"/>
                          {editing ? (
                            <textarea rows={3} autoFocus
                              placeholder={`Detalhes de "${BLOCK_LABELS[key]}"…`}
                              value={editing.blockNotes?.[key]??""}
                              onChange={e=>setEditing(p=>p&&({...p,blockNotes:{...p.blockNotes,[key]:e.target.value}}))}
                              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40 transition-colors"/>
                          ) : (
                            <p className={`text-sm leading-relaxed ${hasNote?"text-foreground":"text-muted-foreground/50 italic"}`}>
                              {hasNote?note:"Sem notas para este bloco."}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page: Attendance Sessions ──────────────────────────────────────────────────

function AttendanceSessionsPage({ sessions, players, pop, push }: {
  sessions:TrainingSession[]; players:Player[]; pop:()=>void; push:(p:Page)=>void;
}) {
  const sorted = [...sessions].sort((a,b)=>b.date.localeCompare(a.date));
  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader title="Presenças" onBack={pop}/>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">{players.length} jogadores registados</p>
        {sorted.map(s=>(
          <button key={s.id} onClick={()=>push({id:"attendance-detail",sessionId:s.id})}
            className="w-full bg-card border border-border rounded-2xl p-4 text-left flex items-center gap-4 hover:border-primary/30 active:scale-[0.98] transition-all">
            <div className="w-12 h-12 bg-primary/15 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-primary font-black leading-none" style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.15rem"}}>{s.date.split("-")[2]}</span>
              <span className="text-primary text-[9px] font-semibold uppercase">{MONTHS_PT[parseInt(s.date.split("-")[1])-1].slice(0,3)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{s.startTime} – {s.endTime}</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">{s.location}</div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0"/>
          </button>
        ))}
        {sorted.length===0&&<p className="text-sm text-muted-foreground text-center py-16">Sem sessões registadas</p>}
      </div>
    </div>
  );
}

// ── Page: Attendance Detail ────────────────────────────────────────────────────

const STATUS_CFG = {
  present:   {label:"Presente",    short:"P", color:"text-emerald-400", activeBg:"bg-emerald-400/20 border-emerald-400/50"},
  absent:    {label:"Ausente",     short:"A", color:"text-red-400",     activeBg:"bg-red-400/20 border-red-400/50"},
  justified: {label:"Justificado", short:"J", color:"text-yellow-400",  activeBg:"bg-yellow-400/20 border-yellow-400/50"},
  injured:   {label:"Lesionado",   short:"L", color:"text-orange-400",  activeBg:"bg-orange-400/20 border-orange-400/50"},
} as const;

function AttendanceDetailPage({ sessionId, sessions, players, setPlayers, attendance, setAttendance, pop }: {
  sessionId:string; sessions:TrainingSession[]; players:Player[];
  setPlayers:React.Dispatch<React.SetStateAction<Player[]>>;
  attendance:AttendanceRecord[];
  setAttendance:React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  pop:()=>void;
}) {
  const session = sessions.find(s=>s.id===sessionId);
  const [showModal,setShowModal] = useState(false);
  const [np,setNp] = useState<Partial<Player>>({});

  function getStatus(pid:string){ return attendance.find(r=>r.sessionId===sessionId&&r.playerId===pid)?.status??null; }
  function setStatus(pid:string,status:AttendanceStatus){
    setAttendance(prev=>[...prev.filter(r=>!(r.sessionId===sessionId&&r.playerId===pid)),{sessionId,playerId:pid,status}]);
  }
  function addPlayer(){
    if(!np.firstName||!np.lastName) return;
    setPlayers(prev=>[...prev,{id:uid(),cipa:np.cipa??"",shirtNumber:np.shirtNumber??0,firstName:np.firstName!,lastName:np.lastName!,nickname:np.nickname??"",isGoalkeeper:np.isGoalkeeper??false}]);
    setNp({}); setShowModal(false);
  }

  const counts = useMemo(()=>{
    const c={present:0,absent:0,justified:0,injured:0};
    for(const p of players){ const s=getStatus(p.id); if(s) c[s]++; }
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[players,sessionId,attendance]);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader title={session?formatDate(session.date):"Presenças"} onBack={pop}
        action={
          <button onClick={()=>setShowModal(true)}
            className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
            <Plus size={18}/>
          </button>
        }
      />

      {/* Summary */}
      {session&&(
        <div className="px-4 pt-3 pb-0">
          <p className="text-xs text-muted-foreground mb-2">{session.location}</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {(["present","absent","justified","injured"] as AttendanceStatus[]).map(s=>{
              const cfg=STATUS_CFG[s];
              return (
                <div key={s} className="bg-card border border-border rounded-xl p-2.5 text-center">
                  <div className={`text-xl font-black ${cfg.color}`} style={{fontFamily:"'Barlow Condensed',sans-serif"}}>{counts[s]}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{cfg.short}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Player list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {[...players].sort((a,b)=>a.shirtNumber-b.shirtNumber).map(p=>{
          const status=getStatus(p.id);
          return (
            <div key={p.id} className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="font-black text-sm text-muted-foreground" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>{p.shirtNumber}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{p.firstName} {p.lastName}</div>
                <div className="text-xs text-muted-foreground">&#34;{p.nickname}&#34;{p.isGoalkeeper?" · GR":""}</div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {(["present","absent","justified","injured"] as AttendanceStatus[]).map(s=>{
                  const cfg=STATUS_CFG[s];
                  return (
                    <button key={s} onClick={()=>setStatus(p.id,s)} title={cfg.label}
                      className={`w-9 h-9 rounded-lg text-xs font-black border transition-all active:scale-90 ${status===s?`${cfg.activeBg} ${cfg.color}`:"border-border text-muted-foreground hover:border-muted-foreground"}`}>
                      {cfg.short}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add player modal */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/75 flex items-end justify-center z-50" onClick={()=>setShowModal(false)}>
          <div className="bg-card border border-border rounded-t-3xl p-6 w-full max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>Adicionar Jogador</h3>
              <button onClick={()=>setShowModal(false)}><X size={20}/></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1.5">Primeiro Nome *</label>
                  <input className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground" value={np.firstName??""} onChange={e=>setNp(p=>({...p,firstName:e.target.value}))}/></div>
                <div><label className="text-xs text-muted-foreground block mb-1.5">Último Nome *</label>
                  <input className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground" value={np.lastName??""} onChange={e=>setNp(p=>({...p,lastName:e.target.value}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1.5">Alcunha</label>
                  <input className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground" value={np.nickname??""} onChange={e=>setNp(p=>({...p,nickname:e.target.value}))}/></div>
                <div><label className="text-xs text-muted-foreground block mb-1.5">N.º Camisola</label>
                  <input type="number" className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground" value={np.shirtNumber??""} onChange={e=>setNp(p=>({...p,shirtNumber:parseInt(e.target.value)}))}/></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1.5">CIPA</label>
                <input className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground" value={np.cipa??""} onChange={e=>setNp(p=>({...p,cipa:e.target.value}))}/></div>
              <label className="flex items-center gap-3 text-sm cursor-pointer py-1">
                <input type="checkbox" checked={np.isGoalkeeper??false} onChange={e=>setNp(p=>({...p,isGoalkeeper:e.target.checked}))} className="w-5 h-5 accent-primary rounded"/>
                Guarda-Redes
              </label>
            </div>
            <button onClick={addPlayer} className="w-full mt-5 bg-primary text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-primary/90 transition-colors">
              Adicionar Jogador
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page: Dashboard ────────────────────────────────────────────────────────────

function DashboardPage({ sessions, players, attendance, games, pop }: {
  sessions:TrainingSession[]; players:Player[];
  attendance:AttendanceRecord[]; games:Game[]; pop:()=>void;
}) {
  const totalMin = useMemo(()=>sessions.reduce((s,x)=>s+totalBlockMin(x),0),[sessions]);
  const blockChart = useMemo(()=>BLOCK_KEYS.map(k=>({
    name:BLOCK_LABELS[k].split(" ").slice(-1)[0], fullName:BLOCK_LABELS[k],
    minutes:sessions.reduce((s,x)=>s+x.blocks[k],0), fill:BLOCK_COLORS[k],
  })).filter(d=>d.minutes>0),[sessions]);

  const attStats = useMemo(()=>{
    const c={present:0,absent:0,justified:0,injured:0};
    for(const r of attendance) c[r.status]++;
    const n=sessions.length||1;
    return{c,avgP:(c.present/n).toFixed(1),avgA:(c.absent/n).toFixed(1),avgJ:(c.justified/n).toFixed(1),avgL:(c.injured/n).toFixed(1)};
  },[attendance,sessions]);

  const pieData=[
    {name:"Presente",value:attStats.c.present,fill:"#34d399"},
    {name:"Ausente",value:attStats.c.absent,fill:"#f87171"},
    {name:"Justificado",value:attStats.c.justified,fill:"#fbbf24"},
    {name:"Lesionado",value:attStats.c.injured,fill:"#fb923c"},
  ].filter(d=>d.value>0);

  const gStats=useMemo(()=>{let w=0,l=0,d=0;for(const g of games){if(!g.result)continue;const[a,b]=g.result.split("-").map(Number);const my=g.isHome?a:b,op=g.isHome?b:a;if(my>op)w++;else if(my<op)l++;else d++;}return{w,l,d};},[games]);

  const topScorers=useMemo(()=>{
    const map:Record<string,number>={};
    for(const g of games)for(const s of g.scorers)map[s.playerId]=(map[s.playerId]??0)+1;
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,goals])=>({player:players.find(p=>p.id===id),goals})).filter(x=>x.player);
  },[games,players]);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader title="Dashboard" onBack={pop}/>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {label:"Treinos",      value:sessions.length,    sub:"registados",        color:"text-primary"},
            {label:"Horas Treino", value:`${Math.floor(totalMin/60)}h${totalMin%60?""+totalMin%60+"m":""}`, sub:`${totalMin} minutos`, color:"text-blue-400"},
            {label:"Média Pres.",  value:attStats.avgP,      sub:"por sessão",        color:"text-emerald-400"},
            {label:"Jogos",        value:games.length,       sub:`${gStats.w}V ${gStats.d}E ${gStats.l}D`, color:"text-yellow-400"},
          ].map(c=>(
            <div key={c.label} className="bg-card border border-border rounded-2xl p-4">
              <div className={`text-4xl font-black ${c.color}`} style={{fontFamily:"'Barlow Condensed',sans-serif"}}>{c.value}</div>
              <div className="text-sm font-semibold mt-1">{c.label}</div>
              <div className="text-xs text-muted-foreground">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Block chart */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Tempo por Bloco (min acumulado)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={blockChart} margin={{top:0,right:0,left:-28,bottom:40}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="name" tick={{fill:"#8b949e",fontSize:9}} angle={-40} textAnchor="end" interval={0}/>
              <YAxis tick={{fill:"#8b949e",fontSize:9}}/>
              <Tooltip contentStyle={{backgroundColor:"#161b22",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"#e6edf3",fontSize:"11px"}}
                formatter={(val:number,_:string,props:{payload?:{fullName?:string}})=>[`${val} min`,props.payload?.fullName??""]}/>
              <Bar dataKey="minutes" radius={[4,4,0,0]}>{blockChart.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Attendance pie */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Presenças</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                {pieData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
              </Pie>
              <Tooltip contentStyle={{backgroundColor:"#161b22",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"#e6edf3",fontSize:"11px"}}/>
              <Legend iconSize={8} iconType="circle" wrapperStyle={{fontSize:"11px",color:"#8b949e"}}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border">
            {[{l:"Pres.",v:attStats.avgP,c:"text-emerald-400"},{l:"Aus.",v:attStats.avgA,c:"text-red-400"},{l:"Just.",v:attStats.avgJ,c:"text-yellow-400"},{l:"Les.",v:attStats.avgL,c:"text-orange-400"}].map(x=>(
              <div key={x.l} className="text-center">
                <div className={`text-lg font-black ${x.c}`} style={{fontFamily:"'Barlow Condensed',sans-serif"}}>{x.v}</div>
                <div className="text-[10px] text-muted-foreground">{x.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top scorers */}
        {topScorers.length>0&&(
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Melhores Marcadores</p>
            <div className="space-y-2.5">
              {topScorers.map(({player,goals},i)=>(
                <div key={player!.id} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-4">{i+1}</span>
                  <span className="w-7 h-7 rounded-lg bg-primary/20 text-primary text-xs font-black flex items-center justify-center" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>{player!.shirtNumber}</span>
                  <span className="text-sm flex-1 font-medium">{player!.firstName} {player!.lastName}</span>
                  <span className="bg-primary/20 text-primary text-xs font-mono px-2 py-0.5 rounded-lg font-bold">{goals}G</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page: Games List ───────────────────────────────────────────────────────────

const OUTCOME={
  win: {label:"V",cls:"bg-emerald-400/20 text-emerald-400 border-emerald-400/30"},
  loss:{label:"D",cls:"bg-red-400/20 text-red-400 border-red-400/30"},
  draw:{label:"E",cls:"bg-yellow-400/20 text-yellow-400 border-yellow-400/30"},
};

function GamesListPage({ games, setGames, players, pop, push }: {
  games:Game[]; setGames:React.Dispatch<React.SetStateAction<Game[]>>;
  players:Player[]; pop:()=>void; push:(p:Page)=>void;
}) {
  const [showModal,setShowModal] = useState(false);
  const [form,setForm] = useState<Game>({id:"",date:TODAY,time:"15:00",location:"",opponent:"",isHome:true,result:"",scorers:[],goalsConceded:[]});
  const [scorerPid,setScorerPid]=useState(""); const [scorerMin,setScorerMin]=useState("");
  const [gkPid,setGkPid]=useState(""); const [gkMin,setGkMin]=useState("");
  const gks=players.filter(p=>p.isGoalkeeper);

  function openNew(){ setForm({id:uid(),date:TODAY,time:"15:00",location:"",opponent:"",isHome:true,result:"",scorers:[],goalsConceded:[]}); setScorerPid("");setScorerMin("");setGkPid("");setGkMin(""); setShowModal(true); }
  function addScorer(){ if(!scorerPid)return; setForm(f=>({...f,scorers:[...f.scorers,{playerId:scorerPid,minute:parseInt(scorerMin)||0}]})); setScorerPid("");setScorerMin(""); }
  function addGK(){ if(!gkPid)return; setForm(f=>({...f,goalsConceded:[...f.goalsConceded,{playerId:gkPid,minute:parseInt(gkMin)||0}]})); setGkPid("");setGkMin(""); }
  function saveGame(){ if(!form.date||!form.opponent)return; setGames(prev=>[...prev,form]); setShowModal(false); }

  const sorted=[...games].sort((a,b)=>b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader title="Jogos" onBack={pop}
        action={
          <button onClick={openNew} className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={16}/>
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sorted.map(g=>{
          const out=gameOutcome(g);
          return (
            <button key={g.id} onClick={()=>push({id:"games-detail",gameId:g.id})}
              className="w-full bg-card border border-border rounded-2xl p-4 text-left flex items-center gap-4 hover:border-primary/30 active:scale-[0.98] transition-all">
              <div className="w-12 h-12 bg-secondary rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                <span className="font-black leading-none" style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.15rem"}}>{g.date.split("-")[2]}</span>
                <span className="text-muted-foreground text-[9px] font-semibold uppercase">{MONTHS_PT[parseInt(g.date.split("-")[1])-1].slice(0,3)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{g.opponent}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{g.isHome?"Casa":"Fora"} · {g.time}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                {g.result&&<span className="font-mono font-black text-base">{g.result}</span>}
                {out&&<span className={`text-xs px-2 py-0.5 rounded-lg border font-bold ${OUTCOME[out].cls}`}>{OUTCOME[out].label}</span>}
              </div>
              <ChevronRight size={16} className="text-muted-foreground flex-shrink-0"/>
            </button>
          );
        })}
        {sorted.length===0&&<p className="text-sm text-muted-foreground text-center py-16">Sem jogos registados</p>}
      </div>

      {/* New game modal (bottom sheet) */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/75 flex items-end justify-center z-50" onClick={()=>setShowModal(false)}>
          <div className="bg-card border border-border rounded-t-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-bold text-lg" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>Novo Jogo</h3>
              <button onClick={()=>setShowModal(false)}><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1.5">Data</label>
                  <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground"/></div>
                <div><label className="text-xs text-muted-foreground block mb-1.5">Hora</label>
                  <input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground"/></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1.5">Adversário *</label>
                <input value={form.opponent} onChange={e=>setForm(f=>({...f,opponent:e.target.value}))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground"/></div>
              <div><label className="text-xs text-muted-foreground block mb-1.5">Local</label>
                <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground"/></div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Campo</span>
                {([{v:true,l:"Casa"},{v:false,l:"Fora"}] as const).map(o=>(
                  <button key={String(o.v)} onClick={()=>setForm(f=>({...f,isHome:o.v}))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${form.isHome===o.v?"bg-primary/20 text-primary border-primary/40":"border-border text-muted-foreground"}`}>
                    {o.l}
                  </button>
                ))}
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1.5">Resultado</label>
                <input placeholder="28-24" value={form.result} onChange={e=>setForm(f=>({...f,result:e.target.value}))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full font-mono text-foreground"/></div>

              <div>
                <label className="text-xs text-muted-foreground block mb-2">Marcadores</label>
                <div className="flex gap-2 mb-2">
                  <select value={scorerPid} onChange={e=>setScorerPid(e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm flex-1 text-foreground">
                    <option value="">Jogador</option>
                    {players.filter(p=>!p.isGoalkeeper).map(p=><option key={p.id} value={p.id}>{p.shirtNumber} - {p.firstName}</option>)}
                  </select>
                  <input type="number" placeholder="min" value={scorerMin} onChange={e=>setScorerMin(e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm w-16 text-foreground"/>
                  <button onClick={addScorer} className="bg-primary text-white px-3 py-2 rounded-xl text-sm font-bold">+</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.scorers.map((s,i)=>{ const p=players.find(x=>x.id===s.playerId); return (
                    <span key={i} className="flex items-center gap-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs">
                      {s.minute}&apos; {p?.nickname??p?.firstName}
                      <button onClick={()=>setForm(f=>({...f,scorers:f.scorers.filter((_,j)=>j!==i)}))}><X size={10}/></button>
                    </span>
                  );})}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-2">Golos Sofridos (GR)</label>
                <div className="flex gap-2 mb-2">
                  <select value={gkPid} onChange={e=>setGkPid(e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm flex-1 text-foreground">
                    <option value="">Guarda-Redes</option>
                    {gks.map(p=><option key={p.id} value={p.id}>{p.shirtNumber} - {p.firstName}</option>)}
                  </select>
                  <input type="number" placeholder="min" value={gkMin} onChange={e=>setGkMin(e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm w-16 text-foreground"/>
                  <button onClick={addGK} className="bg-secondary border border-border px-3 py-2 rounded-xl text-sm font-bold">+</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.goalsConceded.map((s,i)=>{ const p=players.find(x=>x.id===s.playerId); return (
                    <span key={i} className="flex items-center gap-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs">
                      {s.minute}&apos; {p?.nickname} [GR]
                      <button onClick={()=>setForm(f=>({...f,goalsConceded:f.goalsConceded.filter((_,j)=>j!==i)}))}><X size={10}/></button>
                    </span>
                  );})}
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              <button onClick={saveGame} className="w-full bg-primary text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-primary/90 transition-colors">
                Guardar Jogo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page: Game Detail ──────────────────────────────────────────────────────────

function GamesDetailPage({ gameId, games, setGames, players, pop }: {
  gameId:string; games:Game[]; setGames:React.Dispatch<React.SetStateAction<Game[]>>; players:Player[]; pop:()=>void;
}) {
  const game = games.find(g=>g.id===gameId);
  const [showEdit,setShowEdit]=useState(false);
  const [form,setForm]=useState<Game>(game??{id:"",date:TODAY,time:"",location:"",opponent:"",isHome:true,result:"",scorers:[],goalsConceded:[]});
  const [scorerPid,setScorerPid]=useState(""); const [scorerMin,setScorerMin]=useState("");
  const [gkPid,setGkPid]=useState(""); const [gkMin,setGkMin]=useState("");
  const gks=players.filter(p=>p.isGoalkeeper);

  function openEdit(){ setForm(game?{...game}:form); setScorerPid("");setScorerMin("");setGkPid("");setGkMin(""); setShowEdit(true); }
  function addScorer(){ if(!scorerPid)return; setForm(f=>({...f,scorers:[...f.scorers,{playerId:scorerPid,minute:parseInt(scorerMin)||0}]})); setScorerPid("");setScorerMin(""); }
  function addGK(){ if(!gkPid)return; setForm(f=>({...f,goalsConceded:[...f.goalsConceded,{playerId:gkPid,minute:parseInt(gkMin)||0}]})); setGkPid("");setGkMin(""); }
  function saveEdit(){ setGames(prev=>prev.map(g=>g.id===form.id?form:g)); setShowEdit(false); }
  function del(){ setGames(prev=>prev.filter(g=>g.id!==gameId)); pop(); }

  if(!game) return <div className="flex-1 flex items-center justify-center text-muted-foreground"><p>Jogo não encontrado</p></div>;

  const out=gameOutcome(game);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader title={`vs. ${game.opponent}`} onBack={pop}
        action={
          <div className="flex gap-2">
            <button onClick={openEdit} className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"><Edit2 size={17}/></button>
            <button onClick={del} className="p-2 rounded-xl text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"><Trash2 size={17}/></button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Meta */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground">{formatDate(game.date)} · {game.time}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={11}/>{game.location}</span>
          <span className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${game.isHome?"bg-blue-400/20 text-blue-400 border-blue-400/30":"bg-secondary text-muted-foreground border-border"}`}>
            {game.isHome?"Casa":"Fora"}
          </span>
        </div>

        {/* Score */}
        {game.result&&(
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="text-7xl font-black tabular-nums" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>{game.result}</div>
            {out&&(
              <div className={`inline-block mt-3 px-5 py-1.5 rounded-full text-sm font-bold border ${OUTCOME[out].cls}`}>
                {out==="win"?"Vitória":out==="loss"?"Derrota":"Empate"}
              </div>
            )}
          </div>
        )}

        {/* Scorers */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Marcadores ({game.scorers.length})</p>
          {game.scorers.length===0?<p className="text-sm text-muted-foreground">—</p>:(
            <div className="space-y-2">
              {game.scorers.map((s,i)=>{ const p=players.find(x=>x.id===s.playerId); return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-primary font-mono text-xs w-8 text-right font-bold">{s.minute}&apos;</span>
                  <span className="w-7 h-7 bg-primary/15 rounded-lg flex items-center justify-center text-xs font-black text-primary" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>{p?.shirtNumber}</span>
                  <span className="text-sm font-medium">{p?`${p.firstName} ${p.lastName}`:"—"}</span>
                </div>
              );})}
            </div>
          )}
        </div>

        {/* Goals conceded */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Golos Sofridos ({game.goalsConceded.length})</p>
          {game.goalsConceded.length===0?<p className="text-sm text-muted-foreground">—</p>:(
            <div className="space-y-2">
              {game.goalsConceded.map((s,i)=>{ const p=players.find(x=>x.id===s.playerId); return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-muted-foreground font-mono text-xs w-8 text-right">{s.minute}&apos;</span>
                  <span className="w-7 h-7 bg-blue-400/15 rounded-lg flex items-center justify-center text-xs font-black text-blue-400" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>{p?.shirtNumber}</span>
                  <span className="text-sm font-medium">{p?`${p.firstName} ${p.lastName}`:"—"}</span>
                  <span className="text-[10px] text-primary font-bold">GR</span>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {showEdit&&(
        <div className="fixed inset-0 bg-black/75 flex items-end justify-center z-50" onClick={()=>setShowEdit(false)}>
          <div className="bg-card border border-border rounded-t-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-bold text-lg" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>Editar Jogo</h3>
              <button onClick={()=>setShowEdit(false)}><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1.5">Data</label>
                  <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground"/></div>
                <div><label className="text-xs text-muted-foreground block mb-1.5">Hora</label>
                  <input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground"/></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1.5">Adversário</label>
                <input value={form.opponent} onChange={e=>setForm(f=>({...f,opponent:e.target.value}))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground"/></div>
              <div><label className="text-xs text-muted-foreground block mb-1.5">Local</label>
                <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full text-foreground"/></div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Campo</span>
                {([{v:true,l:"Casa"},{v:false,l:"Fora"}] as const).map(o=>(
                  <button key={String(o.v)} onClick={()=>setForm(f=>({...f,isHome:o.v}))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${form.isHome===o.v?"bg-primary/20 text-primary border-primary/40":"border-border text-muted-foreground"}`}>
                    {o.l}
                  </button>
                ))}
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1.5">Resultado</label>
                <input placeholder="28-24" value={form.result} onChange={e=>setForm(f=>({...f,result:e.target.value}))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm w-full font-mono text-foreground"/></div>

              <div>
                <label className="text-xs text-muted-foreground block mb-2">Marcadores</label>
                <div className="flex gap-2 mb-2">
                  <select value={scorerPid} onChange={e=>setScorerPid(e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm flex-1 text-foreground">
                    <option value="">Jogador</option>
                    {players.filter(p=>!p.isGoalkeeper).map(p=><option key={p.id} value={p.id}>{p.shirtNumber} - {p.firstName}</option>)}
                  </select>
                  <input type="number" placeholder="min" value={scorerMin} onChange={e=>setScorerMin(e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm w-16 text-foreground"/>
                  <button onClick={addScorer} className="bg-primary text-white px-3 py-2 rounded-xl text-sm font-bold">+</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.scorers.map((s,i)=>{ const p=players.find(x=>x.id===s.playerId); return (
                    <span key={i} className="flex items-center gap-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs">
                      {s.minute}&apos; {p?.nickname??p?.firstName}
                      <button onClick={()=>setForm(f=>({...f,scorers:f.scorers.filter((_,j)=>j!==i)}))}><X size={10}/></button>
                    </span>
                  );})}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-2">Golos Sofridos (GR)</label>
                <div className="flex gap-2 mb-2">
                  <select value={gkPid} onChange={e=>setGkPid(e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm flex-1 text-foreground">
                    <option value="">Guarda-Redes</option>
                    {gks.map(p=><option key={p.id} value={p.id}>{p.shirtNumber} - {p.firstName}</option>)}
                  </select>
                  <input type="number" placeholder="min" value={gkMin} onChange={e=>setGkMin(e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm w-16 text-foreground"/>
                  <button onClick={addGK} className="bg-secondary border border-border px-3 py-2 rounded-xl text-sm font-bold">+</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.goalsConceded.map((s,i)=>{ const p=players.find(x=>x.id===s.playerId); return (
                    <span key={i} className="flex items-center gap-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs">
                      {s.minute}&apos; {p?.nickname} [GR]
                      <button onClick={()=>setForm(f=>({...f,goalsConceded:f.goalsConceded.filter((_,j)=>j!==i)}))}><X size={10}/></button>
                    </span>
                  );})}
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              <button onClick={saveEdit} className="w-full bg-primary text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-primary/90 transition-colors">
                Guardar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [stack,setStack]           = useState<Page[]>([{id:"home"}]);
  const [sessions,setSessions]     = useState<TrainingSession[]>(INITIAL_SESSIONS);
  const [players,setPlayers]       = useState<Player[]>(INITIAL_PLAYERS);
  const [attendance,setAttendance] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
  const [games,setGames]           = useState<Game[]>(INITIAL_GAMES);
  const [loading,setLoading]       = useState(true);
  const initialized                = useRef(false);

  // Load data on mount
  useEffect(() => {
    async function load() {
      try {
        const [s,p,a,g] = await Promise.all([
          apiFetch("/sessions"),
          apiFetch("/players"),
          apiFetch("/attendance"),
          apiFetch("/games"),
        ]);
        setSessions(Array.isArray(s) ? s : INITIAL_SESSIONS);
        setPlayers(Array.isArray(p) ? p : INITIAL_PLAYERS);
        setAttendance(Array.isArray(a) ? a : INITIAL_ATTENDANCE);
        setGames(Array.isArray(g) ? g : INITIAL_GAMES);
        // Seed DB if empty
        if (!Array.isArray(s)) apiSave("/sessions",   INITIAL_SESSIONS);
        if (!Array.isArray(p)) apiSave("/players",    INITIAL_PLAYERS);
        if (!Array.isArray(a)) apiSave("/attendance", INITIAL_ATTENDANCE);
        if (!Array.isArray(g)) apiSave("/games",      INITIAL_GAMES);
      } catch {
        setSessions(INITIAL_SESSIONS);
        setPlayers(INITIAL_PLAYERS);
        setAttendance(INITIAL_ATTENDANCE);
        setGames(INITIAL_GAMES);
      } finally {
        initialized.current = true;
        setLoading(false);
      }
    }
    load();
  }, []);

  // Auto-save whenever data changes
  useEffect(() => { if (initialized.current) apiSave("/sessions",   sessions);   }, [sessions]);
  useEffect(() => { if (initialized.current) apiSave("/players",    players);    }, [players]);
  useEffect(() => { if (initialized.current) apiSave("/attendance", attendance); }, [attendance]);
  useEffect(() => { if (initialized.current) apiSave("/games",      games);      }, [games]);

  const page = stack[stack.length-1];
  const push = (p:Page) => setStack(s=>[...s,p]);
  const pop  = () => setStack(s=>s.length>1?s.slice(0,-1):s);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 mx-auto" style={{boxShadow:"0 0 32px rgba(249,115,22,0.4)",animation:"pulse 2s infinite"}}>
            <span className="text-white font-black text-3xl" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>A</span>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">A carregar dados…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden" style={{fontFamily:"'Inter',sans-serif"}}>
      <div className="flex-1 overflow-hidden">
        {page.id==="home" && (
          <div className="h-full overflow-y-auto">
            <HomePage sessions={sessions} players={players} attendance={attendance} games={games} push={push}/>
          </div>
        )}
        {page.id==="training-cal" && (
          <TrainingCalPage sessions={sessions} pop={pop} push={push}/>
        )}
        {page.id==="training-detail" && (
          <TrainingDetailPage date={page.date} sessions={sessions} setSessions={setSessions} pop={pop}/>
        )}
        {page.id==="attendance-sessions" && (
          <AttendanceSessionsPage sessions={sessions} players={players} pop={pop} push={push}/>
        )}
        {page.id==="attendance-detail" && (
          <AttendanceDetailPage sessionId={page.sessionId} sessions={sessions} players={players} setPlayers={setPlayers} attendance={attendance} setAttendance={setAttendance} pop={pop}/>
        )}
        {page.id==="dashboard" && (
          <DashboardPage sessions={sessions} players={players} attendance={attendance} games={games} pop={pop}/>
        )}
        {page.id==="games-list" && (
          <GamesListPage games={games} setGames={setGames} players={players} pop={pop} push={push}/>
        )}
        {page.id==="games-detail" && (
          <GamesDetailPage gameId={page.gameId} games={games} setGames={setGames} players={players} pop={pop}/>
        )}
      </div>
    </div>
  );
}
