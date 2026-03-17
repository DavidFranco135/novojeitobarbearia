import React, { useState, useMemo } from 'react';
import { UserPlus, Trash2, Edit2, X, Sparkles, Upload, Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBarberStore } from '../store';
import { Professional } from '../types';

// ── ImgBB ─────────────────────────────────────────────────────
const IMGBB_API_KEY = 'da736db48f154b9108b23a36d4393848';
function resizeImage(file: File, maxPx: number, q: number): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const s = Math.min(1, maxPx / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? res(b) : rej(new Error('Falha')), 'image/jpeg', q);
    };
    img.onerror = () => rej(new Error('Erro ao carregar'));
    img.src = url;
  });
}
async function uploadImgBB(file: File): Promise<string> {
  const blob = await resizeImage(file, 800, 0.82);
  const body = new FormData(); body.append('image', blob, 'photo.jpg');
  const r = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j?.error?.message || `Erro ${r.status}`);
  return j.data.display_url as string;
}

// ── Constantes ────────────────────────────────────────────────
const DAYS = [
  { key: 0, label: 'Dom' }, { key: 1, label: 'Seg' }, { key: 2, label: 'Ter' },
  { key: 3, label: 'Qua' }, { key: 4, label: 'Qui' }, { key: 5, label: 'Sex' },
  { key: 6, label: 'Sáb' },
];
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface DaySchedule { active: boolean; start: string; end: string; }
type WeekSchedule = Record<number, DaySchedule>;
const DEFAULT_WEEK: WeekSchedule = {
  0:{active:false,start:'08:00',end:'20:00'},1:{active:true,start:'08:00',end:'20:00'},
  2:{active:true,start:'08:00',end:'20:00'}, 3:{active:true,start:'08:00',end:'20:00'},
  4:{active:true,start:'08:00',end:'20:00'}, 5:{active:true,start:'08:00',end:'20:00'},
  6:{active:true,start:'08:00',end:'20:00'},
};

interface ProfFormData extends Omit<Professional, 'id' | 'likes'> {
  weekSchedule?: WeekSchedule;
  offDays?: string[]; // YYYY-MM-DD folgas pontuais
}

type UploadState = 'idle'|'uploading'|'done'|'error';
type ScheduleTab = 'semana'|'mes';

const pad = (n: number) => String(n).padStart(2,'0');
const toDateStr = (y: number, m: number, d: number) => `${y}-${pad(m+1)}-${pad(d)}`;

// ── Mini-calendário de folgas mensais ─────────────────────────
interface MonthCalProps {
  offDays: string[];
  weekSchedule: WeekSchedule;
  onChange: (days: string[]) => void;
  isDark: boolean;
}
const MonthOffCalendar: React.FC<MonthCalProps> = ({ offDays, weekSchedule, onChange, isDark }) => {
  const now = new Date();
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth());

  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const firstDow    = new Date(vy, vm, 1).getDay();

  const isWeeklyOff   = (day: number) => !weekSchedule[new Date(vy, vm, day).getDay()]?.active;
  const dateStr       = (day: number) => toDateStr(vy, vm, day);
  const isMarked      = (day: number) => offDays.includes(dateStr(day));
  const isPast        = (day: number) => new Date(vy, vm, day) < new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const toggle = (day: number) => {
    if (isWeeklyOff(day) || isPast(day)) return;
    const ds = dateStr(day);
    onChange(isMarked(day) ? offDays.filter(d => d !== ds) : [...offDays, ds]);
  };

  const prevM = () => vm === 0 ? (setVm(11), setVy(y=>y-1)) : setVm(m=>m-1);
  const nextM = () => vm === 11 ? (setVm(0),  setVy(y=>y+1)) : setVm(m=>m+1);

  const markedCount = offDays.filter(d => d.startsWith(`${vy}-${pad(vm+1)}`)).length;

  const cell = (day: number) => {
    const weekly  = isWeeklyOff(day);
    const marked  = isMarked(day);
    const past    = isPast(day);
    const today   = now.getDate() === day && now.getMonth() === vm && now.getFullYear() === vy;

    if (weekly || past) {
      return (
        <div key={day} title={weekly ? 'Folga semanal' : 'Data passada'}
          className={`aspect-square rounded-xl flex items-center justify-center text-[10px] font-bold cursor-not-allowed opacity-30 ${
            weekly ? (isDark ? 'bg-white/5 text-zinc-600' : 'bg-zinc-100 text-zinc-400') : (isDark ? 'text-zinc-700' : 'text-zinc-300')
          }`}>
          {day}
        </div>
      );
    }
    return (
      <button key={day} onClick={() => toggle(day)}
        className={`aspect-square rounded-xl flex items-center justify-center text-[11px] font-black transition-all hover:scale-110 active:scale-95 ${
          marked
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
            : today
              ? isDark ? 'bg-[#C58A4A]/20 text-[#C58A4A] border border-[#C58A4A]/50' : 'bg-amber-100 text-amber-700 border border-amber-300'
              : isDark ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-200 border border-zinc-200'
        }`}>
        {day}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Nav mês */}
      <div className="flex items-center justify-between">
        <button onClick={prevM} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}>
          <ChevronLeft size={16}/>
        </button>
        <div className="text-center">
          <p className={`text-sm font-black ${isDark ? 'text-white':'text-zinc-900'}`}>{MONTHS_FULL[vm]} {vy}</p>
          {markedCount > 0
            ? <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">{markedCount} folha{markedCount>1?'s':''} marcada{markedCount>1?'s':''}</p>
            : <p className={`text-[9px] font-bold ${isDark?'text-zinc-600':'text-zinc-400'}`}>Nenhuma folga extra</p>
          }
        </div>
        <button onClick={nextM} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}>
          <ChevronRight size={16}/>
        </button>
      </div>

      {/* Legenda */}
      <div className={`flex items-center gap-4 flex-wrap text-[8px] font-black uppercase tracking-widest p-3 rounded-2xl ${isDark?'bg-white/[0.03]':'bg-zinc-50'}`}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 inline-block"/><span className={isDark?'text-zinc-400':'text-zinc-500'}>Folga marcada</span></span>
        <span className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded inline-block opacity-30 ${isDark?'bg-white/5':'bg-zinc-200'}`}/><span className={isDark?'text-zinc-400':'text-zinc-500'}>Folga semanal/passado</span></span>
        <span className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded inline-block border ${isDark?'bg-[#C58A4A]/20 border-[#C58A4A]/50':'bg-amber-100 border-amber-300'}`}/><span className={isDark?'text-zinc-400':'text-zinc-500'}>Hoje</span></span>
      </div>

      {/* Cabeçalho dias */}
      <div className="grid grid-cols-7 gap-1">
        {['D','S','T','Q','Q','S','S'].map((d,i)=>(
          <div key={i} className={`text-center text-[9px] font-black uppercase py-1 ${!weekSchedule[i]?.active ? (isDark?'text-zinc-700':'text-zinc-300') : (isDark?'text-zinc-500':'text-zinc-400')}`}>{d}</div>
        ))}
      </div>

      {/* Grid dias */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({length: firstDow}).map((_,i) => <div key={`e${i}`}/>)}
        {Array.from({length: daysInMonth}, (_,i) => cell(i+1))}
      </div>

      {/* Folgas marcadas listadas */}
      {offDays.filter(d => d.startsWith(`${vy}-${pad(vm+1)}`)).length > 0 && (
        <div className={`space-y-1.5 p-3 rounded-2xl border ${isDark?'bg-white/[0.03] border-white/5':'bg-zinc-50 border-zinc-200'}`}>
          <p className={`text-[8px] font-black uppercase tracking-widest mb-2 ${isDark?'text-zinc-500':'text-zinc-400'}`}>Folgas marcadas neste mês</p>
          <div className="flex flex-wrap gap-1.5">
            {offDays.filter(d => d.startsWith(`${vy}-${pad(vm+1)}`)).sort().map(d => {
              const [,, dd] = d.split('-');
              const dow = new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'});
              return (
                <span key={d} className="inline-flex items-center gap-1 bg-red-500/15 text-red-400 border border-red-500/30 text-[9px] font-black px-2 py-0.5 rounded-lg">
                  {dow} {parseInt(dd)}
                  <button onClick={() => onChange(offDays.filter(x=>x!==d))} className="ml-0.5 hover:text-red-200">×</button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────
const Professionals: React.FC = () => {
  const { professionals, addProfessional, updateProfessional, deleteProfessional, appointments, theme } = useBarberStore();

  const [showModal,    setShowModal]    = useState(false);
  const [editingId,    setEditingId]    = useState<string|null>(null);
  const [saving,       setSaving]       = useState(false);
  const [uploadState,  setUploadState]  = useState<UploadState>('idle');
  const [uploadError,  setUploadError]  = useState<string|null>(null);
  const [scheduleTab,  setScheduleTab]  = useState<ScheduleTab>('semana');

  const emptyForm: ProfFormData = {
    name:'', specialties:[], avatar:'https://i.pravatar.cc/150?u=temp',
    commission:50, workingHours:{start:'08:00',end:'20:00'}, description:'', isMaster:false as boolean, masterSurcharge:0, phone:'',
    weekSchedule:{...DEFAULT_WEEK}, offDays:[],
  };
  const [formData, setFormData] = useState<ProfFormData>(emptyForm);

  const isDark    = theme !== 'light';
  const cardClass = isDark ? 'cartao-vidro border-white/5' : 'bg-white border border-zinc-200 shadow-sm';
  const inputCls  = `w-full border p-5 rounded-2xl outline-none font-bold transition-all ${isDark?'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]':'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]'}`;

  // ── Upload foto ───────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value='';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setUploadError('Selecione uma imagem.'); return; }
    if (file.size > 15*1024*1024)       { setUploadError('Máximo 15 MB.'); return; }
    setUploadState('uploading'); setUploadError(null);
    try {
      const url = await uploadImgBB(file);
      setFormData(p=>({...p, avatar:url})); setUploadState('done');
    } catch(err:any) { setUploadError(err.message||'Erro no upload.'); setUploadState('error'); }
  };

  const toggleDay = (day: number) => {
    const ws = {...(formData.weekSchedule||DEFAULT_WEEK)};
    ws[day] = {...ws[day], active:!ws[day].active};
    setFormData(p=>({...p, weekSchedule:ws}));
  };
  const setDayTime = (day:number, f:'start'|'end', v:string) => {
    const ws = {...(formData.weekSchedule||DEFAULT_WEEK)};
    ws[day] = {...ws[day],[f]:v};
    setFormData(p=>({...p, weekSchedule:ws}));
  };

  const handleSave = async () => {
    if (!formData.name) return alert('Preencha o nome.');
    if (uploadState==='uploading') return alert('Aguarde o upload.');
    if (formData.avatar?.startsWith('data:')) { alert('A foto não foi enviada ao ImgBB.'); return; }
    setSaving(true);
    try {
      const active = Object.values(formData.weekSchedule||{}).filter(d=>d.active);
      const start = active.length ? active.reduce((m,d)=>d.start<m?d.start:m,'23:59') : '08:00';
      const end   = active.length ? active.reduce((m,d)=>d.end>m?d.end:m,'00:00')   : '20:00';
      const payload = {...formData, workingHours:{start,end}, offDays:formData.offDays||[]};
      if (editingId) await updateProfessional(editingId, payload);
      else           await addProfessional(payload);
      closeModal();
    } catch(err:any) { alert(`Erro: ${err.message}`); }
    finally { setSaving(false); }
  };

  const closeModal = () => {
    setShowModal(false); setEditingId(null); setFormData(emptyForm);
    setUploadState('idle'); setUploadError(null); setScheduleTab('semana');
  };
  const openEdit = (p: Professional) => {
    const ws:WeekSchedule = (p as any).weekSchedule||{...DEFAULT_WEEK};
    const od:string[]     = (p as any).offDays||[];
    setEditingId(p.id); setFormData({...p, weekSchedule:ws, offDays:od});
    setUploadState('idle'); setUploadError(null); setScheduleTab('semana'); setShowModal(true);
  };

  const getStats = (id:string) => {
    const a = appointments.filter(a=>a.professionalId===id&&a.status==='CONCLUIDO_PAGO');
    return {count:a.length, revenue:a.reduce((s,a)=>s+a.price,0)};
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 h-full overflow-auto pb-24 sm:pb-10 scrollbar-hide">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-black font-display italic tracking-tight ${isDark?'text-white':'text-zinc-900'}`}>PROFISSIONAIS</h1>
          <p className={`text-xs font-black uppercase tracking-widest ${isDark?'text-zinc-500':'text-zinc-500'}`}>Os mestres do estilo.</p>
        </div>
        <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 gradiente-ouro text-black px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
          <UserPlus size={16}/> NOVO BARBEIRO
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {professionals.map(p => {
          const stats = getStats(p.id);
          const ws:WeekSchedule = (p as any).weekSchedule;
          const od:string[]     = (p as any).offDays||[];
          // folgas no mês atual
          const now = new Date();
          const thisMonthKey = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
          const offThisMonth = od.filter(d=>d.startsWith(thisMonthKey)).length;

          return (
            <div key={p.id} className={`rounded-[2.5rem] p-10 group relative overflow-hidden border hover:border-[#C58A4A]/40 transition-all duration-500 ${cardClass}`}>
              <div className="flex items-start justify-between">
                <div className="relative">
                  <img src={p.avatar} className="w-24 h-auto rounded-3xl object-contain border-2 border-white/10 group-hover:border-[#C58A4A]/50 transition-all shadow-2xl block" alt={p.name}/>
                  <div className="absolute -bottom-2 -right-2 bg-[#C58A4A] text-black p-2 rounded-xl shadow-xl"><Sparkles size={14}/></div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={()=>openEdit(p)} className={`p-2.5 rounded-xl transition-all ${isDark?'bg-white/5 hover:bg-white/10 text-zinc-400':'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}><Edit2 size={16}/></button>
                  <button onClick={()=>deleteProfessional(p.id)} className="p-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-500"><Trash2 size={16}/></button>
                </div>
              </div>

              <div className="mt-8">
                <h3 className={`text-2xl font-black font-display italic ${isDark?'text-white':'text-zinc-900'}`}>{p.name}</h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <p className={`text-[10px] uppercase tracking-widest font-black ${isDark?'text-zinc-500':'text-zinc-500'}`}>Mestre Barbeiro · Signature</p>
                  {(p as any).isMaster && (
                    <span className="inline-flex items-center gap-1 bg-[#C58A4A]/20 text-[#C58A4A] border border-[#C58A4A]/40 text-[8px] font-black px-2 py-0.5 rounded-lg uppercase">★ Master{(p as any).masterSurcharge>0?` +R$${(p as any).masterSurcharge}`:''}</span>
                  )}
                  {(p as any).phone && (
                    <span className={`inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-lg border ${isDark?'bg-emerald-500/10 text-emerald-400 border-emerald-500/20':'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      📱 WhatsApp ativo
                    </span>
                  )}
                </div>
              </div>

              {/* Dias da semana ativos */}
              {ws && (
                <div className="mt-5 flex gap-1 flex-wrap">
                  {DAYS.map(d=>(
                    <span key={d.key} className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${ws[d.key]?.active?'bg-[#C58A4A]/20 text-[#C58A4A] border border-[#C58A4A]/30':isDark?'bg-white/5 text-zinc-600 border border-white/5':'bg-zinc-100 text-zinc-400 border border-zinc-200'}`}>
                      {d.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Folgas do mês */}
              {offThisMonth > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>
                  <p className={`text-[9px] font-black uppercase tracking-widest text-red-400`}>
                    {offThisMonth} folga{offThisMonth>1?'s':''} extra{offThisMonth>1?'s':''} em {MONTHS_PT[now.getMonth()]}
                  </p>
                </div>
              )}

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  {label:'Comissão', value:`${p.commission}%`,             color:'text-[#C58A4A]'},
                  {label:'Atend.',   value:stats.count,                    color:isDark?'text-white':'text-zinc-900'},
                  {label:'Receita',  value:`R$${stats.revenue.toFixed(0)}`, color:'text-emerald-500'},
                ].map(item=>(
                  <div key={item.label} className={`p-3 rounded-2xl border ${isDark?'bg-white/5 border-white/5':'bg-zinc-50 border-zinc-200'}`}>
                    <p className={`text-[8px] uppercase font-black tracking-widest mb-1 ${isDark?'text-zinc-500':'text-zinc-500'}`}>{item.label}</p>
                    <p className={`text-sm font-black italic font-display ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL ─────────────────────────────────────────────── */}
      {showModal && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-in zoom-in-95 duration-300 ${isDark?'bg-black/95':'bg-black/70'}`}>
          <div className={`w-full max-w-2xl rounded-[3rem] p-8 md:p-12 space-y-8 relative max-h-[95vh] overflow-y-auto scrollbar-hide shadow-2xl ${isDark?'cartao-vidro border-[#C58A4A]/10':'bg-white border border-zinc-200'}`}>

            {/* Header */}
            <div className="flex justify-between items-center">
              <h2 className={`text-3xl font-black font-display italic ${isDark?'text-white':'text-zinc-900'}`}>
                {editingId?'Refinar Perfil':'Novo Recrutamento'}
              </h2>
              <button onClick={closeModal} className={`p-2 rounded-xl transition-all ${isDark?'text-zinc-500 hover:text-white':'text-zinc-500 hover:text-zinc-900'}`}><X size={24}/></button>
            </div>

            {/* Foto */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                <img src={formData.avatar} className="w-28 h-auto rounded-[2rem] object-contain border-4 border-white/10 shadow-xl block" alt="Avatar"/>
                <label className={`absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] cursor-pointer transition-all ${uploadState==='uploading'?'bg-black/70':'bg-black/60 opacity-0 group-hover:opacity-100'}`}>
                  {uploadState==='uploading'
                    ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : <><Upload size={22} className="text-white mb-1"/><span className="text-[8px] text-white font-black uppercase">Trocar foto</span></>
                  }
                  <input type="file" accept="image/*" className="hidden" disabled={uploadState==='uploading'||saving} onChange={handleFile}/>
                </label>
                {uploadState==='done'  && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-lg">✓</div>}
                {uploadState==='error' && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg"><X size={10} className="text-white"/></div>}
              </div>
              {uploadError && <p className="text-[9px] font-bold text-red-400 text-center max-w-xs">{uploadError}</p>}
              {uploadState==='done' && <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">✓ Foto enviada</p>}
            </div>

            {/* Campos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDark?'text-zinc-500':'text-zinc-600'}`}>Nome Artístico</label>
                <input type="text" value={formData.name} onChange={e=>setFormData(p=>({...p,name:e.target.value}))} className={inputCls}/>
              </div>
              <div className="col-span-2 space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDark?'text-zinc-500':'text-zinc-600'}`}>
                  WhatsApp do Barbeiro <span className={`normal-case font-medium ${isDark?'text-zinc-600':'text-zinc-400'}`}>(para receber agenda diária)</span>
                </label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black ${isDark?'text-zinc-400':'text-zinc-500'}`}>+55</span>
                  <input
                    type="tel"
                    placeholder="21 99999-9999"
                    value={(formData as any).phone||''}
                    onChange={e=>setFormData(p=>({...p,phone:e.target.value.replace(/\D/g,'')}))}
                    className={inputCls + ' pl-12'}
                  />
                </div>
                {(formData as any).phone && (
                  <p className="text-[9px] font-black text-emerald-500 flex items-center gap-1 ml-1">
                    ✓ Receberá agenda diária às 07:00 via WhatsApp
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDark?'text-zinc-500':'text-zinc-600'}`}>Comissão (%)</label>
                <input type="number" min={0} max={100} value={formData.commission} onChange={e=>setFormData(p=>({...p,commission:parseInt(e.target.value)||0}))} className={inputCls}/>
              </div>
              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDark?'text-zinc-500':'text-zinc-600'}`}>Descrição</label>
                <input type="text" value={formData.description||''} onChange={e=>setFormData(p=>({...p,description:e.target.value}))} placeholder="Especialidade..." className={inputCls}/>
              </div>

              {/* ── Barbeiro Master ── */}
              <div className="col-span-2 space-y-3">
                <button type="button" onClick={()=>setFormData(p=>({...p,isMaster:!(p as any).isMaster}))}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${(formData as any).isMaster?'border-[#C58A4A] bg-[#C58A4A]/10':isDark?'border-white/10 bg-white/5 hover:border-white/20':'border-zinc-200 bg-zinc-50 hover:border-zinc-300'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${(formData as any).isMaster?'bg-[#C58A4A] text-black':isDark?'bg-white/10 text-zinc-500':'bg-zinc-200 text-zinc-500'}`}>★</div>
                    <div className="text-left">
                      <p className={`text-[11px] font-black uppercase ${isDark?'text-white':'text-zinc-900'}`}>Barbeiro Master</p>
                      <p className={`text-[9px] font-medium normal-case ${isDark?'text-zinc-500':'text-zinc-400'}`}>Cobra acréscimo adicional por atendimento</p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full relative transition-colors ${(formData as any).isMaster?'bg-[#C58A4A]':isDark?'bg-white/10':'bg-zinc-300'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${(formData as any).isMaster?'right-0.5':'left-0.5'}`}/>
                  </div>
                </button>
                {(formData as any).isMaster && (
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDark?'text-zinc-500':'text-zinc-600'}`}>Acréscimo Master (R$)</label>
                    <input type="number" min={0} step={0.5} value={(formData as any).masterSurcharge||0} onChange={e=>setFormData(p=>({...p,masterSurcharge:parseFloat(e.target.value)||0}))} placeholder="Ex: 20" className={inputCls}/>
                    <p className={`text-[9px] ml-1 ${isDark?'text-zinc-600':'text-zinc-400'}`}>Valor adicionado ao preço do serviço quando este barbeiro for selecionado.</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Seção de agenda ── */}
            <div className="space-y-4">
              {/* Abas Semana / Mês */}
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#C58A4A]"/>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isDark?'text-zinc-400':'text-zinc-600'}`}>Disponibilidade</span>
              </div>

              <div className={`flex rounded-2xl p-1 gap-1 ${isDark?'bg-white/5':'bg-zinc-100'}`}>
                {([
                  {id:'semana' as ScheduleTab, label:'📅 Dias da Semana'},
                  {id:'mes'    as ScheduleTab, label:'📆 Folgas do Mês'},
                ]).map(tab=>(
                  <button key={tab.id} onClick={()=>setScheduleTab(tab.id)}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      scheduleTab===tab.id
                        ? 'bg-[#C58A4A] text-black shadow-md'
                        : isDark?'text-zinc-500 hover:text-zinc-300':'text-zinc-500 hover:text-zinc-700'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Aba: Dias da Semana ── */}
              {scheduleTab==='semana' && (
                <div className="space-y-3">
                  <p className={`text-[9px] font-bold ${isDark?'text-zinc-600':'text-zinc-400'}`}>
                    Clique no dia para ativar/desativar. Dias desativados = folgas fixas semanais.
                  </p>
                  {DAYS.map(d => {
                    const ws  = formData.weekSchedule||DEFAULT_WEEK;
                    const day = ws[d.key];
                    return (
                      <div key={d.key} className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all ${day.active?(isDark?'bg-[#C58A4A]/5 border-[#C58A4A]/20':'bg-amber-50 border-amber-200'):(isDark?'bg-white/[0.02] border-white/5 opacity-50':'bg-zinc-50 border-zinc-200 opacity-50')}`}>
                        <button onClick={()=>toggleDay(d.key)} className={`w-11 shrink-0 text-[9px] font-black uppercase py-2 rounded-xl transition-all ${day.active?'bg-[#C58A4A] text-black':isDark?'bg-white/10 text-zinc-500':'bg-zinc-200 text-zinc-500'}`}>
                          {d.label}
                        </button>
                        {day.active ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Clock size={11} className="text-[#C58A4A] shrink-0"/>
                            <input type="time" value={day.start} onChange={e=>setDayTime(d.key,'start',e.target.value)} className={`border rounded-xl p-1.5 text-xs font-bold outline-none min-w-0 flex-1 ${isDark?'bg-white/5 border-white/10 text-white':'bg-white border-zinc-300 text-zinc-900'}`}/>
                            <span className={`text-[9px] font-black shrink-0 ${isDark?'text-zinc-500':'text-zinc-400'}`}>—</span>
                            <input type="time" value={day.end}   onChange={e=>setDayTime(d.key,'end',e.target.value)}   className={`border rounded-xl p-1.5 text-xs font-bold outline-none min-w-0 flex-1 ${isDark?'bg-white/5 border-white/10 text-white':'bg-white border-zinc-300 text-zinc-900'}`}/>
                          </div>
                        ) : (
                          <span className={`text-[9px] font-black uppercase tracking-widest ${isDark?'text-zinc-600':'text-zinc-400'}`}>Folga semanal</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Aba: Folgas do Mês ── */}
              {scheduleTab==='mes' && (
                <div className="space-y-3">
                  <p className={`text-[9px] font-bold ${isDark?'text-zinc-600':'text-zinc-400'}`}>
                    Clique em um dia para marcar/desmarcar folga pontual. Não afeta a rotina semanal.
                  </p>
                  <MonthOffCalendar
                    offDays={formData.offDays||[]}
                    weekSchedule={formData.weekSchedule||DEFAULT_WEEK}
                    onChange={days=>setFormData(p=>({...p,offDays:days}))}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>

            {/* Botão salvar */}
            <button onClick={handleSave} disabled={saving||uploadState==='uploading'}
              className="w-full gradiente-ouro text-black py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all">
              {saving
                ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/>Salvando...</span>
                : uploadState==='uploading'
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/>Enviando foto...</span>
                  : 'Confirmar Especialista'
              }
            </button>

          </div>
        </div>
      )}
    </div>
  );
};

export default Professionals;
