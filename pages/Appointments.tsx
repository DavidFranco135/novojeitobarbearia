import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Clock, Check, X,
  Calendar, Scissors, LayoutGrid, List, UserPlus, DollarSign, RefreshCw,
  Phone, Mail, User, Users, AlertCircle, Hourglass, Trash2, Crown, Eye, EyeOff
} from 'lucide-react';
import { useBarberStore } from '../store';
import { Appointment } from '../types';

const NOTIFICATION_SOUND_URL = 'https://raw.githubusercontent.com/DavidFranco135/iphone/main/iphone.mp3';

// ─── Helpers de data ──────────────────────────────────────────
const getTodayString = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const formatDateLabel = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};
const shiftDate = (dateStr: string, delta: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const nd = new Date(y, m-1, d+delta);
  return `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}-${String(nd.getDate()).padStart(2,'0')}`;
};
const formatMonthLabel = (ms: string): string => {
  const [y, m] = ms.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

// ─── Áudio ───────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null;
let _audioBuf: AudioBuffer | null = null;
let _audioLoading = false, _audioReady = false;
let _debounce: ReturnType<typeof setTimeout> | null = null;
const getCtx = () => { if (!_audioCtx || _audioCtx.state === 'closed') _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); return _audioCtx; };
const preloadAudio = async () => {
  if (_audioReady || _audioLoading) return; _audioLoading = true;
  try { const ctx = getCtx(); if (ctx.state==='suspended') await ctx.resume(); _audioBuf = await ctx.decodeAudioData(await (await fetch(NOTIFICATION_SOUND_URL)).arrayBuffer()); _audioReady = true; } catch { _audioLoading = false; }
};
const playSound = async () => { if (!_audioReady || !_audioBuf) return; try { const ctx = getCtx(); if (ctx.state==='suspended') await ctx.resume(); const s = ctx.createBufferSource(); s.buffer = _audioBuf; s.connect(ctx.destination); s.start(0); } catch {} };
const SOUND_KEY = 'brb_last_notif_ts';
const scheduleSound = () => {
  if (_debounce) clearTimeout(_debounce);
  _debounce = setTimeout(() => { const now = Date.now(); const last = parseInt(localStorage.getItem(SOUND_KEY)||'0', 10); if (now-last < 6000) { _debounce=null; return; } localStorage.setItem(SOUND_KEY, String(now)); playSound(); _debounce=null; }, 400);
};

// ─── Session cache para "Em Atendimento" ─────────────────────
const SESSION_KEY = 'brb_walkin_session';
const loadSession = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)||'{}'); } catch { return {}; } };
const saveSession = (s: Record<string, boolean>) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));

const Appointments: React.FC = () => {
  const {
    appointments, professionals, services, clients, user, notifications,
    addAppointment, updateAppointmentStatus, deleteAppointment,
    addClient, rescheduleAppointment, theme, config
  } = useBarberStore();

  const mountRef = useRef(Date.now());
  const prevNotifRef = useRef<number|null>(null);
  useEffect(() => { preloadAudio(); }, []);
  useEffect(() => { const t = () => setCurrentDate(getTodayString()); t(); const i = setInterval(t, 60000); return () => clearInterval(i); }, []);
  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    const apptNotifs = notifications.filter(n => n.type === 'appointment');
    if (prevNotifRef.current === null) { prevNotifRef.current = apptNotifs.length; return; }
    if (apptNotifs.length > prevNotifRef.current && apptNotifs.some(n => new Date(n.time).getTime() > mountRef.current)) scheduleSound();
    prevNotifRef.current = apptNotifs.length;
  }, [notifications, user]);

  // ─── State ───────────────────────────────────────────────
  const [viewMode, setViewMode]     = useState<'grid'|'list'>('grid');
  const [compactView, setCompactView] = useState(false);
  const [showWalkInQueue, setShowWalkInQueue] = useState(false);
  const [currentDate, setCurrentDate] = useState(getTodayString);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showAgendarDropdown, setShowAgendarDropdown] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<Appointment|null>(null);
  const [showDetailModal, setShowDetailModal]         = useState<Appointment|null>(null);
  const [rescheduleData, setRescheduleData] = useState({ date:'', time:'' });
  const [filterPeriod, setFilterPeriod]     = useState<'day'|'month'|'all'>('day');
  const [selectedMonth, setSelectedMonth]   = useState(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [saving, setSaving] = useState(false);

  // Normal appointment form
  const [newApp, setNewApp] = useState({ clientId:'', serviceId:'', professionalId:'', startTime:'09:00' });
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClient, setQuickClient] = useState({ name:'', phone:'', email:'', password:'' });
  const [showQCPwd, setShowQCPwd] = useState(false);

  // Walk-in form
  const [walkInStep, setWalkInStep]   = useState<'choose'|'form'>('choose');
  const [walkInMode, setWalkInMode]   = useState<'schedule'|'queue'>('schedule');
  const [walkInHasAcc, setWalkInHasAcc] = useState<boolean|null>(null);
  const [walkInData, setWalkInData]   = useState({ clientId:'', serviceId:'', professionalId:'', startTime:'09:00' });
  const [walkInNew, setWalkInNew]     = useState({ name:'', phone:'', email:'', password:'' });
  const [showWIPwd, setShowWIPwd]     = useState(false);
  const [sessionAtt, setSessionAtt]   = useState<Record<string,boolean>>(loadSession);
  useEffect(() => { saveSession(sessionAtt); }, [sessionAtt]);

  const hours = useMemo(() => Array.from({length:14},(_,i)=>`${(i+8).toString().padStart(2,'0')}:00`), []);
  const appointmentsToday = useMemo(() => appointments.filter(a=>a.date===currentDate), [appointments, currentDate]);
  const walkInToday = useMemo(() => appointmentsToday.filter(a=>(a as any).walkIn===true), [appointmentsToday]);
  const waitingCount = walkInToday.filter(a=>a.status==='PENDENTE').length;
  const appointmentsFiltered = useMemo(() => {
    const base = appointments.filter(a=>!(a as any).walkIn);
    if (filterPeriod==='day') return base.filter(a=>a.date===currentDate);
    if (filterPeriod==='month') return base.filter(a=>a.date.startsWith(selectedMonth));
    return base;
  }, [appointments, currentDate, selectedMonth, filterPeriod]);

  // ─── Master surcharge ─────────────────────────────────────
  const getMasterSurcharge = (profId: string): number => {
    if (!profId) return 0;
    const p = professionals.find(p=>p.id===profId);
    if (!p || !(p as any).isMaster) return 0;
    return (p as any).masterSurcharge || (config as any)?.masterBarberSurcharge || 0;
  };
  const getPrice = (serviceId: string, profId: string): number => {
    const s = services.find(s=>s.id===serviceId);
    return s ? s.price + getMasterSurcharge(profId) : 0;
  };

  const hasAvailableSlot = useMemo(() => {
    if (!walkInData.serviceId) return true;
    const now = new Date(); const nowM = now.getHours()*60+now.getMinutes();
    for (const prof of professionals) for (const hour of hours) {
      const h = parseInt(hour); if (h*60 < nowM) continue;
      if (!appointmentsToday.some(a=>a.professionalId===prof.id && a.startTime.startsWith(String(h).padStart(2,'0')) && a.status!=='CANCELADO')) return true;
    }
    return false;
  }, [walkInData.serviceId, appointmentsToday, professionals, hours]);

  // ─── Handlers ─────────────────────────────────────────────
  const handleQuickClient = async () => {
    if (!quickClient.name || !quickClient.phone) return alert('Preencha nome e telefone');
    const c = await addClient(quickClient);
    setNewApp({...newApp, clientId: c.id});
    setShowQuickClient(false);
    setQuickClient({name:'', phone:'', email:'', password:''});
  };

  const handleClickEmptySlot = (professionalId: string, timeSlot: string) => {
    setNewApp({...newApp, professionalId, startTime: timeSlot});
    setShowAddModal(true);
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault(); if (saving) return; setSaving(true);
    try {
      const service = services.find(s=>s.id===newApp.serviceId); if (!service) return;
      const price = getPrice(newApp.serviceId, newApp.professionalId);
      const [h,m] = newApp.startTime.split(':').map(Number);
      const tm = h*60+m+service.durationMinutes;
      const endTime = `${Math.floor(tm/60).toString().padStart(2,'0')}:${(tm%60).toString().padStart(2,'0')}`;
      const cli = clients.find(c=>c.id===newApp.clientId);
      await addAppointment({ ...newApp, clientName: cli?.name||'', clientPhone: cli?.phone||'', serviceName: service.name, professionalName: professionals.find(p=>p.id===newApp.professionalId)?.name||'', date: currentDate, endTime, price });
      setShowAddModal(false);
      setNewApp({clientId:'', serviceId:'', professionalId:'', startTime:'09:00'});
    } catch { alert('Erro ao agendar. Verifique a conexão.'); } finally { setSaving(false); }
  };

  const handleReschedule = () => {
    if (!showRescheduleModal || !rescheduleData.date || !rescheduleData.time) return;
    const service = services.find(s=>s.id===showRescheduleModal.serviceId);
    const [h,m] = rescheduleData.time.split(':').map(Number);
    const dur = service?.durationMinutes||30;
    const et = `${Math.floor((h*60+m+dur)/60).toString().padStart(2,'0')}:${((h*60+m+dur)%60).toString().padStart(2,'0')}`;
    rescheduleAppointment(showRescheduleModal.id, rescheduleData.date, rescheduleData.time, et);
    setShowRescheduleModal(null);
  };

  const openWalkInModal = () => {
    setWalkInStep('choose'); setWalkInMode('schedule'); setWalkInHasAcc(null);
    setWalkInData({clientId:'', serviceId:'', professionalId:'', startTime:'09:00'});
    setWalkInNew({name:'', phone:'', email:'', password:''});
    setShowWalkInModal(true); setShowAgendarDropdown(false);
  };

  const resolveWalkInClient = async () => {
    if (walkInData.clientId) { const c = clients.find(c=>c.id===walkInData.clientId); return {clientId:walkInData.clientId, clientName:c?.name||'', clientPhone:c?.phone||''}; }
    if (!walkInNew.name) throw new Error('Informe o nome do cliente.');
    const nc = await addClient({name:walkInNew.name, phone:walkInNew.phone, email:walkInNew.email||'', password:walkInNew.password||''});
    return {clientId:nc.id, clientName:nc.name, clientPhone:nc.phone};
  };

  const handleWalkInSchedule = async () => {
    const service = services.find(s=>s.id===walkInData.serviceId);
    if (!service) return alert('Selecione um serviço.');
    if (!walkInData.professionalId) return alert('Selecione um barbeiro.');
    if (walkInHasAcc===null) return alert('Indique se o cliente tem cadastro.');
    if (saving) return; setSaving(true);
    try {
      const {clientId, clientName, clientPhone} = await resolveWalkInClient();
      const price = getPrice(walkInData.serviceId, walkInData.professionalId);
      const [h,m] = walkInData.startTime.split(':').map(Number);
      const tm = h*60+m+service.durationMinutes;
      const endTime = `${Math.floor(tm/60).toString().padStart(2,'0')}:${(tm%60).toString().padStart(2,'0')}`;
      const prof = professionals.find(p=>p.id===walkInData.professionalId);
      await addAppointment({clientId, clientName, clientPhone, serviceId:service.id, serviceName:service.name, professionalId:walkInData.professionalId, professionalName:prof?.name||'', date:currentDate, startTime:walkInData.startTime, endTime, price});
      setShowWalkInModal(false);
      alert(`✅ Agendamento criado para ${clientName} às ${walkInData.startTime}!`);
    } catch (err:any) { alert(err.message||'Erro ao agendar.'); } finally { setSaving(false); }
  };

  const handleAddToQueue = async () => {
    const service = services.find(s=>s.id===walkInData.serviceId);
    if (!service) return alert('Selecione um serviço.');
    if (walkInHasAcc===null) return alert('Indique se o cliente tem cadastro.');
    if (saving) return; setSaving(true);
    try {
      const {clientId, clientName, clientPhone} = await resolveWalkInClient();
      const price = getPrice(walkInData.serviceId, walkInData.professionalId||'');
      const now = new Date();
      const arrivedAt = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const [h,m] = arrivedAt.split(':').map(Number);
      const tm = h*60+m+service.durationMinutes;
      const endTime = `${Math.floor(tm/60).toString().padStart(2,'0')}:${(tm%60).toString().padStart(2,'0')}`;
      const prof = professionals.find(p=>p.id===walkInData.professionalId);
      await addAppointment({clientId, clientName, clientPhone, serviceId:service.id, serviceName:service.name, professionalId:walkInData.professionalId||'', professionalName:prof?.name||'Qualquer barbeiro', date:currentDate, startTime:arrivedAt, endTime, price, walkIn:true} as any);
      setShowWalkInModal(false); setShowWalkInQueue(true);
      alert(`✅ ${clientName} adicionado à fila!`);
    } catch (err:any) { alert(err.message||'Erro ao adicionar.'); } finally { setSaving(false); }
  };

  const handleCallWalkIn = (id:string) => setSessionAtt(s=>({...s,[id]:true}));
  const handleCompleteWalkIn = async (appt:Appointment) => {
    if (!window.confirm(`Confirmar conclusão e pagamento de ${appt.clientName}?\nValor: R$ ${appt.price.toFixed(2)}`)) return;
    try { await updateAppointmentStatus(appt.id, 'CONCLUIDO_PAGO'); setSessionAtt(s=>{const n={...s};delete n[appt.id];return n;}); alert(`✅ R$ ${appt.price.toFixed(2)} registrado no fluxo de caixa.`); }
    catch { alert('Erro ao concluir.'); }
  };
  const handleRemoveWalkIn = async (appt:Appointment) => {
    if (!window.confirm(`Remover ${appt.clientName} da fila?`)) return;
    await deleteAppointment(appt.id);
    setSessionAtt(s=>{const n={...s};delete n[appt.id];return n;});
  };

  // ─── Estilos base ─────────────────────────────────────────
  const isLight = theme === 'light';

  // Input/label para modais — sempre cor correta em claro e escuro
  // Estilo inline para <select> — garante fundo escuro no dark mode nativo do browser
  const selStyle = isLight
    ? { backgroundColor: '#f9fafb', color: '#18181b', borderColor: '#d1d5db' }
    : { backgroundColor: '#1a1a1a', color: '#f4f4f5', borderColor: 'rgba(255,255,255,0.1)' };

  const inp = (extra='') =>
    `w-full border p-4 rounded-2xl outline-none text-sm font-semibold transition-all ${isLight ? 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white placeholder-zinc-600 focus:border-[#C58A4A]'} ${extra}`;
  const lbl = `text-[10px] font-black uppercase tracking-widest ml-1 mb-1 block ${isLight ? 'text-zinc-700' : 'text-zinc-400'}`;

  // Botão de aba — sem fundo branco no hover/active
  const tabCls = (active:boolean, accent:'gold'|'orange'|'purple'='gold') => {
    const ac = accent==='orange' ? 'bg-orange-500 text-white border-transparent'
             : accent==='purple' ? 'bg-purple-600 text-white border-transparent'
             : 'bg-[#C58A4A] text-black border-transparent';
    const ia = isLight
      ? 'bg-transparent text-zinc-700 border-zinc-300 hover:text-zinc-900 hover:border-zinc-500 hover:bg-zinc-200'
      : 'bg-transparent text-zinc-400 border-white/10 hover:text-zinc-200 hover:border-white/30 hover:bg-white/5';
    return `px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-colors select-none ${active ? ac : ia}`;
  };

  // Painel / card modal interno — inline style garante cor no modo escuro
  const modalBg = isLight ? '#ffffff' : '#111111';
  const modalStyle = { backgroundColor: modalBg, border: isLight ? '1px solid #e4e4e7' : '1px solid rgba(255,255,255,0.08)' };
  const modalCard = isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'border text-white';

  // Grade de horários — mais visível
  const gridRowBg   = isLight ? 'bg-zinc-50'   : 'bg-[#0a0a0a]';
  const gridBorder  = isLight ? 'border-zinc-200' : 'border-white/8';
  const gridHourBg  = isLight ? 'bg-zinc-200'  : 'bg-white/5';
  const gridHourTxt = isLight ? 'text-zinc-700 font-extrabold' : 'text-zinc-400 font-black';
  const gridHeadBg  = isLight ? 'bg-zinc-100 border-zinc-300' : 'bg-[#111] border-white/8';
  const gridNameTxt = isLight ? 'text-zinc-800' : 'text-zinc-300';
  const gridCellHov = isLight ? 'hover:bg-[#C58A4A]/8' : 'hover:bg-[#C58A4A]/5';

  return (
    <div className="h-full flex flex-col gap-3 animate-in fade-in pb-10">

      {/* ══ CABEÇALHO ══════════════════════════════════════════ */}
      <div className="flex flex-col gap-2.5">
        {/* Linha 1 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className={`text-xl font-black font-display italic ${isLight?'text-zinc-900':'text-white'}`}>Agenda Digital</h1>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={()=>setViewMode('grid')}  className={tabCls(viewMode==='grid')}><LayoutGrid size={12} className="inline -mt-0.5 mr-1"/>Grade</button>
            <button onClick={()=>setViewMode('list')}  className={tabCls(viewMode==='list')}><List size={12} className="inline -mt-0.5 mr-1"/>Lista</button>
            {viewMode==='grid' && (
              <button onClick={()=>{setCompactView(!compactView); if(!compactView) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();}} className={tabCls(compactView,'purple')}>Compacto</button>
            )}
            <button onClick={()=>setShowWalkInQueue(!showWalkInQueue)} className={`relative ${tabCls(showWalkInQueue,'orange')}`}>
              <Hourglass size={12} className="inline -mt-0.5 mr-1"/>Fila
              {waitingCount>0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] font-black flex items-center justify-center pointer-events-none">{waitingCount}</span>}
            </button>
          </div>
        </div>

        {/* Linha 2 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            <button onClick={()=>setFilterPeriod('day')}   className={tabCls(filterPeriod==='day')}>Dia</button>
            <button onClick={()=>setFilterPeriod('month')} className={tabCls(filterPeriod==='month')}>Mês</button>
            <button onClick={()=>setFilterPeriod('all')}   className={tabCls(filterPeriod==='all')}>Todos</button>
          </div>

          {filterPeriod==='day' && (
            <div className={`flex items-center border rounded-xl px-1 ${isLight?'bg-white border-zinc-300':'bg-white/5 border-white/10'}`}>
              <button onClick={()=>setCurrentDate(p=>shiftDate(p,-1))} className={`p-1.5 ${isLight?'text-zinc-700 hover:text-zinc-900':'text-zinc-400 hover:text-white'}`}><ChevronLeft size={15}/></button>
              <span className={`px-2 text-[10px] font-black uppercase ${isLight?'text-zinc-800':'text-zinc-300'}`}>{formatDateLabel(currentDate)}</span>
              <button onClick={()=>setCurrentDate(p=>shiftDate(p,+1))} className={`p-1.5 ${isLight?'text-zinc-700 hover:text-zinc-900':'text-zinc-400 hover:text-white'}`}><ChevronRight size={15}/></button>
            </div>
          )}
          {filterPeriod==='month' && (
            <div className={`flex items-center border rounded-xl px-1 ${isLight?'bg-white border-zinc-300':'bg-white/5 border-white/10'}`}>
              <button onClick={()=>{const[y,mo]=selectedMonth.split('-').map(Number);const d=new Date(y,mo-2,1);setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);}} className={`p-1.5 ${isLight?'text-zinc-700 hover:text-zinc-900':'text-zinc-400 hover:text-white'}`}><ChevronLeft size={15}/></button>
              <span className={`px-2 text-[10px] font-black uppercase ${isLight?'text-zinc-800':'text-zinc-300'}`}>{formatMonthLabel(selectedMonth)}</span>
              <button onClick={()=>{const[y,mo]=selectedMonth.split('-').map(Number);const d=new Date(y,mo,1);setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);}} className={`p-1.5 ${isLight?'text-zinc-700 hover:text-zinc-900':'text-zinc-400 hover:text-white'}`}><ChevronRight size={15}/></button>
            </div>
          )}

          {/* Dropdown Agendar */}
          <div className="relative ml-auto">
            <button onClick={()=>setShowAgendarDropdown(v=>!v)} className="gradiente-ouro text-black px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-1.5 select-none">
              Agendar <ChevronRight size={11} className={`transition-transform ${showAgendarDropdown?'rotate-90':''}`}/>
            </button>
            {showAgendarDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={()=>setShowAgendarDropdown(false)}/>
                <div className={`absolute right-0 top-[calc(100%+6px)] rounded-2xl shadow-2xl border z-50 overflow-hidden ${isLight?'bg-white border-zinc-200':'bg-[#1c1c1c] border-white/10'}`} style={{minWidth:'248px'}}>
                  <button onClick={()=>{setShowAgendarDropdown(false);setShowAddModal(true);}} className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${isLight?'hover:bg-zinc-50 text-zinc-800':'hover:bg-white/5 text-zinc-200'}`}>
                    <div className="w-9 h-9 rounded-xl bg-[#C58A4A]/20 flex items-center justify-center shrink-0"><Calendar size={16} className="text-[#C58A4A]"/></div>
                    <div><p className="text-[11px] font-black uppercase">Agendamento Normal</p><p className={`text-[9px] normal-case font-medium mt-0.5 ${isLight?'text-zinc-500':'text-zinc-500'}`}>Cliente com horário marcado</p></div>
                  </button>
                  <div className={`mx-4 border-t ${isLight?'border-zinc-100':'border-white/5'}`}/>
                  <button onClick={()=>{setShowAgendarDropdown(false);openWalkInModal();}} className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${isLight?'hover:bg-orange-50 text-zinc-800':'hover:bg-orange-500/10 text-zinc-200'}`}>
                    <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0"><Users size={16} className="text-orange-400"/></div>
                    <div><p className="text-[11px] font-black uppercase">Cliente na Barbearia</p><p className={`text-[9px] normal-case font-medium mt-0.5 ${isLight?'text-zinc-500':'text-zinc-500'}`}>Chegou sem agendamento</p></div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══ ÁREA PRINCIPAL ═════════════════════════════════════ */}
      <div className="flex-1 flex gap-3 overflow-hidden min-h-0">

        {/* Grade / Lista */}
        <div className={`flex-1 rounded-[1.5rem] border shadow-xl overflow-hidden flex flex-col min-w-0 ${isLight?'bg-white border-zinc-300':'bg-[#0a0a0a] border-white/8'}`}>
          {viewMode==='grid' ? (
            <div className="overflow-auto h-full scrollbar-hide">
              <div className={compactView?'w-full':'min-w-[540px]'}>
                {/* Header barbeiros */}
                <div className={`border-b sticky top-0 z-10 ${gridHeadBg} ${compactView?'grid grid-cols-[48px_repeat(auto-fit,minmax(80px,1fr))]':'grid grid-cols-[64px_repeat(auto-fit,minmax(140px,1fr))]'}`}>
                  <div className={`flex items-center justify-center p-2 border-r ${gridBorder}`}><Clock size={14} className={isLight?'text-zinc-500':'text-zinc-600'}/></div>
                  {professionals.map(prof=>(
                    <div key={prof.id} className={`flex items-center justify-center gap-1.5 border-r ${gridBorder} ${compactView?'p-1.5 flex-col':'p-2.5'}`}>
                      <img src={prof.avatar} className={`rounded-lg object-cover border-2 border-[#C58A4A] ${compactView?'w-5 h-5':'w-8 h-8'}`} alt=""/>
                      <div className="text-center">
                        <p className={`font-black uppercase ${compactView?'text-[7px]':'text-[10px]'} ${gridNameTxt}`}>{prof.name.split(' ')[0]}</p>
                        {(prof as any).isMaster && !compactView && <p className="text-[7px] font-black text-[#C58A4A]">★ Master</p>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Linhas */}
                {hours.map(hour=>(
                  <div key={hour} className={`border-b ${gridBorder} ${compactView?'grid grid-cols-[48px_repeat(auto-fit,minmax(80px,1fr))] min-h-[30px]':'grid grid-cols-[64px_repeat(auto-fit,minmax(140px,1fr))] min-h-[54px]'}`}>
                    <div className={`flex items-center justify-center border-r ${gridBorder} ${gridHourBg}`}>
                      <span className={`${gridHourTxt} ${compactView?'text-[9px]':'text-[11px]'}`}>{hour}</span>
                    </div>
                    {professionals.map(prof=>{
                      const app = appointmentsToday.find(a=>a.professionalId===prof.id && a.startTime.split(':')[0]===hour.split(':')[0] && a.status!=='CANCELADO' && !(a as any).walkIn);
                      return (
                        <div key={prof.id}
                          className={`border-r last:border-r-0 ${gridBorder} ${compactView?'p-0.5':'p-1'} ${!app?`cursor-pointer ${gridCellHov} transition-colors`:''}`}
                          onClick={()=>!app && handleClickEmptySlot(prof.id, hour)}
                          title={!app?`Agendar às ${hour}`:''}
                        >
                          {app ? (
                            <div className={`h-full w-full rounded-xl border flex flex-col justify-between ${app.status==='CONCLUIDO_PAGO'?'border-emerald-500/50 bg-emerald-500/10':'border-[#C58A4A]/40 bg-[#C58A4A]/10'} ${compactView?'p-1':'p-1.5'}`}>
                              <div className="truncate">
                                <p onClick={e=>{e.stopPropagation();setShowDetailModal(app);}} className={`font-black uppercase truncate cursor-pointer hover:text-[#C58A4A] transition-colors ${compactView?'text-[7px]':'text-[10px]'} ${isLight?'text-zinc-900':'text-white'}`}>{app.clientName}</p>
                                {!compactView && <p className={`text-[7px] font-bold mt-0.5 truncate uppercase ${isLight?'text-zinc-500':'text-zinc-500'}`}>{app.serviceName}</p>}
                              </div>
                              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                                <button onClick={e=>{e.stopPropagation();updateAppointmentStatus(app.id,app.status==='CONCLUIDO_PAGO'?'PENDENTE':'CONCLUIDO_PAGO');}} className={`rounded-md p-0.5 transition-colors ${app.status==='CONCLUIDO_PAGO'?'bg-emerald-500 text-white':'bg-black/10 text-zinc-600 hover:text-zinc-900'}`}><DollarSign size={compactView?8:10}/></button>
                                <button onClick={e=>{e.stopPropagation();setShowRescheduleModal(app);}} className="rounded-md p-0.5 bg-black/10 text-zinc-600 hover:text-zinc-900 transition-colors"><RefreshCw size={compactView?8:10}/></button>
                                <button onClick={e=>{e.stopPropagation();if(window.confirm(`Excluir agendamento de ${app.clientName}?`))deleteAppointment(app.id);}} className="rounded-md p-0.5 bg-black/10 text-zinc-600 hover:text-red-500 transition-colors"><X size={compactView?8:10}/></button>
                              </div>
                            </div>
                          ):(
                            <div className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-30 transition-opacity">
                              <Plus size={compactView?10:14} className="text-[#C58A4A]"/>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ):(
            <div className="p-4 space-y-2 overflow-y-auto h-full scrollbar-hide">
              {appointmentsFiltered.length===0 && (
                <p className={`text-center py-16 font-black uppercase text-[10px] italic ${isLight?'text-zinc-400':'text-zinc-600'}`}>Nenhum agendamento {filterPeriod==='day'?'para hoje':filterPeriod==='month'?'neste mês':'encontrado'}.</p>
              )}
              {appointmentsFiltered.map(app=>(
                <div key={app.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${isLight?'bg-zinc-50 border-zinc-200 hover:border-[#C58A4A]/40':'bg-white/5 border-white/5 hover:border-[#C58A4A]/30'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${app.status==='CONCLUIDO_PAGO'?'border-emerald-500 text-emerald-600 bg-emerald-500/10':'border-[#C58A4A] text-[#C58A4A] bg-[#C58A4A]/10'}`}>
                      {app.status==='CONCLUIDO_PAGO'?<Check size={14}/>:<Clock size={14}/>}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-black truncate cursor-pointer hover:text-[#C58A4A] transition-colors ${isLight?'text-zinc-900':'text-white'}`} onClick={()=>setShowDetailModal(app)}>{app.clientName} · <span className="text-[#C58A4A]">{app.startTime}</span></p>
                      <p className={`text-[9px] font-black uppercase tracking-wide truncate ${isLight?'text-zinc-500':'text-zinc-500'}`}>{app.serviceName} · {app.professionalName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={()=>updateAppointmentStatus(app.id,app.status==='CONCLUIDO_PAGO'?'PENDENTE':'CONCLUIDO_PAGO')} className={`p-2 rounded-xl border transition-colors ${app.status==='CONCLUIDO_PAGO'?'bg-emerald-500 text-white border-transparent':isLight?'bg-zinc-100 border-zinc-300 text-zinc-600 hover:text-zinc-900':'bg-white/5 border-white/10 text-zinc-500 hover:text-white'}`}><DollarSign size={13}/></button>
                    <button onClick={()=>setShowRescheduleModal(app)} className={`p-2 rounded-xl border transition-colors ${isLight?'bg-zinc-100 border-zinc-300 text-zinc-600 hover:text-zinc-900':'bg-white/5 border-white/10 text-zinc-500 hover:text-white'}`}><RefreshCw size={13}/></button>
                    <button onClick={()=>{if(window.confirm(`Excluir agendamento de ${app.clientName}?`))deleteAppointment(app.id);}} className={`p-2 rounded-xl border transition-colors ${isLight?'bg-zinc-100 border-zinc-300 text-zinc-600 hover:text-red-500':'bg-white/5 border-white/10 text-zinc-500 hover:text-red-400'}`}><X size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fila lateral */}
        {showWalkInQueue && (
          <div className={`w-64 shrink-0 rounded-[1.5rem] border shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 ${isLight?'bg-white border-zinc-300':'bg-[#0a0a0a] border-white/10'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isLight?'border-zinc-200 bg-orange-50':'border-white/5 bg-orange-500/5'}`}>
              <div>
                <h3 className={`font-black text-xs uppercase tracking-widest flex items-center gap-1.5 ${isLight?'text-zinc-900':'text-white'}`}><Hourglass size={12} className="text-orange-400"/>Fila de Espera</h3>
                <p className="text-[9px] text-orange-500 font-black uppercase mt-0.5">{waitingCount} aguardando</p>
              </div>
              <button onClick={openWalkInModal} className="p-2 bg-orange-500 text-white rounded-xl hover:scale-105 transition-all"><Plus size={13}/></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-2.5 space-y-2">
              {walkInToday.length===0 && (
                <div className="text-center py-8"><Hourglass size={26} className={`mx-auto mb-2 ${isLight?'text-zinc-300':'text-zinc-700'}`}/><p className={`text-[9px] font-black uppercase ${isLight?'text-zinc-400':'text-zinc-600'}`}>Fila vazia</p></div>
              )}
              {walkInToday.map((appt,idx)=>{
                const isAtt = sessionAtt[appt.id]===true;
                const isDone = appt.status==='CONCLUIDO_PAGO';
                const prof = professionals.find(p=>p.id===appt.professionalId);
                const surcharge = getMasterSurcharge(appt.professionalId);
                return (
                  <div key={appt.id} className={`rounded-2xl border p-3 ${isDone?'opacity-40':''} ${isLight?'bg-zinc-50 border-zinc-200':'bg-white/5 border-white/5'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-[8px] font-black shrink-0 text-white ${isDone?'bg-emerald-500':isAtt?'bg-blue-500':'bg-orange-500'}`}>{isDone?'✓':idx+1}</div>
                        <div><p className={`text-[11px] font-black leading-tight ${isLight?'text-zinc-900':'text-white'}`}>{appt.clientName}</p>{appt.clientPhone&&<p className="text-[9px] text-zinc-500">{appt.clientPhone}</p>}</div>
                      </div>
                      {!isDone&&<button onClick={()=>handleRemoveWalkIn(appt)} className="p-1 text-zinc-400 hover:text-red-500 transition-colors shrink-0"><Trash2 size={10}/></button>}
                    </div>
                    <div className="mb-2 space-y-0.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="text-[9px] font-black text-[#C58A4A]">{appt.serviceName}</p>
                        {(prof as any)?.isMaster && surcharge>0 && <span className="text-[8px] font-black text-amber-400 flex items-center gap-0.5"><Crown size={7}/>+R${surcharge}</span>}
                      </div>
                      <p className="text-[9px] font-black text-[#C58A4A]">R$ {appt.price.toFixed(2)}</p>
                      <p className={`text-[8px] ${isLight?'text-zinc-500':'text-zinc-500'}`}>{appt.professionalName} · {appt.startTime}</p>
                    </div>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[8px] font-black uppercase mb-2 ${isDone?'text-emerald-600 bg-emerald-500/10 border-emerald-500/20':isAtt?'text-blue-500 bg-blue-500/10 border-blue-500/20':'text-amber-600 bg-amber-500/10 border-amber-500/20'}`}>
                      {isDone?'✓ Concluído':isAtt?'● Em Atendimento':'⏳ Aguardando'}
                    </div>
                    {!isDone&&!isAtt&&<button onClick={()=>handleCallWalkIn(appt.id)} className="w-full py-2 bg-blue-500/15 text-blue-600 border border-blue-500/25 rounded-xl text-[9px] font-black uppercase hover:bg-blue-500/20 transition-colors">Chamar</button>}
                    {!isDone&&isAtt&&<button onClick={()=>handleCompleteWalkIn(appt)} className="w-full py-2 gradiente-ouro text-black rounded-xl text-[9px] font-black uppercase hover:scale-[1.02] transition-all">✓ Concluir e Pagar</button>}
                  </div>
                );
              })}
            </div>
            {walkInToday.some(a=>a.status==='CONCLUIDO_PAGO')&&(
              <div className={`p-3 border-t text-center ${isLight?'border-zinc-200':'border-white/5'}`}>
                <p className={`text-[9px] font-black uppercase ${isLight?'text-zinc-500':'text-zinc-500'}`}>{walkInToday.filter(a=>a.status==='CONCLUIDO_PAGO').length} concluído(s) · R$ {walkInToday.filter(a=>a.status==='CONCLUIDO_PAGO').reduce((s,a)=>s+a.price,0).toFixed(2)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ MODAL WALK-IN ══════════════════════════════════════ */}
      {showWalkInModal && (
        <div className={`fixed inset-0 z-[150] flex items-end sm:items-center justify-center backdrop-blur-xl animate-in fade-in ${isLight?'bg-black/60':'bg-black/90'}`}>
          <div className={`w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide ${modalCard}`} style={modalStyle}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-0.5">Cliente Presencial</p>
                <h2 className={`text-lg font-black font-display italic ${isLight?'text-zinc-900':'text-white'}`}>{walkInStep==='choose'?'Como prosseguir?':walkInMode==='schedule'?'Agendar Horário':'Adicionar à Fila'}</h2>
              </div>
              <button onClick={()=>setShowWalkInModal(false)} className={`p-2 rounded-xl transition-colors ${isLight?'bg-zinc-100 hover:bg-zinc-200 text-zinc-600':'bg-white/5 hover:bg-white/10 text-zinc-400'}`}><X size={18}/></button>
            </div>

            {walkInStep==='choose' && (
              <div className="space-y-3">
                <button onClick={()=>{setWalkInMode('schedule');setWalkInStep('form');}} className={`w-full p-4 rounded-2xl border-2 text-left transition-colors hover:border-[#C58A4A] ${isLight?'border-zinc-200 bg-zinc-50':'border-white/10 bg-white/5'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#C58A4A]/20 flex items-center justify-center shrink-0"><Calendar size={16} className="text-[#C58A4A]"/></div>
                    <div><p className={`font-black text-sm ${isLight?'text-zinc-900':'text-white'}`}>Agendar com Horário</p><p className="text-[10px] text-zinc-500">Há horário disponível</p></div>
                  </div>
                </button>
                <button onClick={()=>{setWalkInMode('queue');setWalkInStep('form');}} className={`w-full p-4 rounded-2xl border-2 text-left transition-colors hover:border-orange-500 ${isLight?'border-zinc-200 bg-zinc-50':'border-white/10 bg-white/5'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0"><Hourglass size={16} className="text-orange-400"/></div>
                    <div><p className={`font-black text-sm ${isLight?'text-zinc-900':'text-white'}`}>Fila de Encaixe / Espera</p><p className="text-[10px] text-zinc-500">Agenda cheia — entrar na fila</p></div>
                  </div>
                </button>
              </div>
            )}

            {walkInStep==='form' && (
              <div className="space-y-4">
                {/* Tem cadastro? */}
                <div>
                  <p className={lbl}>O cliente tem cadastro?</p>
                  <div className="flex gap-2">
                    <button onClick={()=>setWalkInHasAcc(true)} className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase transition-colors ${walkInHasAcc===true?'bg-[#C58A4A] text-black border-[#C58A4A]':isLight?'border-zinc-300 text-zinc-700 hover:border-zinc-500':'border-white/10 text-zinc-400 hover:border-white/20'}`}>Sim</button>
                    <button onClick={()=>{setWalkInHasAcc(false);setWalkInData(d=>({...d,clientId:''}));}} className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase transition-colors ${walkInHasAcc===false?'bg-orange-500 text-white border-orange-500':isLight?'border-zinc-300 text-zinc-700 hover:border-zinc-500':'border-white/10 text-zinc-400 hover:border-white/20'}`}>Não</button>
                  </div>
                </div>

                {walkInHasAcc===true && (
                  <div><label className={lbl}>Selecionar Cliente</label>
                    <select value={walkInData.clientId} onChange={e=>setWalkInData(d=>({...d,clientId:e.target.value}))} className={inp()} style={selStyle}>
                      <option value="">Selecione o cliente</option>
                      {clients.map(c=><option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                    </select>
                  </div>
                )}

                {walkInHasAcc===false && (
                  <div className={`p-4 rounded-2xl border space-y-3 ${isLight?'bg-zinc-50 border-zinc-200':'border-white/10'}`} style={{backgroundColor: isLight ? '#fafaf9' : 'rgba(255,255,255,0.04)' }}>
                    <p className="text-[9px] font-black uppercase text-[#C58A4A]">Cadastro Rápido</p>
                    <div><label className={lbl}>Nome Completo *</label><input type="text" placeholder="Ex: Carlos Alberto" value={walkInNew.name} onChange={e=>setWalkInNew(d=>({...d,name:e.target.value}))} className={inp()}/></div>
                    <div><label className={lbl}>WhatsApp / Celular</label><input type="tel" placeholder="(21) 99999-9999" value={walkInNew.phone} onChange={e=>setWalkInNew(d=>({...d,phone:e.target.value}))} className={inp()}/></div>
                    <div><label className={lbl}>E-mail</label><input type="email" placeholder="email@provedor.com" value={walkInNew.email} onChange={e=>setWalkInNew(d=>({...d,email:e.target.value}))} className={inp()}/></div>
                    <div>
                      <label className={lbl}>Senha do Portal <span className="normal-case font-medium opacity-60">(opcional)</span></label>
                      <div className="relative">
                        <input type={showWIPwd?'text':'password'} placeholder="Deixe vazio para definir depois" value={walkInNew.password} onChange={e=>setWalkInNew(d=>({...d,password:e.target.value}))} className={inp('pr-12')}/>
                        <button type="button" onClick={()=>setShowWIPwd(!showWIPwd)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${isLight?'text-zinc-500':'text-zinc-500'}`}>{showWIPwd?<EyeOff size={15}/>:<Eye size={15}/>}</button>
                      </div>
                      {!walkInNew.password && <p className={`text-[9px] ml-1 mt-1 ${isLight?'text-zinc-500':'text-zinc-600'}`}>💡 Sem senha: cliente define no primeiro acesso ao portal.</p>}
                    </div>
                  </div>
                )}

                <div><label className={lbl}>Serviço</label>
                  <select value={walkInData.serviceId} onChange={e=>setWalkInData(d=>({...d,serviceId:e.target.value}))} className={inp()} style={selStyle}>
                    <option value="">Selecione o serviço</option>
                    {services.filter(s=>s.status==='ATIVO').map(s=><option key={s.id} value={s.id}>{s.name} · R$ {s.price} · {s.durationMinutes}min</option>)}
                  </select>
                </div>

                <div>
                  <label className={lbl}>Barbeiro {walkInMode==='queue'?'(opcional)':''}</label>
                  <select value={walkInData.professionalId} onChange={e=>setWalkInData(d=>({...d,professionalId:e.target.value}))} className={inp()} style={selStyle}>
                    <option value="">{walkInMode==='queue'?'Qualquer disponível':'Selecione o barbeiro'}</option>
                    {professionals.map(p=><option key={p.id} value={p.id}>{p.name}{(p as any).isMaster?' ★ Master':''}{(p as any).isMaster&&getMasterSurcharge(p.id)>0?` (+R$${getMasterSurcharge(p.id)})`:''}</option>)}
                  </select>
                  {walkInData.professionalId && getMasterSurcharge(walkInData.professionalId)>0 && (
                    <p className="text-[9px] font-black text-amber-500 flex items-center gap-1 mt-1 ml-1"><Crown size={9}/>Barbeiro Master — +R$ {getMasterSurcharge(walkInData.professionalId).toFixed(2)}</p>
                  )}
                  {walkInData.serviceId && walkInData.professionalId && (
                    <p className="text-[10px] font-black text-[#C58A4A] mt-1 ml-1">Total: R$ {getPrice(walkInData.serviceId, walkInData.professionalId).toFixed(2)}</p>
                  )}
                </div>

                {walkInMode==='schedule' && (
                  <div><label className={lbl}>Horário</label><input type="time" value={walkInData.startTime} onChange={e=>setWalkInData(d=>({...d,startTime:e.target.value}))} className={inp()}/></div>
                )}

                {walkInMode==='schedule' && !hasAvailableSlot && (
                  <div className={`flex items-center gap-3 p-3 rounded-2xl border ${isLight?'bg-amber-50 border-amber-300':'bg-amber-500/10 border-amber-500/30'}`}>
                    <AlertCircle size={14} className="text-amber-500 shrink-0"/>
                    <div><p className="text-[10px] font-black text-amber-600">Agenda lotada</p><button onClick={()=>setWalkInMode('queue')} className="text-[9px] text-amber-500 underline font-bold mt-0.5">Usar fila de espera →</button></div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={()=>setWalkInStep('choose')} className={`flex-1 py-3.5 rounded-xl font-black uppercase text-[9px] transition-colors ${isLight?'bg-zinc-100 text-zinc-700 hover:bg-zinc-200':'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>Voltar</button>
                  {walkInMode==='schedule' ? (
                    <button onClick={handleWalkInSchedule} disabled={saving||!walkInData.serviceId||(!walkInData.clientId&&!walkInNew.name)||walkInHasAcc===null||!walkInData.professionalId} className="flex-1 gradiente-ouro text-black py-3.5 rounded-xl font-black uppercase text-[9px] disabled:opacity-40 disabled:cursor-not-allowed">
                      {saving?'Salvando...':'Agendar Agora'}
                    </button>
                  ):(
                    <button onClick={handleAddToQueue} disabled={saving||!walkInData.serviceId||(!walkInData.clientId&&!walkInNew.name)||walkInHasAcc===null} className="flex-1 bg-orange-500 text-white py-3.5 rounded-xl font-black uppercase text-[9px] disabled:opacity-40 disabled:cursor-not-allowed">
                      {saving?'Salvando...':'Entrar na Fila'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL: Reagendar ══════════════════════════════════ */}
      {showRescheduleModal && (
        <div className={`fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in-95 ${isLight?'bg-black/60':'bg-black/90'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl ${isLight?'text-zinc-900':'text-white'}`} style={modalStyle}>
            <div className="text-center">
              <h2 className={`text-xl font-black font-display italic ${isLight?'text-zinc-900':'text-white'}`}>Reagendar</h2>
              <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isLight?'text-zinc-500':'text-zinc-400'}`}>{showRescheduleModal.clientName}</p>
            </div>
            <div className="space-y-3">
              <input type="date" value={rescheduleData.date} onChange={e=>setRescheduleData({...rescheduleData,date:e.target.value})} className={inp()}/>
              <input type="time" value={rescheduleData.time} onChange={e=>setRescheduleData({...rescheduleData,time:e.target.value})} className={inp()}/>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowRescheduleModal(null)} className={`flex-1 py-4 rounded-xl font-black uppercase text-[9px] transition-colors ${isLight?'bg-zinc-100 text-zinc-700 hover:bg-zinc-200':'bg-white/5 text-zinc-500 hover:bg-white/10'}`}>Cancelar</button>
              <button onClick={handleReschedule} className="flex-1 gradiente-ouro text-black py-4 rounded-xl font-black uppercase text-[9px]">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Novo Agendamento Normal ════════════════════ */}
      {showAddModal && (
        <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center backdrop-blur-xl animate-in fade-in ${isLight?'bg-black/60':'bg-black/90'}`}>
          <div className={`w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide ${modalCard}`} style={modalStyle}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-black font-display italic ${isLight?'text-zinc-900':'text-white'}`}>Novo Agendamento</h2>
              <button onClick={()=>setShowAddModal(false)} className={`p-2 rounded-xl transition-colors ${isLight?'bg-zinc-100 hover:bg-zinc-200 text-zinc-600':'bg-white/5 hover:bg-white/10 text-zinc-400'}`}><X size={18}/></button>
            </div>
            <form onSubmit={handleCreateAppointment} className="space-y-4">
              {/* Cliente */}
              <div>
                <label className={lbl}>Cliente</label>
                <div className="flex gap-2">
                  <select required value={newApp.clientId} onChange={e=>setNewApp({...newApp,clientId:e.target.value})} className={inp()} style={selStyle}>
                    <option value="">Selecione o cliente</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" onClick={()=>setShowQuickClient(true)} className="p-4 bg-[#C58A4A] text-black rounded-2xl hover:scale-105 transition-all shrink-0"><UserPlus size={17}/></button>
                </div>
              </div>

              {/* Cadastro rápido — mesmos campos da página Membros */}
              {showQuickClient && (
                <div className={`p-4 rounded-2xl border space-y-3 animate-in slide-in-from-top-2 ${isLight?'bg-zinc-50 border-[#C58A4A]/30':'border-[#C58A4A]/30'}`} style={{backgroundColor: isLight ? '#fafaf9' : 'rgba(255,255,255,0.04)' }}>
                  <p className="text-[9px] font-black uppercase text-[#C58A4A]">Cadastro Rápido — Novo Membro</p>
                  <div><label className={lbl}>Nome Completo *</label><input type="text" placeholder="Ex: Carlos Alberto" value={quickClient.name} onChange={e=>setQuickClient({...quickClient,name:e.target.value})} className={inp()}/></div>
                  <div><label className={lbl}>WhatsApp / Celular *</label><input type="tel" placeholder="(21) 99999-9999" value={quickClient.phone} onChange={e=>setQuickClient({...quickClient,phone:e.target.value})} className={inp()}/></div>
                  <div><label className={lbl}>E-mail Corporativo</label><input type="email" placeholder="email@provedor.com" value={quickClient.email} onChange={e=>setQuickClient({...quickClient,email:e.target.value})} className={inp()}/></div>
                  <div>
                    <label className={lbl}>Senha do Portal <span className="normal-case font-medium opacity-60">(opcional — cliente pode definir depois)</span></label>
                    <div className="relative">
                      <input type={showQCPwd?'text':'password'} placeholder="Deixe vazio para o cliente definir no primeiro acesso" value={quickClient.password} onChange={e=>setQuickClient({...quickClient,password:e.target.value})} className={inp('pr-12')}/>
                      <button type="button" onClick={()=>setShowQCPwd(!showQCPwd)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${isLight?'text-zinc-500':'text-zinc-500'}`}>{showQCPwd?<EyeOff size={15}/>:<Eye size={15}/>}</button>
                    </div>
                    {!quickClient.password && <p className={`text-[9px] ml-1 mt-1 ${isLight?'text-zinc-500':'text-zinc-600'}`}>💡 Sem senha: o cliente define a própria senha no primeiro acesso ao portal.</p>}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setShowQuickClient(false)} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-colors ${isLight?'bg-zinc-200 text-zinc-700 hover:bg-zinc-300':'bg-white/5 text-zinc-500 hover:bg-white/10'}`}>Fechar</button>
                    <button type="button" onClick={handleQuickClient} className="flex-1 bg-[#C58A4A] text-black py-2.5 rounded-xl text-[9px] font-black uppercase">Salvar Membro</button>
                  </div>
                </div>
              )}

              {/* Barbeiro */}
              <div>
                <label className={lbl}>Barbeiro</label>
                <select required value={newApp.professionalId} onChange={e=>setNewApp({...newApp,professionalId:e.target.value})} className={inp()} style={selStyle}>
                  <option value="">Selecione o barbeiro</option>
                  {professionals.map(p=><option key={p.id} value={p.id}>{p.name}{(p as any).isMaster?' ★ Master':''}{(p as any).isMaster&&getMasterSurcharge(p.id)>0?` (+R$${getMasterSurcharge(p.id)})`:''}</option>)}
                </select>
                {newApp.professionalId && getMasterSurcharge(newApp.professionalId)>0 && (
                  <p className="text-[9px] font-black text-amber-500 flex items-center gap-1 mt-1 ml-1"><Crown size={9}/>Barbeiro Master — +R$ {getMasterSurcharge(newApp.professionalId).toFixed(2)}</p>
                )}
              </div>

              {/* Serviço */}
              <div>
                <label className={lbl}>Serviço</label>
                <select required value={newApp.serviceId} onChange={e=>setNewApp({...newApp,serviceId:e.target.value})} className={inp()} style={selStyle}>
                  <option value="">Selecione o serviço</option>
                  {services.map(s=><option key={s.id} value={s.id}>{s.name} · R$ {newApp.professionalId?getPrice(s.id,newApp.professionalId).toFixed(2):s.price.toFixed(2)}</option>)}
                </select>
                {newApp.serviceId && newApp.professionalId && getMasterSurcharge(newApp.professionalId)>0 && (
                  <p className="text-[10px] font-black text-[#C58A4A] mt-1 ml-1">Total: R$ {getPrice(newApp.serviceId,newApp.professionalId).toFixed(2)}</p>
                )}
              </div>

              {/* Horário */}
              <div>
                <label className={lbl}>Horário</label>
                <input required type="time" value={newApp.startTime} onChange={e=>setNewApp({...newApp,startTime:e.target.value})} className={inp()}/>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowAddModal(false)} className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] transition-colors ${isLight?'bg-zinc-100 text-zinc-700 hover:bg-zinc-200':'bg-white/5 text-zinc-500 hover:bg-white/10'}`}>Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 gradiente-ouro text-black py-4 rounded-xl font-black uppercase text-[10px] disabled:opacity-60">{saving?'Salvando...':'Agendar Agora'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: Detalhes ════════════════════════════════════ */}
      {showDetailModal && (()=>{
        const app = showDetailModal;
        const client = clients.find(c=>c.name===app.clientName||c.phone===app.clientPhone);
        const service = services.find(s=>s.id===app.serviceId);
        const statusLabel = app.status==='CONCLUIDO_PAGO'?'Concluído e Pago':app.status==='CANCELADO'?'Cancelado':'Pendente';
        const statusColor = app.status==='CONCLUIDO_PAGO'?'text-emerald-600 bg-emerald-500/10 border-emerald-500/30':app.status==='CANCELADO'?'text-red-500 bg-red-500/10 border-red-500/30':'text-[#C58A4A] bg-[#C58A4A]/10 border-[#C58A4A]/30';
        return (
          <div className={`fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-xl animate-in zoom-in-95 ${isLight?'bg-black/60':'bg-black/90'}`}>
            <div className={`w-full max-w-md rounded-[2.5rem] p-6 space-y-4 shadow-2xl ${isLight?'text-zinc-900':'text-white'}`} style={modalStyle}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A] mb-0.5">Detalhes</p>
                  <h2 className={`text-xl font-black font-display italic ${isLight?'text-zinc-900':'text-white'}`}>{app.clientName}</h2>
                </div>
                <button onClick={()=>setShowDetailModal(null)} className={`p-2 rounded-xl transition-colors ${isLight?'bg-zinc-100 hover:bg-zinc-200 text-zinc-600':'bg-white/5 hover:bg-white/10 text-zinc-400'}`}><X size={18}/></button>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase ${statusColor}`}>
                {app.status==='CONCLUIDO_PAGO'?<Check size={10}/>:app.status==='CANCELADO'?<X size={10}/>:<Clock size={10}/>} {statusLabel}
              </div>
              <div className="space-y-2">
                {[
                  {icon:<Scissors size={13} className="text-[#C58A4A]"/>, label:'Serviço', value:`${app.serviceName}${service?` · ${service.durationMinutes}min`:''} · R$ ${app.price?.toFixed(2)}`},
                  {icon:<User size={13} className="text-[#C58A4A]"/>, label:'Profissional', value:app.professionalName},
                  {icon:<Calendar size={13} className="text-[#C58A4A]"/>, label:'Data e Horário', value:`${formatDateLabel(app.date)} · ${app.startTime} – ${app.endTime}`},
                ].map(item=>(
                  <div key={item.label} className={`flex items-center gap-3 p-3 rounded-2xl ${isLight?'bg-zinc-50':'bg-white/5'}`}>
                    {item.icon}
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest ${isLight?'text-zinc-500':'text-zinc-500'}`}>{item.label}</p>
                      <p className={`text-sm font-black ${isLight?'text-zinc-900':'text-white'}`}>{item.value}</p>
                    </div>
                  </div>
                ))}
                {client?.phone && (
                  <div className={`flex items-center gap-3 p-3 rounded-2xl ${isLight?'bg-zinc-50':'bg-white/5'}`}>
                    <Phone size={13} className="text-[#C58A4A]"/>
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest ${isLight?'text-zinc-500':'text-zinc-500'}`}>WhatsApp</p>
                      <a href={`https://wa.me/55${client.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-sm font-black text-[#C58A4A] hover:underline">{client.phone}</a>
                    </div>
                  </div>
                )}
                {client?.email && (
                  <div className={`flex items-center gap-3 p-3 rounded-2xl ${isLight?'bg-zinc-50':'bg-white/5'}`}>
                    <Mail size={13} className="text-[#C58A4A]"/>
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest ${isLight?'text-zinc-500':'text-zinc-500'}`}>E-mail</p>
                      <p className={`text-sm font-black ${isLight?'text-zinc-900':'text-white'}`}>{client.email}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={()=>{setShowDetailModal(null);setShowRescheduleModal(app);}} className={`flex-1 py-3 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-1.5 border transition-colors ${isLight?'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200':'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`}><RefreshCw size={11}/>Reagendar</button>
                <button onClick={()=>{updateAppointmentStatus(app.id,app.status==='CONCLUIDO_PAGO'?'PENDENTE':'CONCLUIDO_PAGO');setShowDetailModal(null);}} className={`flex-1 py-3 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-1.5 border transition-colors ${app.status==='CONCLUIDO_PAGO'?isLight?'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200':'bg-white/10 border-white/10 text-zinc-300 hover:bg-white/15':'gradiente-ouro text-black border-transparent'}`}><DollarSign size={11}/>{app.status==='CONCLUIDO_PAGO'?'Voltar Pendente':'Marcar Pago'}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Appointments;
