import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Clock, Check, X, 
  Calendar, Scissors, LayoutGrid, List, UserPlus, DollarSign, RefreshCw, Filter, CalendarRange, Phone, Mail, User,
  Users, AlertCircle, Hourglass, CheckCircle2, Trash2
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

const SOUND_LS_KEY = 'brb_last_notif_ts';

const scheduleNotificationSound = (): void => {
  if (notifDebounceTimer) clearTimeout(notifDebounceTimer);
  notifDebounceTimer = setTimeout(() => {
    const now = Date.now();
    const lastTs = parseInt(localStorage.getItem(SOUND_LS_KEY) || '0', 10);
    if (now - lastTs < 6000) { notifDebounceTimer = null; return; }
    localStorage.setItem(SOUND_LS_KEY, String(now));
    playNotificationSound();
    notifDebounceTimer = null;
  }, 400);
};

// ─── Tipo para fila de espera (walk-in) ──────────────────────
interface WalkInEntry {
  id: string;
  clientName: string;
  clientPhone: string;
  clientId?: string;
  serviceId: string;
  serviceName: string;
  professionalId?: string;
  professionalName?: string;
  price: number;
  durationMinutes: number;
  arrivedAt: string; // HH:MM
  date: string;      // YYYY-MM-DD
  status: 'AGUARDANDO' | 'EM_ATENDIMENTO' | 'CONCLUIDO' | 'DESISTIU';
  isWalkIn: true;
}

// ─── Armazenamento da fila em localStorage (sem Firestore novo) ──
const WALKIN_LS_KEY = 'brb_walkin_queue';
const loadQueue = (): WalkInEntry[] => {
  try { return JSON.parse(localStorage.getItem(WALKIN_LS_KEY) || '[]'); } catch { return []; }
};
const saveQueue = (q: WalkInEntry[]) => localStorage.setItem(WALKIN_LS_KEY, JSON.stringify(q));

const Appointments: React.FC = () => {
  const { 
    appointments, professionals, services, clients, user, notifications,
    addAppointment, updateAppointmentStatus, deleteAppointment, addClient, rescheduleAppointment, theme,
    addFinancialEntry, products, decreaseProductStock
  } = useBarberStore() as any;

  const mountTimeRef = useRef<number>(Date.now());
  const prevNotifCountRef = useRef<number | null>(null);

  useEffect(() => { preloadAudio(); }, []);

  useEffect(() => {
    const tick = () => setCurrentDate(getTodayString());
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    const appointmentNotifs = notifications.filter(n => n.type === 'appointment');
    if (prevNotifCountRef.current === null) {
      prevNotifCountRef.current = appointmentNotifs.length;
      return;
    }
    if (appointmentNotifs.length > prevNotifCountRef.current) {
      const hasRecentNotif = appointmentNotifs.some(
        n => new Date(n.time).getTime() > mountTimeRef.current
      );
      if (hasRecentNotif) scheduleNotificationSound();
    }
    prevNotifCountRef.current = appointmentNotifs.length;
  }, [notifications, user]);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [compactView, setCompactView] = useState(false);
  const [showWalkInQueue, setShowWalkInQueue] = useState(false);
  const [currentDate, setCurrentDate] = useState<string>(getTodayString);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<Appointment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<Appointment | null>(null);
  // Reset product list when opening detail modal
  const openDetailModal = (app: Appointment) => { setUsedProducts([]); setShowDetailModal(app); };
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [newApp, setNewApp] = useState({ clientId: '', serviceId: '', professionalId: '', startTime: '09:00' });
  const [quickClient, setQuickClient] = useState({ name: '', phone: '', email: '' });
  const [filterPeriod, setFilterPeriod] = useState<'day' | 'month' | 'all'>('day');
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

  // ─── Fila de espera (walk-in) state ──────────────────────────
  const [walkInQueue, setWalkInQueue] = useState<WalkInEntry[]>(() => loadQueue());
  const [walkInStep, setWalkInStep] = useState<'choose' | 'form' | 'queue'>('choose');
  const [walkInMode, setWalkInMode] = useState<'schedule' | 'queue'>('schedule');
  const [walkInHasAccount, setWalkInHasAccount] = useState<boolean | null>(null);
  const [walkInData, setWalkInData] = useState({
    clientId: '', clientName: '', clientPhone: '',
    serviceId: '', professionalId: '', startTime: '09:00',
    withoutRegistration: false,
  });
  const [walkInQuickNew, setWalkInQuickNew] = useState({ name: '', phone: '' });
  const [usedProducts, setUsedProducts] = useState<{productId: string, qty: number}[]>([]);

  // Persiste a fila no localStorage sempre que muda
  useEffect(() => { saveQueue(walkInQueue); }, [walkInQueue]);

  // Limpa entradas antigas (de outro dia) ao montar
  useEffect(() => {
    const today = getTodayString();
    setWalkInQueue(q => q.filter(e => e.date === today));
  }, []);

  const hours = useMemo(() => Array.from({ length: 14 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`), []);
  const appointmentsToday = useMemo(() => appointments.filter(a => a.date === currentDate), [appointments, currentDate]);
  
  const appointmentsFiltered = useMemo(() => {
    if (filterPeriod === 'day') return appointments.filter(a => a.date === currentDate);
    else if (filterPeriod === 'month') return appointments.filter(a => a.date.startsWith(selectedMonth));
    else return appointments;
  }, [appointments, currentDate, selectedMonth, filterPeriod]);

  // ─── Verifica se há horário disponível para algum profissional ─
  const hasAvailableSlot = useMemo(() => {
    if (!walkInData.serviceId) return true;
    const service = services.find(s => s.id === walkInData.serviceId);
    if (!service) return true;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    for (const prof of professionals) {
      for (const hour of hours) {
        const [h] = hour.split(':').map(Number);
        const slotMins = h * 60;
        if (slotMins < nowMins) continue;
        const occupied = appointmentsToday.some(
          a => a.professionalId === prof.id &&
          a.startTime.split(':')[0] === String(h).padStart(2, '0') &&
          a.status !== 'CANCELADO'
        );
        if (!occupied) return true;
      }
    }
    return false;
  }, [walkInData.serviceId, appointmentsToday, professionals, hours, services]);

  const handleQuickClient = async () => {
    if(!quickClient.name || !quickClient.phone) return alert("Preencha nome e telefone");
    const client = await addClient({ ...quickClient, email: quickClient.email });
    setNewApp({...newApp, clientId: client.id});
    setShowQuickClient(false);
    setQuickClient({ name: '', phone: '', email: '' });
  };

  const handleClickEmptySlot = (professionalId: string, timeSlot: string) => {
    setNewApp({ ...newApp, professionalId, startTime: timeSlot });
    setShowAddModal(true);
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
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

  // ─── Walk-in: abrir modal ──────────────────────────────────────
  const openWalkInModal = () => {
    setWalkInStep('choose');
    setWalkInMode('schedule');
    setWalkInHasAccount(null);
    setWalkInData({ clientId: '', clientName: '', clientPhone: '', serviceId: '', professionalId: '', startTime: '09:00', withoutRegistration: false });
    setWalkInQuickNew({ name: '', phone: '' });
    setShowWalkInModal(true);
  };

  // ─── Walk-in: confirmar agendamento normal (com horário) ───────
  const handleWalkInSchedule = async () => {
    const service = services.find(s => s.id === walkInData.serviceId);
    if (!service) return alert('Selecione um serviço.');
    if (!walkInData.professionalId) return alert('Selecione um barbeiro.');
    if (!walkInData.clientName && !walkInData.clientId) return alert('Informe o cliente.');

    let clientName = walkInData.clientName;
    let clientPhone = walkInData.clientPhone;
    let clientId = walkInData.clientId;

    // Se tem conta, pega dados do cliente cadastrado
    if (clientId) {
      const c = clients.find(c => c.id === clientId);
      if (c) { clientName = c.name; clientPhone = c.phone; }
    }

    // Se não tem cadastro e digitou nome/telefone: cria cadastro rápido
    if (!clientId && walkInQuickNew.name) {
      const newC = await addClient({ name: walkInQuickNew.name, phone: walkInQuickNew.phone, email: '' });
      clientId = newC.id;
      clientName = newC.name;
      clientPhone = newC.phone;
    }

    const [h, m] = walkInData.startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + service.durationMinutes;
    const endTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
    const prof = professionals.find(p => p.id === walkInData.professionalId);

    await addAppointment({
      clientId: clientId || '',
      clientName,
      clientPhone,
      serviceId: service.id,
      serviceName: service.name,
      professionalId: walkInData.professionalId,
      professionalName: prof?.name || '',
      date: currentDate,
      startTime: walkInData.startTime,
      endTime,
      price: service.price,
    });

    setShowWalkInModal(false);
    alert(`✅ Agendamento criado para ${clientName} às ${walkInData.startTime}!`);
  };

  // ─── Walk-in: adicionar à fila de espera ──────────────────────
  const handleAddToQueue = async () => {
    const service = services.find(s => s.id === walkInData.serviceId);
    if (!service) return alert('Selecione um serviço.');

    let clientName = walkInQuickNew.name || '';
    let clientPhone = walkInQuickNew.phone || '';
    let clientId: string | undefined;

    if (walkInData.clientId) {
      const c = clients.find(c => c.id === walkInData.clientId);
      if (c) { clientName = c.name; clientPhone = c.phone; clientId = c.id; }
    }

    if (!clientName) return alert('Informe o nome do cliente.');

    const prof = professionals.find(p => p.id === walkInData.professionalId);
    const now = new Date();
    const arrivedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const entry: WalkInEntry = {
      id: `wi_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      clientName,
      clientPhone,
      clientId,
      serviceId: service.id,
      serviceName: service.name,
      professionalId: walkInData.professionalId || undefined,
      professionalName: prof?.name || 'Qualquer barbeiro',
      price: service.price,
      durationMinutes: service.durationMinutes,
      arrivedAt,
      date: currentDate,
      status: 'AGUARDANDO',
      isWalkIn: true,
    };

    setWalkInQueue(q => [...q, entry]);
    setShowWalkInModal(false);
    setShowWalkInQueue(true);
    alert(`✅ ${clientName} adicionado à fila de espera! Posição: ${walkInQueue.filter(e => e.status === 'AGUARDANDO').length + 1}º`);
  };

  // ─── Fila: chamar cliente (muda para EM_ATENDIMENTO) ──────────
  const handleCallWalkIn = (id: string) => {
    setWalkInQueue(q => q.map(e => e.id === id ? { ...e, status: 'EM_ATENDIMENTO' } : e));
  };

  // ─── Fila: concluir e registrar no fluxo de caixa ─────────────
  const handleCompleteWalkIn = async (entry: WalkInEntry) => {
    if (!window.confirm(`Confirmar conclusão e pagamento de ${entry.clientName}? (R$ ${entry.price.toFixed(2)})`)) return;

    // Cria agendamento real para aparecer nos registros
    let clientId = entry.clientId || '';
    if (!clientId && entry.clientName) {
      try {
        const newC = await addClient({ name: entry.clientName, phone: entry.clientPhone, email: '' });
        clientId = newC.id;
      } catch (_) {}
    }

    const now = new Date();
    const arrivedH = entry.arrivedAt.split(':').map(Number);
    const totalMins = arrivedH[0] * 60 + arrivedH[1] + entry.durationMinutes;
    const endTime = `${Math.floor(totalMins / 60).toString().padStart(2, '0')}:${(totalMins % 60).toString().padStart(2, '0')}`;

    // Cria entrada direta no fluxo de caixa (walk-in sem horário fixo)
    await addFinancialEntry({
      description: `Walk-in • ${entry.serviceName} • ${entry.clientName}`,
      amount: entry.price,
      type: 'RECEITA',
      category: 'Serviços',
      date: currentDate,
    });

    setWalkInQueue(q => q.map(e => e.id === entry.id ? { ...e, status: 'CONCLUIDO' } : e));
    alert(`✅ Serviço concluído! R$ ${entry.price.toFixed(2)} registrado no fluxo de caixa.`);
  };

  // ─── Fila: remover / desistência ──────────────────────────────
  const handleRemoveWalkIn = (id: string) => {
    if (!window.confirm('Remover cliente da fila?')) return;
    setWalkInQueue(q => q.filter(e => e.id !== id));
  };

  const waitingCount = walkInQueue.filter(e => e.status === 'AGUARDANDO' || e.status === 'EM_ATENDIMENTO').length;

  const statusBadge: Record<WalkInEntry['status'], { label: string; color: string }> = {
    AGUARDANDO:     { label: 'Aguardando',     color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    EM_ATENDIMENTO: { label: 'Em Atendimento', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    CONCLUIDO:      { label: 'Concluído',       color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    DESISTIU:       { label: 'Desistiu',        color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/30' },
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in pb-10">
      {/* ── CABEÇALHO ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Agenda Digital</h1>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-[#C58A4A] text-black' : 'bg-white/5 text-zinc-500'}`}><LayoutGrid size={16}/></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-[#C58A4A] text-black' : 'bg-white/5 text-zinc-500'}`}><List size={16}/></button>
            {viewMode === 'grid' && (
              <button 
                onClick={() => { setCompactView(!compactView); if (!compactView) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }} 
                className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase ${compactView ? 'bg-purple-600 text-white' : 'bg-white/5 text-zinc-500'}`}
              >
                Compacto
              </button>
            )}
            {/* ── NOVA ABA: Fila de Espera ── */}
            <button
              onClick={() => setShowWalkInQueue(!showWalkInQueue)}
              className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 transition-all relative ${showWalkInQueue ? 'bg-orange-500 text-white' : theme === 'light' ? 'bg-zinc-100 text-zinc-600 hover:bg-orange-100 hover:text-orange-600' : 'bg-white/5 text-zinc-500 hover:text-orange-400'}`}
            >
              <Hourglass size={13}/> Fila de Espera
              {waitingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] font-black flex items-center justify-center">
                  {waitingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => setFilterPeriod('day')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterPeriod === 'day' ? 'bg-[#C58A4A] text-black' : theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}>Dia</button>
            <button onClick={() => setFilterPeriod('month')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterPeriod === 'month' ? 'bg-[#C58A4A] text-black' : theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}>Mês</button>
            <button onClick={() => setFilterPeriod('all')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterPeriod === 'all' ? 'bg-[#C58A4A] text-black' : theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}>Todos</button>
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
              <button onClick={() => { const [y,mo] = selectedMonth.split('-').map(Number); const d = new Date(y, mo-2, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }} className={`p-2 transition-all ${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'}`}><ChevronLeft size={20}/></button>
              <span className={`px-4 text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>{formatMonthLabel(selectedMonth)}</span>
              <button onClick={() => { const [y,mo] = selectedMonth.split('-').map(Number); const d = new Date(y, mo, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }} className={`p-2 transition-all ${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'}`}><ChevronRight size={20}/></button>
            </div>
          )}
          
          {/* ── BOTÃO AGENDAR com dropdown ── */}
          <div className="relative group">
            <button className="gradiente-ouro text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
              Agendar + <ChevronRight size={12} className="rotate-90"/>
            </button>
            <div className={`absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-2xl border z-50 overflow-hidden opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-200 ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-[#111] border-white/10'}`}>
              <button
                onClick={() => setShowAddModal(true)}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'light' ? 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}
              >
                <Calendar size={14} className="text-[#C58A4A]"/> Agendamento Normal
              </button>
              <div className={`border-t ${theme === 'light' ? 'border-zinc-100' : 'border-white/5'}`}/>
              <button
                onClick={openWalkInModal}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'light' ? 'text-zinc-700 hover:bg-orange-50 hover:text-orange-700' : 'text-zinc-300 hover:bg-orange-500/10 hover:text-orange-400'}`}
              >
                <Users size={14} className="text-orange-400"/> Cliente na Barbearia
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── LAYOUT COM FILA LATERAL ───────────────────────────── */}
      <div className={`flex-1 flex gap-4 overflow-hidden`}>
        {/* ── GRADE / LISTA PRINCIPAL ── */}
        <div className={`flex-1 cartao-vidro rounded-[2rem] border-white/5 shadow-2xl overflow-hidden flex flex-col transition-all`}>
          {viewMode === 'grid' ? (
            <div className="overflow-auto h-full scrollbar-hide">
              <div className={compactView ? 'w-full' : 'min-w-[900px]'}>
                <div className={`border-b border-white/5 bg-white/[0.02] sticky top-0 z-10 ${compactView ? 'grid grid-cols-[60px_repeat(auto-fit,minmax(120px,1fr))]' : 'grid grid-cols-[80px_repeat(auto-fit,minmax(200px,1fr))]'}`}>
                  <div className={`flex items-center justify-center text-zinc-500 ${compactView ? 'p-2' : 'p-3'}`}><Clock size={compactView ? 14 : 18} /></div>
                  {professionals.map(prof => (
                    <div key={prof.id} className={`flex items-center justify-center gap-3 border-r border-white/5 ${compactView ? 'p-2 flex-col' : 'p-3'}`}>
                      <img src={prof.avatar} className={`rounded-lg object-cover border border-[#C58A4A] ${compactView ? 'w-6 h-6' : 'w-8 h-8'}`} alt="" />
                      <span className={`font-black uppercase tracking-widest ${compactView ? 'text-[8px]' : 'text-[10px]'}`}>{prof.name.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
                {hours.map(hour => (
                  <div key={hour} className={`border-b border-white/[0.03] ${compactView ? 'grid grid-cols-[60px_repeat(auto-fit,minmax(120px,1fr))] min-h-[35px]' : 'grid grid-cols-[80px_repeat(auto-fit,minmax(200px,1fr))] min-h-[60px]'}`}>
                    <div className="flex items-center justify-center border-r border-white/5 bg-white/[0.01]"><span className={`font-black text-zinc-600 ${compactView ? 'text-[9px]' : 'text-[10px]'}`}>{hour}</span></div>
                    {professionals.map(prof => {
                      const app = appointmentsToday.find(a => a.professionalId === prof.id && a.startTime.split(':')[0] === hour.split(':')[0] && a.status !== 'CANCELADO');
                      return (
                        <div 
                          key={prof.id} 
                          className={`border-r border-white/5 last:border-r-0 ${compactView ? 'p-1' : 'p-1.5'} ${!app ? 'cursor-pointer hover:bg-white/5 transition-all' : ''}`}
                          onClick={() => !app && handleClickEmptySlot(prof.id, hour)}
                          title={!app ? `Clique para agendar às ${hour}` : ''}
                        >
                          {app ? (
                            <div className={`h-full w-full rounded-2xl border flex flex-col justify-between transition-all group ${app.status === 'CONCLUIDO_PAGO' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-[#C58A4A]/30 bg-[#C58A4A]/5'} ${compactView ? 'p-1.5 rounded-lg' : 'p-2'}`}>
                              <div className="truncate">
                                <h4 onClick={(e) => { e.stopPropagation(); openDetailModal(app); }} className={`font-black uppercase truncate cursor-pointer hover:text-[#C58A4A] transition-colors ${compactView ? 'text-[8px]' : 'text-[10px]'} ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`} title="Ver detalhes">{app.clientName}</h4>
                                {!compactView && <p className="text-[8px] font-black opacity-50 uppercase mt-1 truncate">{app.serviceName}</p>}
                              </div>
                              <div className={`flex items-center justify-end gap-1 ${compactView ? 'mt-0.5' : 'mt-1'}`}>
                                <button onClick={(e) => { e.stopPropagation(); updateAppointmentStatus(app.id, app.status === 'CONCLUIDO_PAGO' ? 'PENDENTE' : 'CONCLUIDO_PAGO'); }} className={`rounded-lg transition-all ${app.status === 'CONCLUIDO_PAGO' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-zinc-500 hover:text-white'} ${compactView ? 'p-0.5' : 'p-1'}`} title={app.status === 'CONCLUIDO_PAGO' ? 'Marcar Pendente' : 'Marcar Pago'}><DollarSign size={compactView ? 9 : 11}/></button>
                                <button onClick={(e) => { e.stopPropagation(); setShowRescheduleModal(app); }} className={`bg-white/10 text-zinc-500 hover:text-white rounded-lg transition-all ${compactView ? 'p-0.5' : 'p-1'}`} title="Reagendar"><RefreshCw size={compactView ? 9 : 11}/></button>
                                <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Excluir agendamento de ${app.clientName}?`)) deleteAppointment(app.id); }} className={`bg-white/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all ${compactView ? 'p-0.5' : 'p-1'}`} title="Excluir"><X size={compactView ? 9 : 11}/></button>
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
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${app.status === 'CONCLUIDO_PAGO' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : 'border-[#C58A4A] text-[#C58A4A] bg-[#C58A4A]/10'}`}>
                      {app.status === 'CONCLUIDO_PAGO' ? <Check size={20}/> : <Clock size={20}/>}
                    </div>
                    <div>
                      <p className="text-xs font-black cursor-pointer hover:text-[#C58A4A] transition-colors" onClick={() => openDetailModal(app)} title="Ver detalhes">{app.clientName} • <span className="text-[#C58A4A]">{app.startTime}</span></p>
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{app.serviceName} com {app.professionalName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateAppointmentStatus(app.id, app.status === 'CONCLUIDO_PAGO' ? 'PENDENTE' : 'CONCLUIDO_PAGO')} className={`p-2 rounded-xl border transition-all ${app.status === 'CONCLUIDO_PAGO' ? 'bg-emerald-500 text-white border-transparent' : 'bg-white/5 border-white/10 text-zinc-500 hover:text-white'}`} title={app.status === 'CONCLUIDO_PAGO' ? 'Marcar Pendente' : 'Marcar Pago'}><DollarSign size={16}/></button>
                    <button onClick={() => setShowRescheduleModal(app)} className="p-2 bg-white/5 border border-white/10 text-zinc-500 hover:text-white rounded-xl transition-all" title="Reagendar"><RefreshCw size={16}/></button>
                    <button onClick={() => { if (window.confirm(`Excluir agendamento de ${app.clientName}?`)) deleteAppointment(app.id); }} className="p-2 bg-white/5 border border-white/10 text-zinc-500 hover:text-red-500 hover:border-red-500/30 rounded-xl transition-all" title="Excluir"><X size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── PAINEL LATERAL: FILA DE ESPERA ── */}
        {showWalkInQueue && (
          <div className={`w-80 flex-shrink-0 rounded-[2rem] border shadow-2xl flex flex-col overflow-hidden transition-all animate-in slide-in-from-right duration-300 ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-[#0A0A0A] border-white/10'}`}>
            {/* Header da fila */}
            <div className="p-5 border-b border-white/5 bg-orange-500/10 flex items-center justify-between">
              <div>
                <h3 className={`font-black text-sm uppercase tracking-widest flex items-center gap-2 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                  <Hourglass size={14} className="text-orange-400"/> Fila de Espera
                </h3>
                <p className="text-[9px] text-orange-400 font-black uppercase mt-0.5">
                  {waitingCount} cliente{waitingCount !== 1 ? 's' : ''} aguardando
                </p>
              </div>
              <button
                onClick={openWalkInModal}
                className="p-2 bg-orange-500 text-white rounded-xl hover:scale-105 transition-all"
                title="Adicionar à fila"
              >
                <Plus size={14}/>
              </button>
            </div>

            {/* Lista da fila */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-3">
              {walkInQueue.length === 0 && (
                <div className="text-center py-10">
                  <Hourglass size={32} className="mx-auto mb-3 text-zinc-700"/>
                  <p className="text-[9px] font-black uppercase text-zinc-600">Nenhum cliente na fila</p>
                </div>
              )}

              {walkInQueue.map((entry, idx) => {
                const badge = statusBadge[entry.status];
                return (
                  <div key={entry.id} className={`rounded-2xl border p-4 transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/5'} ${entry.status === 'CONCLUIDO' ? 'opacity-50' : ''}`}>
                    {/* Posição + nome */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black ${entry.status === 'AGUARDANDO' ? 'bg-orange-500 text-white' : entry.status === 'EM_ATENDIMENTO' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'}`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className={`text-[11px] font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{entry.clientName}</p>
                          {entry.clientPhone && <p className="text-[9px] text-zinc-500">{entry.clientPhone}</p>}
                        </div>
                      </div>
                      <button onClick={() => handleRemoveWalkIn(entry.id)} className="p-1 text-zinc-600 hover:text-red-500 transition-colors" title="Remover"><Trash2 size={11}/></button>
                    </div>

                    {/* Serviço + barbeiro */}
                    <div className="space-y-1 mb-3">
                      <p className="text-[9px] font-black text-[#C58A4A]">{entry.serviceName} • R$ {entry.price.toFixed(2)}</p>
                      <p className="text-[9px] text-zinc-500">{entry.professionalName} • Chegou: {entry.arrivedAt}</p>
                    </div>

                    {/* Badge de status */}
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[8px] font-black uppercase mb-3 ${badge.color}`}>
                      {badge.label}
                    </div>

                    {/* Ações */}
                    {entry.status === 'AGUARDANDO' && (
                      <button
                        onClick={() => handleCallWalkIn(entry.id)}
                        className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-[9px] font-black uppercase hover:bg-blue-500/30 transition-all"
                      >
                        Chamar para Atendimento
                      </button>
                    )}
                    {entry.status === 'EM_ATENDIMENTO' && (
                      <button
                        onClick={() => handleCompleteWalkIn(entry)}
                        className="w-full py-2 gradiente-ouro text-black rounded-xl text-[9px] font-black uppercase hover:scale-[1.02] transition-all"
                      >
                        ✓ Concluir e Registrar Pagamento
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer com resumo */}
            {walkInQueue.some(e => e.status === 'CONCLUIDO') && (
              <div className={`p-3 border-t ${theme === 'light' ? 'border-zinc-200' : 'border-white/5'}`}>
                <p className="text-[9px] text-zinc-500 font-black uppercase text-center">
                  {walkInQueue.filter(e => e.status === 'CONCLUIDO').length} concluído(s) hoje •{' '}
                  R$ {walkInQueue.filter(e => e.status === 'CONCLUIDO').reduce((s, e) => s + e.price, 0).toFixed(2)} gerado
                </p>
                <button onClick={() => setWalkInQueue(q => q.filter(e => e.status !== 'CONCLUIDO'))} className="w-full mt-2 py-1.5 text-[8px] font-black uppercase text-zinc-600 hover:text-red-400 transition-colors">
                  Limpar concluídos
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          MODAL WALK-IN: Cliente na Barbearia
      ════════════════════════════════════════════════════════ */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className={`w-full max-w-md rounded-[2.5rem] p-8 border shadow-2xl relative overflow-y-auto max-h-[90vh] scrollbar-hide ${theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-white/10'}`}>
            
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-1">Cliente Presencial</p>
                <h2 className={`text-xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                  {walkInStep === 'choose' ? 'Como deseja prosseguir?' : walkInMode === 'schedule' ? 'Agendar Horário' : 'Adicionar à Fila'}
                </h2>
              </div>
              <button onClick={() => setShowWalkInModal(false)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"><X size={20} className="text-zinc-400"/></button>
            </div>

            {/* ── PASSO 1: Escolha o fluxo ── */}
            {walkInStep === 'choose' && (
              <div className="space-y-4">
                <button
                  onClick={() => { setWalkInMode('schedule'); setWalkInStep('form'); }}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all hover:border-[#C58A4A] group ${theme === 'light' ? 'border-zinc-200 bg-zinc-50 hover:bg-amber-50' : 'border-white/10 bg-white/5 hover:bg-[#C58A4A]/5'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#C58A4A]/20 flex items-center justify-center">
                      <Calendar size={18} className="text-[#C58A4A]"/>
                    </div>
                    <div>
                      <p className={`font-black text-sm ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Agendar com Horário</p>
                      <p className="text-[10px] text-zinc-500">Há horário disponível — agendar agora</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => { setWalkInMode('queue'); setWalkInStep('form'); }}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all hover:border-orange-500 group ${theme === 'light' ? 'border-zinc-200 bg-zinc-50 hover:bg-orange-50' : 'border-white/10 bg-white/5 hover:bg-orange-500/5'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                      <Hourglass size={18} className="text-orange-400"/>
                    </div>
                    <div>
                      <p className={`font-black text-sm ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Fila de Encaixe / Espera</p>
                      <p className="text-[10px] text-zinc-500">Sem horário disponível — entrar na fila</p>
                    </div>
                  </div>
                </button>

                <p className={`text-[9px] text-center font-black uppercase ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Ambas as opções funcionam com ou sem cadastro
                </p>
              </div>
            )}

            {/* ── PASSO 2: FORMULÁRIO (modo schedule ou queue) ── */}
            {walkInStep === 'form' && (
              <div className="space-y-5">
                {/* Tem cadastro? */}
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-3 ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>O cliente tem cadastro?</p>
                  <div className="flex gap-3">
                    <button onClick={() => setWalkInHasAccount(true)} className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${walkInHasAccount === true ? 'bg-[#C58A4A] text-black border-transparent' : theme === 'light' ? 'border-zinc-300 text-zinc-600' : 'border-white/10 text-zinc-500'}`}>Sim</button>
                    <button onClick={() => { setWalkInHasAccount(false); setWalkInData(d => ({...d, clientId: ''})); }} className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${walkInHasAccount === false ? 'bg-orange-500 text-white border-transparent' : theme === 'light' ? 'border-zinc-300 text-zinc-600' : 'border-white/10 text-zinc-500'}`}>Não / Sem Cadastro</button>
                  </div>
                </div>

                {/* Com cadastro: seleciona cliente */}
                {walkInHasAccount === true && (
                  <div>
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 mb-1 block ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>Selecionar Cliente</label>
                    <select value={walkInData.clientId} onChange={e => setWalkInData(d => ({...d, clientId: e.target.value}))} className={`w-full border p-4 rounded-xl outline-none text-xs font-black uppercase transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}>
                      <option value="">Selecione o cliente</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                    </select>
                  </div>
                )}

                {/* Sem cadastro: digita nome/telefone */}
                {walkInHasAccount === false && (
                  <div className="space-y-3">
                    <div>
                      <label className={`text-[9px] font-black uppercase tracking-widest ml-1 mb-1 block ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>Nome do Cliente</label>
                      <input type="text" placeholder="Nome completo" value={walkInQuickNew.name} onChange={e => setWalkInQuickNew(d => ({...d, name: e.target.value}))} className={`w-full border p-4 rounded-xl outline-none text-xs font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}/>
                    </div>
                    <div>
                      <label className={`text-[9px] font-black uppercase tracking-widest ml-1 mb-1 block ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>WhatsApp (opcional)</label>
                      <input type="tel" placeholder="(21) 99999-9999" value={walkInQuickNew.phone} onChange={e => setWalkInQuickNew(d => ({...d, phone: e.target.value}))} className={`w-full border p-4 rounded-xl outline-none text-xs font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}/>
                    </div>
                  </div>
                )}

                {/* Serviço */}
                <div>
                  <label className={`text-[9px] font-black uppercase tracking-widest ml-1 mb-1 block ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>Serviço</label>
                  <select value={walkInData.serviceId} onChange={e => setWalkInData(d => ({...d, serviceId: e.target.value}))} className={`w-full border p-4 rounded-xl outline-none text-xs font-black uppercase transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}>
                    <option value="">Selecione o serviço</option>
                    {services.filter(s => s.status === 'ATIVO').map(s => <option key={s.id} value={s.id}>{s.name} • R$ {s.price} • {s.durationMinutes}min</option>)}
                  </select>
                </div>

                {/* Barbeiro */}
                <div>
                  <label className={`text-[9px] font-black uppercase tracking-widest ml-1 mb-1 block ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>Barbeiro {walkInMode === 'queue' ? '(opcional)' : ''}</label>
                  <select value={walkInData.professionalId} onChange={e => setWalkInData(d => ({...d, professionalId: e.target.value}))} className={`w-full border p-4 rounded-xl outline-none text-xs font-black uppercase transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}>
                    <option value="">{walkInMode === 'queue' ? 'Qualquer barbeiro disponível' : 'Selecione o barbeiro'}</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                {/* Horário (apenas no modo schedule) */}
                {walkInMode === 'schedule' && (
                  <div>
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 mb-1 block ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>Horário</label>
                    <input type="time" value={walkInData.startTime} onChange={e => setWalkInData(d => ({...d, startTime: e.target.value}))} className={`w-full border p-4 rounded-xl outline-none text-xs font-black transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}/>
                  </div>
                )}

                {/* Aviso de sem horário disponível (modo schedule) */}
                {walkInMode === 'schedule' && !hasAvailableSlot && (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                    <AlertCircle size={16} className="text-amber-400 shrink-0"/>
                    <div>
                      <p className="text-[10px] font-black text-amber-400">Agenda lotada neste horário</p>
                      <button onClick={() => setWalkInMode('queue')} className="text-[9px] text-amber-300 underline font-bold mt-0.5">Mudar para fila de espera →</button>
                    </div>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setWalkInStep('choose')} className={`flex-1 py-4 rounded-xl font-black uppercase text-[9px] transition-all ${theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}>Voltar</button>
                  {walkInMode === 'schedule' ? (
                    <button
                      onClick={handleWalkInSchedule}
                      disabled={!walkInData.serviceId || (!walkInData.clientId && !walkInQuickNew.name) || (walkInHasAccount === null)}
                      className="flex-1 gradiente-ouro text-black py-4 rounded-xl font-black uppercase text-[9px] shadow-xl disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] transition-all"
                    >
                      Agendar Agora
                    </button>
                  ) : (
                    <button
                      onClick={handleAddToQueue}
                      disabled={!walkInData.serviceId || (!walkInData.clientId && !walkInQuickNew.name) || (walkInHasAccount === null)}
                      className="flex-1 bg-orange-500 text-white py-4 rounded-xl font-black uppercase text-[9px] shadow-xl disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] transition-all"
                    >
                      Entrar na Fila
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: Reagendar ─────────────────────────────────── */}
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
      
      {/* ── MODAL: Novo Agendamento Normal ───────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className="cartao-vidro w-full max-w-lg rounded-[2.5rem] p-10 space-y-8 border-[#C58A4A]/20 relative">
            <h2 className="text-2xl font-black font-display italic">Novo Agendamento</h2>
            <form onSubmit={handleCreateAppointment} className="space-y-6">
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
                <button type="submit" className="flex-1 gradiente-ouro text-black py-4 rounded-xl font-black uppercase text-[10px]">Agendar Agora</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Detalhes do Agendamento ───────────────────── */}
      {showDetailModal && (() => {
        const app = showDetailModal;
        const client = clients.find(c => c.name === app.clientName || c.phone === app.clientPhone);
        const service = services.find(s => s.id === app.serviceId);
        const statusLabel = app.status === 'CONCLUIDO_PAGO' ? 'Concluído e Pago' : app.status === 'CANCELADO' ? 'Cancelado' : 'Pendente';
        const statusColor = app.status === 'CONCLUIDO_PAGO' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : app.status === 'CANCELADO' ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-[#C58A4A] bg-[#C58A4A]/10 border-[#C58A4A]/30';
        return (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
            <div className={`w-full max-w-md rounded-[2.5rem] p-8 space-y-6 shadow-2xl border ${theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-[#C58A4A]/20'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A] mb-1">Detalhes do Agendamento</p>
                  <h2 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{app.clientName}</h2>
                </div>
                <button onClick={() => setShowDetailModal(null)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"><X size={20} className="text-zinc-400"/></button>
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${statusColor}`}>
                {app.status === 'CONCLUIDO_PAGO' ? <Check size={12}/> : app.status === 'CANCELADO' ? <X size={12}/> : <Clock size={12}/>}
                {statusLabel}
              </div>
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
              {/* ── Produtos Usados no Atendimento ── */}
              {products && products.filter((p: any) => p.active !== false && p.stock !== null && p.stock !== undefined).length > 0 && app.status !== 'CONCLUIDO_PAGO' && (
                <div className={`rounded-2xl p-4 border space-y-3 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/10'}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A]">🧴 Produtos Utilizados</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
                    {products.filter((p: any) => p.active !== false && p.stock !== null && p.stock !== undefined).map((p: any) => {
                      const used = usedProducts.find((u: any) => u.productId === p.id);
                      const qty = used?.qty || 0;
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-[10px] font-black truncate ${theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'}`}>{p.name}</p>
                            <p className="text-[8px] text-zinc-500">{p.stock} em estoque</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setUsedProducts(prev => { const ex = prev.find(u => u.productId === p.id); if (!ex || ex.qty === 0) return prev; return prev.map(u => u.productId === p.id ? {...u, qty: u.qty - 1} : u).filter(u => u.qty > 0); })} className="w-6 h-6 rounded-lg bg-zinc-500/20 text-zinc-400 flex items-center justify-center font-black text-xs">−</button>
                            <span className={`w-6 text-center text-[11px] font-black ${qty > 0 ? 'text-[#C58A4A]' : theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>{qty}</span>
                            <button onClick={() => setUsedProducts(prev => { const ex = prev.find(u => u.productId === p.id); if (ex) return prev.map(u => u.productId === p.id ? {...u, qty: u.qty + 1} : u); return [...prev, {productId: p.id, qty: 1}]; })} disabled={qty >= p.stock} className="w-6 h-6 rounded-lg bg-[#C58A4A]/20 text-[#C58A4A] flex items-center justify-center font-black text-xs disabled:opacity-30">+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {usedProducts.length > 0 && (
                    <p className="text-[9px] text-zinc-500">O estoque será descontado ao marcar como pago.</p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setShowDetailModal(null); setShowRescheduleModal(app); }} className="flex-1 bg-white/5 border border-white/10 py-3 rounded-xl font-black uppercase text-[9px] text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2">
                  <RefreshCw size={12}/> Reagendar
                </button>
                <button onClick={async () => {
                  // Desconta estoque dos produtos usados
                  if (usedProducts.length > 0 && app.status !== 'CONCLUIDO_PAGO') {
                    for (const u of usedProducts) {
                      await decreaseProductStock(u.productId, u.qty);
                    }
                    setUsedProducts([]);
                  }
                  updateAppointmentStatus(app.id, app.status === 'CONCLUIDO_PAGO' ? 'PENDENTE' : 'CONCLUIDO_PAGO');
                  setShowDetailModal(null);
                }} className={`flex-1 py-3 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-2 ${app.status === 'CONCLUIDO_PAGO' ? 'bg-white/10 text-zinc-300 border border-white/10' : 'gradiente-ouro text-black'}`}>
                  <DollarSign size={12}/> {app.status === 'CONCLUIDO_PAGO' ? 'Voltar a Pendente' : 'Marcar Pago'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Appointments;
