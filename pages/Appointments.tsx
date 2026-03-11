import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Clock, Check, X, CreditCard,
  Calendar, Scissors, LayoutGrid, List, UserPlus, DollarSign, RefreshCw, Filter, CalendarRange, Phone, Mail, User, Banknote
} from 'lucide-react';
import { useBarberStore } from '../store';
import { Appointment, Client } from '../types';

const NOTIFICATION_SOUND_URL = 'https://raw.githubusercontent.com/DavidFranco135/iphone/main/iphone.mp3';

// ─── Helpers de data — sem new Date(string) para evitar bug UTC/fuso ──────
const getTodayString = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatDateLabel = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};
const shiftDate = (dateStr: string, delta: number): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatMonthLabel = (monthStr: string): string => {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

// ─── Áudio: variáveis globais fora do componente ──────────────────────────
let audioCtx: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let audioBufferLoading = false;
let audioReady = false;
let notifDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

const preloadAudio = async (): Promise<void> => {
  if (audioReady || audioBufferLoading) return;
  audioBufferLoading = true;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const response = await fetch(NOTIFICATION_SOUND_URL);
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioReady = true;
  } catch (_) { audioBufferLoading = false; }
};

const playNotificationSound = async (): Promise<void> => {
  if (!audioReady || !audioBuffer) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (_) {}
};

// ─── Coordenação entre abas via localStorage ─────────────────────────────
// Problema: admin em 2 abas (ou cliente + admin) → Firestore dispara onSnapshot
// em TODAS ao mesmo tempo → som toca múltiplas vezes.
// Solução: a primeira aba a escrever o timestamp "vence" e toca o som.
// As demais checam que já foi tocado e ficam em silêncio.
const SOUND_LS_KEY = 'brb_last_notif_ts';

const scheduleNotificationSound = (): void => {
  if (notifDebounceTimer) clearTimeout(notifDebounceTimer);
  notifDebounceTimer = setTimeout(() => {
    const now = Date.now();
    const lastTs = parseInt(localStorage.getItem(SOUND_LS_KEY) || '0', 10);
    // Se outra aba já tocou nos últimos 6 s, esta fica em silêncio
    if (now - lastTs < 6000) {
      notifDebounceTimer = null;
      return;
    }
    // Esta aba venceu — registra e toca
    localStorage.setItem(SOUND_LS_KEY, String(now));
    playNotificationSound();
    notifDebounceTimer = null;
  }, 400);
};

const Appointments: React.FC = () => {
  const { 
    appointments, professionals, services, clients, user, notifications,
    addAppointment, markNoShow, updateAppointmentStatus, deleteAppointment, addClient, rescheduleAppointment, finalizeAppointment, theme
  } = useBarberStore() as any;
  const isDark = theme !== 'light';

  // ── Referência ao momento em que o componente montou.
  // Só notificações com timestamp POSTERIOR ao mount são consideradas "novas".
  const mountTimeRef = useRef<number>(Date.now());
  const prevNotifCountRef = useRef<number | null>(null);

  // ── Pré-carrega áudio ao montar (admin já navegou até aqui, contexto permitido)
  useEffect(() => { preloadAudio(); }, []);

  // ── Data correta no fuso local, atualiza na virada de meia-noite
  useEffect(() => {
    const tick = () => setCurrentDate(getTodayString());
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  // ── Som: apenas para ADMIN, apenas para agendamentos públicos (do cliente).
  //
  // POR QUÊ RASTREAR NOTIFICAÇÕES e não appointments.length?
  //  1. Notificações type='appointment' só são criadas quando isPublic=true,
  //     ou seja, apenas quando o CLIENTE agenda — o admin criando pelo painel NÃO dispara.
  //  2. Usar mountTimeRef evita o falso-positivo da carga inicial: notificações
  //     já existentes no Firestore têm timestamp anterior ao mount e são ignoradas,
  //     enquanto notificações realmente novas têm timestamp posterior e disparam o som.
  //  3. Isso elimina o duplo toque causado pela race condition entre o mount do
  //     componente (prevRef = 0) e a chegada assíncrona dos agendamentos existentes.
  useEffect(() => {
    if (user?.role !== 'ADMIN') return;

    const appointmentNotifs = notifications.filter(n => n.type === 'appointment');

    // Inicialização: registra a contagem atual sem tocar som
    if (prevNotifCountRef.current === null) {
      prevNotifCountRef.current = appointmentNotifs.length;
      return;
    }

    // Só toca se chegou uma notificação NOVA (posterior ao mount deste componente)
    if (appointmentNotifs.length > prevNotifCountRef.current) {
      const hasRecentNotif = appointmentNotifs.some(
        n => new Date(n.time).getTime() > mountTimeRef.current
      );
      if (hasRecentNotif) {
        scheduleNotificationSound();
      }
    }

    prevNotifCountRef.current = appointmentNotifs.length;
  }, [notifications, user]);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [compactView, setCompactView] = useState(false);
  const [currentDate, setCurrentDate] = useState<string>(getTodayString);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<Appointment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<Appointment | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [newApp, setNewApp] = useState({ clientId: '', serviceId: '', professionalId: '', startTime: '09:00' });
  const [quickClient, setQuickClient] = useState({ name: '', phone: '', email: '', cpfCnpj: '' });
  // ── Modal Finalização ──────────────────────────────────────
  const [finModal, setFinModal] = useState<any>(null);
  const [finAdditionals, setFinAdditionals] = useState<{id:string;name:string;price:number;qty:number}[]>([]);
  const [finPayMethod, setFinPayMethod] = useState<'PIX'|'LINK'|'DINHEIRO'|'CARTAO'>('PIX');
  const [finNewItem, setFinNewItem] = useState({ name: '', price: '' });
  const [finLoading, setFinLoading] = useState(false);
  const [finResult, setFinResult] = useState<{pixCode?:string;pixQrCode?:string;paymentLink?:string}|null>(null);

  // ── Handlers do modal de finalização ──────────────────────
  const openFinModal = (app: any) => {
    setFinModal(app);
    setFinAdditionals([]);
    setFinPayMethod('PIX');
    setFinNewItem({ name: '', price: '' });
    setFinResult(null);
  };

  const handleFinalize = async () => {
    if (!finModal) return;
    setFinLoading(true);
    try {
      const result = await (finalizeAppointment as any)(finModal.id, finAdditionals, finPayMethod);
      if (result?.paymentLink) {
        window.open(result.paymentLink, '_blank');
      }
      setFinResult(result || { _method: finPayMethod });
    } catch(e) {
      console.error('Finalize error:', e);
      setFinResult({ _method: finPayMethod });
    } finally { setFinLoading(false); }
  };

  const addFinItem = () => {
    if (!finNewItem.name || !finNewItem.price) return;
    setFinAdditionals(prev => [...prev, {
      id: Date.now().toString(),
      name: finNewItem.name,
      price: parseFloat(finNewItem.price) || 0,
      qty: 1,
    }]);
    setFinNewItem({ name: '', price: '' });
  };

  const finTotal = (finModal?.price || 0) + finAdditionals.reduce((s,a) => s + a.price * a.qty, 0);
  const [filterPeriod, setFilterPeriod] = useState<'day' | 'month' | 'all'>('day');
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

  const hoursNormal = useMemo(() => Array.from({ length: 14 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`), []);
  const hoursCompact = useMemo(() => Array.from({ length: 15 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`), []);
  const hours = compactView ? hoursCompact : hoursNormal;
  const appointmentsToday = useMemo(() => appointments.filter(a => a.date === currentDate), [appointments, currentDate]);
  
  const appointmentsFiltered = useMemo(() => {
    if (filterPeriod === 'day') {
      return appointments.filter(a => a.date === currentDate);
    } else if (filterPeriod === 'month') {
      return appointments.filter(a => a.date.startsWith(selectedMonth));
    } else {
      return appointments;
    }
  }, [appointments, currentDate, selectedMonth, filterPeriod]);

  const handleQuickClient = async () => {
    if(!quickClient.name || !quickClient.phone) return alert("Preencha nome e telefone");
    const client = await addClient({ ...quickClient, email: quickClient.email });
    setNewApp({...newApp, clientId: client.id});
    setShowQuickClient(false);
    setQuickClient({ name: '', phone: '', email: '' });
  };

  // NOVA FUNÇÃO: Criar agendamento ao clicar em um horário vazio
  const handleClickEmptySlot = (professionalId: string, timeSlot: string) => {
    setNewApp({
      ...newApp,
      professionalId: professionalId,
      startTime: timeSlot
    });
    setShowAddModal(true);
  };

  const handleCreateAppointment = async () => {
    try {
      const service = services.find(s => s.id === newApp.serviceId);
      if (!service) return;
      const [h, m] = newApp.startTime.split(':').map(Number);
      const totalMinutes = h * 60 + m + service.durationMinutes;
      const endTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
      await addAppointment({ ...newApp, clientName: clients.find(c => c.id === newApp.clientId)?.name || '', clientPhone: clients.find(c => c.id === newApp.clientId)?.phone || '', serviceName: service.name, professionalName: professionals.find(p => p.id === newApp.professionalId)?.name || '', date: currentDate, endTime, price: service.price });
      setShowAddModal(false);
    } catch (err) { alert("Erro ao agendar."); }
  };

  const handleReschedule = () => {
    if (showRescheduleModal && rescheduleData.date && rescheduleData.time) {
      const service = services.find(s => s.id === showRescheduleModal.serviceId);
      const [h, m] = rescheduleData.time.split(':').map(Number);
      const endTime = `${Math.floor((h * 60 + m + (service?.durationMinutes || 30)) / 60).toString().padStart(2, '0')}:${((h * 60 + m + (service?.durationMinutes || 30)) % 60).toString().padStart(2, '0')}`;
      rescheduleAppointment(showRescheduleModal.id, rescheduleData.date, rescheduleData.time, endTime);
      setShowRescheduleModal(null);
    }
  };

  return (

    <div className="h-full flex flex-col space-y-4 animate-in fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Agenda Digital</h1>
          <div className="flex gap-2 mt-2">
             <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-[#C58A4A] text-black' : 'bg-white/5 text-zinc-500'}`}><LayoutGrid size={16}/></button>
             <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-[#C58A4A] text-black' : 'bg-white/5 text-zinc-500'}`}><List size={16}/></button>
             {viewMode === 'grid' && (
               <button 
                 onClick={() => {
                   setCompactView(!compactView);
                   if (!compactView) {
                     document.documentElement.requestFullscreen?.();
                   } else {
                     document.exitFullscreen?.();
                   }
                 }} 
                 className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase ${compactView ? 'bg-purple-600 text-white' : 'bg-white/5 text-zinc-500'}`}
               >
                 Compacto
               </button>
             )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setFilterPeriod('day')} 
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterPeriod === 'day' ? 'bg-[#C58A4A] text-black' : theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}
            >
              Dia
            </button>
            <button 
              onClick={() => setFilterPeriod('month')} 
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterPeriod === 'month' ? 'bg-[#C58A4A] text-black' : theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}
            >
              Mês
            </button>
            <button 
              onClick={() => setFilterPeriod('all')} 
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterPeriod === 'all' ? 'bg-[#C58A4A] text-black' : theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}
            >
              Todos
            </button>
          </div>
          
          {filterPeriod === 'day' && (
            <div className={`flex items-center border rounded-xl p-1 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/10'}`}>
              <button onClick={() => setCurrentDate(prev => shiftDate(prev, -1))} className={`p-2 transition-all ${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'}`}><ChevronLeft size={20} /></button>
              <span className={`px-4 text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>{formatDateLabel(currentDate)}</span>
              <button onClick={() => setCurrentDate(prev => shiftDate(prev, +1))} className={`p-2 transition-all ${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'}`}><ChevronRight size={20} /></button>
            </div>
          )}
          
          {filterPeriod === 'month' && (
            <div className={`flex items-center border rounded-xl p-1 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/10'}`}>
              <button 
                onClick={() => { 
                  const [year, month] = selectedMonth.split('-').map(Number);
                  const d = new Date(year, month - 2, 1);
                  setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }} 
                className={`p-2 transition-all ${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'}`}
              >
                <ChevronLeft size={20} />
              </button>
              <span className={`px-4 text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>
                {formatMonthLabel(selectedMonth)}
              </span>
              <button 
                onClick={() => { 
                  const [year, month] = selectedMonth.split('-').map(Number);
                  const d = new Date(year, month, 1);
                  setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }} 
                className={`p-2 transition-all ${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'}`}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
          
          <button onClick={() => setShowAddModal(true)} className="gradiente-ouro text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Agendar +</button>
        </div>
      </div>

      <div className={`flex-1 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border ${theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-white/5'}`}>
        {viewMode === 'grid' ? (
          <div className={`overflow-auto h-full scrollbar-hide ${compactView ? '' : ''}`}>
            <div className={compactView ? 'min-w-[320px]' : 'min-w-[500px]'} style={{minWidth: compactView ? `${60 + professionals.length * 100}px` : `${80 + professionals.length * 160}px`}}>
              {/* CABEÇALHO: Reduzido padding vertical */}
              <div className={`border-b sticky top-0 z-10 ${theme === 'light' ? 'border-zinc-200 bg-zinc-50' : 'border-white/5 bg-white/[0.02]'}`} style={{display:'grid', gridTemplateColumns: compactView ? `60px repeat(${professionals.length}, 1fr)` : `80px repeat(${professionals.length}, 1fr)`}}>
                <div className={`flex items-center justify-center text-zinc-500 ${compactView ? 'p-2' : 'p-3'}`}><Clock size={compactView ? 14 : 18} /></div>
                {professionals.map(prof => (
                  <div key={prof.id} className={`flex items-center justify-center gap-3 border-r border-white/5 ${compactView ? 'p-2 flex-col' : 'p-3'}`}>
                    <img src={prof.avatar} className={`rounded-lg object-cover border border-[#C58A4A] ${compactView ? 'w-6 h-6' : 'w-8 h-8'}`} alt="" />
                    <span className={`font-black uppercase tracking-widest ${compactView ? 'text-[8px]' : 'text-[10px]'}`}>{prof.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
              {/* LINHAS DE HORÁRIO: Altura reduzida de 100px/50px para 60px/35px */}
              {hours.map(hour => (
                <div key={hour} className={`border-b ${theme === 'light' ? 'border-zinc-100' : 'border-white/[0.03]'} ${compactView ? 'min-h-[32px]' : 'min-h-[64px]'}`} style={{display:'grid', gridTemplateColumns: compactView ? `60px repeat(${professionals.length}, 1fr)` : `80px repeat(${professionals.length}, 1fr)`}}>
                  <div className={`flex items-center justify-center border-r ${theme === 'light' ? 'border-zinc-200 bg-zinc-50/50' : 'border-white/5 bg-white/[0.01]'}`}><span className={`font-black ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'} ${compactView ? 'text-[9px]' : 'text-[10px]'}`}>{hour}</span></div>
                  {professionals.map(prof => {
                    const app = appointmentsToday.find(a => a.professionalId === prof.id && a.startTime.split(':')[0] === hour.split(':')[0] && a.status !== 'CANCELADO');
                    return (
                      <div 
                        key={prof.id} 
                        className={`border-r last:border-r-0 ${theme === 'light' ? 'border-zinc-200' : 'border-white/5'} ${compactView ? 'p-1' : 'p-1.5'} ${!app ? 'cursor-pointer hover:bg-white/5 transition-all' : ''}`}
                        onClick={() => !app && handleClickEmptySlot(prof.id, hour)}
                        title={!app ? `Clique para agendar às ${hour}` : ''}
                      >
                        {app ? (
                          <div className={`h-full w-full rounded-2xl border flex flex-col justify-between transition-all group ${app.status === 'CONCLUIDO_PAGO' ? 'border-emerald-500/40 bg-emerald-500/10' : app.status === 'NAO_COMPARECEU' ? 'border-red-500/40 bg-red-500/10' : app.awaitingOnlinePayment ? 'border-blue-400/50 bg-blue-500/10' : 'border-[#C58A4A]/30 bg-[#C58A4A]/5'} ${compactView ? 'p-1.5 rounded-lg' : 'p-2'}`}>
                            <div className="truncate" onClick={(e) => { e.stopPropagation(); setShowDetailModal(app); }} style={{cursor:'pointer'}}>
                              <div className="flex items-center gap-1">
                                <h4 className={`font-black uppercase truncate hover:text-[#C58A4A] transition-colors ${compactView ? 'text-[8px]' : 'text-[10px]'} ${app.status === 'NAO_COMPARECEU' ? 'text-red-400' : theme === 'light' ? 'text-zinc-900' : 'text-white'}`}
                                  title="Ver detalhes"
                                >{app.clientName}</h4>
                                {app.status === 'CONCLUIDO_PAGO' && (
                                  <span title="Pago" className="flex-shrink-0">
                                    <Check size={compactView ? 8 : 10} className="text-emerald-400" />
                                  </span>
                                )}
                                {app.awaitingOnlinePayment && app.status !== 'CONCLUIDO_PAGO' && (
                                  <span title="Aguardando pagamento online" className="animate-pulse flex-shrink-0">
                                    <CreditCard size={compactView ? 8 : 10} className="text-blue-400" />
                                  </span>
                                )}
                                {!app.awaitingOnlinePayment && app.status !== 'CONCLUIDO_PAGO' && app.status !== 'CANCELADO' && app.status !== 'NAO_COMPARECEU' && (
                                  <span title="Pagamento na barbearia" className="animate-pulse flex-shrink-0">
                                    <Banknote size={compactView ? 8 : 10} className="text-amber-400" />
                                  </span>
                                )}
                                {app.status === 'NAO_COMPARECEU' && (
                                  <span title="Não compareceu" className="flex-shrink-0 text-[8px]">🚫</span>
                                )}
                                {app.status !== 'NAO_COMPARECEU' && (() => { const cl = clients.find((cl:any) => cl.id === app.clientId || cl.phone === app.clientPhone); return cl?.requirePrepayment ? <span title="Exige pagamento antecipado" className="flex-shrink-0 text-[8px]">⚠️</span> : null; })()}
                              </div>
                              {!compactView && (
                                <>
                                  <p className="text-[8px] font-black text-[#C58A4A] uppercase mt-0.5 truncate">{app.serviceName}</p>
                                  <p className="text-[7px] text-zinc-500 font-bold mt-0.5">{app.startTime}{app.endTime ? ` – ${app.endTime}` : ''}</p>
                                </>
                              )}
                              {compactView && <p className="text-[7px] text-[#C58A4A]/70 truncate">{app.serviceName}</p>}
                            </div>
                            <div className={`flex items-center justify-end gap-1 ${compactView ? 'mt-0.5' : 'mt-1'}`}>
                               <button 
                                 onClick={(e) => { e.stopPropagation(); app.status === 'CONCLUIDO_PAGO' ? updateAppointmentStatus(app.id, 'PENDENTE') : openFinModal(app); }} 
                                 className={`rounded-lg transition-all ${app.status === 'CONCLUIDO_PAGO' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-zinc-500 hover:text-white'} ${compactView ? 'p-0.5' : 'p-1'}`} 
                                 title={app.status === 'CONCLUIDO_PAGO' ? 'Marcar como Pendente' : 'Finalizar e Pagar'}
                               ><DollarSign size={compactView ? 9 : 11}/></button>
                               <button onClick={(e) => { e.stopPropagation(); setShowRescheduleModal(app); }} className={`bg-white/10 text-zinc-500 hover:text-white rounded-lg transition-all ${compactView ? 'p-0.5' : 'p-1'}`} title="Reagendar"><RefreshCw size={compactView ? 9 : 11}/></button>
                               <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Excluir agendamento de ${app.clientName}?`)) deleteAppointment(app.id); }} className={`bg-white/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all ${compactView ? 'p-0.5' : 'p-1'}`} title="Excluir agendamento"><X size={compactView ? 9 : 11}/></button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-40 transition-opacity">
                            <Plus size={compactView ? 12 : 16} className="text-[#C58A4A]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-3 overflow-y-auto h-full scrollbar-hide">
             {appointmentsFiltered.length === 0 && (
               <p className={`text-center py-20 font-black uppercase text-[10px] italic ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-600'}`}>
                 Nenhum agendamento {filterPeriod === 'day' ? 'para hoje' : filterPeriod === 'month' ? 'neste mês' : 'encontrado'}.
               </p>
             )}
             {appointmentsFiltered.map(app => (
               <div key={app.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-[#C58A4A]/30 transition-all">
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${app.status === 'CONCLUIDO_PAGO' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : app.awaitingOnlinePayment ? 'border-blue-400 text-blue-400 bg-blue-400/10' : 'border-amber-400 text-amber-400 bg-amber-400/10'}`}>
                        {app.status === 'CONCLUIDO_PAGO' ? <Check size={20}/> : app.awaitingOnlinePayment ? <CreditCard size={20} className="text-blue-400 animate-pulse"/> : <Banknote size={20} className="text-amber-400 animate-pulse"/>}
                     </div>
                     <div>
                        <p 
                          className="text-xs font-black cursor-pointer hover:text-[#C58A4A] transition-colors"
                          onClick={() => setShowDetailModal(app)}
                          title="Ver detalhes do agendamento"
                        >{app.clientName} • <span className="text-[#C58A4A]">{app.startTime}</span></p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{app.serviceName} com {app.professionalName}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <button 
                       onClick={() => app.status === 'CONCLUIDO_PAGO' ? updateAppointmentStatus(app.id, 'PENDENTE') : openFinModal(app)} 
                       className={`p-2 rounded-xl border transition-all ${app.status === 'CONCLUIDO_PAGO' ? 'bg-emerald-500 text-white border-transparent' : 'bg-white/5 border-white/10 text-zinc-500 hover:text-white'}`} 
                       title={app.status === 'CONCLUIDO_PAGO' ? 'Marcar como Pendente' : 'Finalizar e Pagar'}
                     ><DollarSign size={16}/></button>
                     <button onClick={() => setShowRescheduleModal(app)} className="p-2 bg-white/5 border border-white/10 text-zinc-500 hover:text-white rounded-xl transition-all" title="Reagendar"><RefreshCw size={16}/></button>
                     <button onClick={() => { if (window.confirm(`Excluir agendamento de ${app.clientName}?`)) deleteAppointment(app.id); }} className="p-2 bg-white/5 border border-white/10 text-zinc-500 hover:text-red-500 hover:border-red-500/30 rounded-xl transition-all" title="Excluir agendamento"><X size={16}/></button>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>

      {/* Modais omitidos por brevidade mas restaurados conforme lógica anterior de novo cliente e novo agendamento */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className="cartao-vidro w-full max-w-sm rounded-[2.5rem] p-10 space-y-8 border-[#C58A4A]/30 shadow-2xl">
             <div className="text-center space-y-2"><h2 className="text-xl font-black font-display italic">Reagendar Ritual</h2><p className="text-[10px] text-zinc-500 uppercase font-black">Escolha novo horário para {showRescheduleModal.clientName}</p></div>
             <div className="space-y-4">
                <input type="date" value={rescheduleData.date} onChange={e => setRescheduleData({...rescheduleData, date: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs font-black" />
                <input type="time" value={rescheduleData.time} onChange={e => setRescheduleData({...rescheduleData, time: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs font-black" />
             </div>
             <div className="flex gap-3">
                <button onClick={() => setShowRescheduleModal(null)} className="flex-1 bg-white/5 py-4 rounded-xl font-black uppercase text-[9px] text-zinc-500">Voltar</button>
                <button onClick={handleReschedule} className="flex-1 gradiente-ouro text-black py-4 rounded-xl font-black uppercase text-[9px]">Confirmar</button>
             </div>
          </div>
        </div>
      )}
      
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className="cartao-vidro w-full max-w-lg rounded-[2.5rem] p-10 space-y-8 border-[#C58A4A]/20 relative">
            <h2 className="text-2xl font-black font-display italic">Novo Agendamento</h2>
            <div className="space-y-6">
               <div className="space-y-4">
                  <div className="flex gap-2">
                    <select required value={newApp.clientId} onChange={e => setNewApp({...newApp, clientId: e.target.value})} className="flex-1 bg-white/5 border border-white/10 p-4 rounded-xl outline-none text-xs font-black uppercase">
                      <option value="" className="bg-zinc-950">Selecione o Cliente</option>
                      {clients.map(c => <option key={c.id} value={c.id} className="bg-zinc-950">{c.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowQuickClient(true)} className="p-4 bg-[#C58A4A] text-black rounded-xl hover:scale-105 transition-all"><UserPlus size={20}/></button>
                  </div>
                  {showQuickClient && (
                    <div className="p-4 bg-white/5 rounded-xl border border-[#C58A4A]/30 space-y-3 animate-in slide-in-from-top-2">
                      <p className="text-[9px] font-black uppercase text-[#C58A4A]">Rápido: Novo Cliente</p>
                      <input type="text" placeholder="Nome" value={quickClient.name} onChange={e => setQuickClient({...quickClient, name: e.target.value})} className="w-full bg-black/20 border border-white/5 p-3 rounded-lg text-xs" />
                      <input type="tel" placeholder="WhatsApp" value={quickClient.phone} onChange={e => setQuickClient({...quickClient, phone: e.target.value})} className="w-full bg-black/20 border border-white/5 p-3 rounded-lg text-xs" />
                      <input type="email" placeholder="E-mail" value={quickClient.email} onChange={e => setQuickClient({...quickClient, email: e.target.value})} className="w-full bg-black/20 border border-white/5 p-3 rounded-lg text-xs" />
                      <input type="text" placeholder="CPF (para cobranças Asaas)" value={quickClient.cpfCnpj} onChange={e => setQuickClient({...quickClient, cpfCnpj: e.target.value})} className="w-full bg-black/20 border border-white/5 p-3 rounded-lg text-xs" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setShowQuickClient(false)} className="flex-1 bg-white/5 text-zinc-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-white/10 transition-all">Fechar</button>
                        <button type="button" onClick={handleQuickClient} className="flex-1 bg-[#C58A4A] text-black py-2 rounded-lg text-[9px] font-black uppercase">Salvar e Selecionar</button>
                      </div>
                    </div>
                  )}
                  <select required value={newApp.professionalId} onChange={e => setNewApp({...newApp, professionalId: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none text-xs font-black uppercase">
                    <option value="" className="bg-zinc-950">Barbeiro</option>
                    {professionals.map(p => <option key={p.id} value={p.id} className="bg-zinc-950">{p.name}</option>)}
                  </select>
                  <select required value={newApp.serviceId} onChange={e => setNewApp({...newApp, serviceId: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none text-xs font-black uppercase">
                    <option value="" className="bg-zinc-950">Serviço</option>
                    {services.map(s => <option key={s.id} value={s.id} className="bg-zinc-950">{s.name} • R$ {s.price}</option>)}
                  </select>
                  <input required type="time" value={newApp.startTime} onChange={e => setNewApp({...newApp, startTime: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none text-xs font-black" />
               </div>
               <div className="flex gap-3">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-white/5 py-4 rounded-xl font-black uppercase text-[10px] text-zinc-500">Cancelar</button>
                  <button type="button" onClick={handleCreateAppointment} onTouchEnd={e => { e.preventDefault(); handleCreateAppointment(); }} className="flex-1 gradiente-ouro text-black py-4 rounded-xl font-black uppercase text-[10px]">Agendar Agora</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Detalhes do Agendamento ───────────────────────────────── */}
      {showDetailModal && (() => {
        const app = showDetailModal;
        const client = clients.find(c => c.name === app.clientName || c.phone === app.clientPhone);
        const service = services.find(s => s.id === app.serviceId);
        const professional = professionals.find(p => p.id === app.professionalId);
        const statusLabel = app.status === 'CONCLUIDO_PAGO' ? 'Concluído e Pago' : app.status === 'CANCELADO' ? 'Cancelado' : app.status === 'NAO_COMPARECEU' ? '🚫 Não Compareceu' : app.awaitingOnlinePayment ? '💳 Pag. Online Pendente' : 'Pendente';
        const statusColor = app.status === 'CONCLUIDO_PAGO' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : app.status === 'CANCELADO' ? 'text-red-400 bg-red-500/10 border-red-500/30' : app.status === 'NAO_COMPARECEU' ? 'text-red-400 bg-red-500/10 border-red-500/30' : app.awaitingOnlinePayment ? 'text-blue-400 bg-blue-500/10 border-blue-400/30' : 'text-[#C58A4A] bg-[#C58A4A]/10 border-[#C58A4A]/30';
        return (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
            <div className={`w-full max-w-md rounded-[2.5rem] p-8 space-y-6 shadow-2xl border ${theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-[#C58A4A]/20'}`}>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A] mb-1">Detalhes do Agendamento</p>
                  <h2 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{app.clientName}</h2>
                </div>
                <button onClick={() => setShowDetailModal(null)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"><X size={20} className="text-zinc-400"/></button>
              </div>

              {/* Status badge */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${statusColor}`}>
                {app.status === 'CONCLUIDO_PAGO' ? <Check size={12}/> : app.status === 'CANCELADO' ? <X size={12}/> : <Clock size={12}/>}
                {statusLabel}
              </div>

              {/* Info grid */}
              <div className="space-y-3">
                <div className={`flex items-center gap-4 p-4 rounded-2xl ${theme === 'light' ? 'bg-zinc-50' : 'bg-white/5'}`}>
                  <Scissors size={16} className="text-[#C58A4A] shrink-0"/>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Serviço</p>
                    <p className={`text-sm font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{app.serviceName}</p>
                    {service && <p className="text-[9px] text-zinc-500 mt-0.5">{service.durationMinutes} min • R$ {app.price?.toFixed(2)}</p>}
                  </div>
                </div>

                <div className={`flex items-center gap-4 p-4 rounded-2xl ${theme === 'light' ? 'bg-zinc-50' : 'bg-white/5'}`}>
                  <User size={16} className="text-[#C58A4A] shrink-0"/>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Profissional</p>
                    <p className={`text-sm font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{app.professionalName}</p>
                  </div>
                </div>

                <div className={`flex items-center gap-4 p-4 rounded-2xl ${theme === 'light' ? 'bg-zinc-50' : 'bg-white/5'}`}>
                  <Calendar size={16} className="text-[#C58A4A] shrink-0"/>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Data e Horário</p>
                    <p className={`text-sm font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{formatDateLabel(app.date)} • {app.startTime} – {app.endTime}</p>
                  </div>
                </div>

                {client?.phone && (
                  <div className={`flex items-center gap-4 p-4 rounded-2xl ${theme === 'light' ? 'bg-zinc-50' : 'bg-white/5'}`}>
                    <Phone size={16} className="text-[#C58A4A] shrink-0"/>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">WhatsApp</p>
                      <a href={`https://wa.me/55${client.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-sm font-black text-[#C58A4A] hover:underline">{client.phone}</a>
                    </div>
                  </div>
                )}

                {client?.email && (
                  <div className={`flex items-center gap-4 p-4 rounded-2xl ${theme === 'light' ? 'bg-zinc-50' : 'bg-white/5'}`}>
                    <Mail size={16} className="text-[#C58A4A] shrink-0"/>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">E-mail</p>
                      <p className={`text-sm font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{client.email}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setShowDetailModal(null); setShowRescheduleModal(app); }} 
                    className="flex-1 bg-white/5 border border-white/10 py-3 rounded-xl font-black uppercase text-[9px] text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={12}/> Reagendar
                  </button>
                  <button 
                    onClick={() => { app.status === 'CONCLUIDO_PAGO' ? updateAppointmentStatus(app.id, 'PENDENTE') : (setShowDetailModal(null), openFinModal(app)); }} 
                    className={`flex-1 py-3 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-2 ${app.status === 'CONCLUIDO_PAGO' ? 'bg-white/10 text-zinc-300 border border-white/10' : 'gradiente-ouro text-black'}`}
                  >
                    <DollarSign size={12}/> {app.status === 'CONCLUIDO_PAGO' ? 'Voltar a Pendente' : 'Finalizar e Pagar'}
                  </button>
                </div>
                {app.status !== 'CONCLUIDO_PAGO' && app.status !== 'NAO_COMPARECEU' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Marcar ${app.clientName} como não compareceu? O próximo agendamento exigirá pagamento antecipado.`)) {
                        markNoShow(app.id);
                        setShowDetailModal(null);
                      }
                    }}
                    className="w-full py-3 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    🚫 Não Compareceu
                  </button>
                )}
                {app.status === 'NAO_COMPARECEU' && (
                  <div className="w-full py-3 rounded-xl text-center text-[9px] font-black uppercase bg-red-500/10 border border-red-500/30 text-red-400">
                    🚫 Marcado como Não Compareceu
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════
          MODAL DE FINALIZAÇÃO — Adicionais + Pagamento Asaas
      ══════════════════════════════════════════════════════ */}
      {finModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ${isDark ? 'bg-[#0f0f0f] border border-white/10' : 'bg-white border border-zinc-200'}`}>
            
            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div>
                <h2 className={`text-xl font-black font-display italic ${isDark ? 'text-white' : 'text-zinc-900'}`}>Finalizar Atendimento</h2>
                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{finModal.clientName} · {finModal.serviceName}</p>
              </div>
              <button onClick={() => setFinModal(null)} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}>✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">

              {finResult ? (
                /* ── Resultado do pagamento ── */
                <div className="space-y-4 text-center">
                  <div className="text-4xl">{(finResult as any)._method === 'DINHEIRO' ? '💵' : '✅'}</div>
                  <p className={`font-black text-lg ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {(finResult as any)._method === 'DINHEIRO' ? 'Pago em dinheiro!' : 'Cobrança gerada!'}
                  </p>
                  <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>R$ {finTotal.toFixed(2)}</p>
                  {(finResult as any)._method === 'DINHEIRO' ? (
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Atendimento concluído e registrado com sucesso.
                    </p>
                  ) : finResult.paymentLink ? (
                    <div className="space-y-2 pt-2">
                      <p className={`text-[10px] font-black uppercase tracking-widest text-blue-400`}>
                        ⏳ Aguardando pagamento do cliente
                      </p>
                      <a href={finResult.paymentLink} target="_blank" rel="noreferrer"
                        className="block w-full gradiente-ouro text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-center shadow-xl">
                        🔗 Abrir cobrança no Asaas
                      </a>
                      <button onClick={() => navigator.clipboard.writeText(finResult!.paymentLink!)}
                        className={`w-full py-3 rounded-xl font-black text-[10px] uppercase border ${isDark ? 'bg-white/5 border-white/10 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}>
                        📋 Copiar link
                      </button>
                    </div>
                  ) : (
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Configure a API do Asaas em Ajustes para gerar cobranças automáticas.
                    </p>
                  )}
                  <button onClick={() => setFinModal(null)} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase border ${isDark ? 'border-white/10 text-zinc-400' : 'border-zinc-200 text-zinc-500'}`}>Fechar</button>
                </div>
              ) : (
                <>
                  {/* ── Serviço base ── */}
                  <div className={`flex items-center justify-between p-4 rounded-2xl ${isDark ? 'bg-white/3 border border-white/5' : 'bg-zinc-50 border border-zinc-100'}`}>
                    <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>{finModal.serviceName}</p>
                    <p className="font-black text-[#C58A4A]">R$ {(finModal.price || 0).toFixed(2)}</p>
                  </div>

                  {/* ── Adicionais existentes ── */}
                  {finAdditionals.length > 0 && (
                    <div className="space-y-2">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Adicionais</p>
                      {finAdditionals.map(item => (
                        <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/3 border border-white/5' : 'bg-zinc-50 border border-zinc-100'}`}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setFinAdditionals(prev => prev.map(a => a.id === item.id ? {...a, qty: Math.max(1, a.qty-1)} : a))} className="w-6 h-6 rounded-lg bg-white/10 text-zinc-400 font-black text-xs flex items-center justify-center">-</button>
                            <span className={`text-xs font-black w-4 text-center ${isDark ? 'text-white' : 'text-zinc-900'}`}>{item.qty}</span>
                            <button onClick={() => setFinAdditionals(prev => prev.map(a => a.id === item.id ? {...a, qty: a.qty+1} : a))} className="w-6 h-6 rounded-lg bg-white/10 text-zinc-400 font-black text-xs flex items-center justify-center">+</button>
                          </div>
                          <p className={`flex-1 text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{item.name}</p>
                          <p className="text-sm font-black text-[#C58A4A]">R$ {(item.price * item.qty).toFixed(2)}</p>
                          <button onClick={() => setFinAdditionals(prev => prev.filter(a => a.id !== item.id))} className="text-red-400 hover:text-red-500 text-xs">✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Adicionar item ── */}
                  <div className={`p-4 rounded-2xl space-y-3 ${isDark ? 'border border-white/5 bg-white/2' : 'border border-zinc-100 bg-zinc-50'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>+ Adicionar produto ou serviço extra</p>
                    <div className="flex gap-2">
                      <input
                        placeholder="Nome (ex: Pomada, Cerveja...)"
                        value={finNewItem.name}
                        onChange={e => setFinNewItem(p => ({...p, name: e.target.value}))}
                        className={`flex-1 border p-3 rounded-xl text-sm font-bold outline-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                      />
                      <input
                        placeholder="R$"
                        type="number"
                        min="0"
                        value={finNewItem.price}
                        onChange={e => setFinNewItem(p => ({...p, price: e.target.value}))}
                        onKeyDown={e => e.key === 'Enter' && addFinItem()}
                        className={`w-20 border p-3 rounded-xl text-sm font-bold outline-none text-center ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                      />
                      <button onClick={addFinItem} className="px-4 py-3 gradiente-ouro text-black rounded-xl font-black text-sm">+</button>
                    </div>
                  </div>

                  {/* ── Total ── */}
                  <div className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'border-[#C58A4A]/30 bg-[#C58A4A]/5' : 'border-amber-200 bg-amber-50'}`}>
                    <p className={`font-black uppercase text-[10px] tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Total</p>
                    <p className="font-black text-xl text-[#C58A4A]">R$ {finTotal.toFixed(2)}</p>
                  </div>

                  {/* ── Forma de pagamento ── */}
                  <div className="space-y-2">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Forma de pagamento</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setFinPayMethod('DINHEIRO')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${finPayMethod === 'DINHEIRO' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : isDark ? 'border-white/10 bg-white/5 text-zinc-500 hover:border-white/20' : 'border-zinc-200 bg-zinc-50 text-zinc-400 hover:border-zinc-300'}`}
                      >
                        <span className="text-2xl">💵</span>
                        Dinheiro
                        {finPayMethod === 'DINHEIRO' && <span className="text-[8px] text-emerald-400">Conclui na hora</span>}
                      </button>
                      <button
                        onClick={() => setFinPayMethod('LINK')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${finPayMethod === 'LINK' ? 'border-blue-400 bg-blue-400/10 text-blue-400' : isDark ? 'border-white/10 bg-white/5 text-zinc-500 hover:border-white/20' : 'border-zinc-200 bg-zinc-50 text-zinc-400 hover:border-zinc-300'}`}
                      >
                        <span className="text-2xl">🔗</span>
                        Link / PIX / Cartão
                        {finPayMethod === 'LINK' && <span className="text-[8px] text-blue-400">Aguarda confirmação</span>}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!finResult && (
              <div className={`p-6 border-t ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
                <button onClick={handleFinalize} disabled={finLoading}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 ${finPayMethod === 'DINHEIRO' ? 'bg-emerald-500 text-white' : 'gradiente-ouro text-black'}`}>
                  {finLoading ? '⟳ Processando...' : finPayMethod === 'DINHEIRO' ? `💵 Receber R$ ${finTotal.toFixed(2)} em Dinheiro` : `🔗 Gerar cobrança · R$ ${finTotal.toFixed(2)}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
