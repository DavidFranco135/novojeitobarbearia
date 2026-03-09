import React, { useMemo } from 'react';
import {
  Users, CalendarCheck, Scissors, ArrowUpRight, Wallet, Clock,
  CheckCircle2, XCircle, AlertCircle, TrendingUp, Trophy, Zap, UserPlus, Calendar
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { CORES } from '../constants';
import { useBarberStore } from '../store';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { appointments, clients, financialEntries, services, professionals, theme } = useBarberStore();

  const isDark = theme !== 'light';
  const cardClass = isDark
    ? 'cartao-vidro border-white/5'
    : 'bg-white border border-zinc-200 shadow-sm';
  const subTextClass = isDark ? 'text-zinc-500' : 'text-zinc-500';

  // ── Datas de referência ──────────────────────────────────────
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const startOfWeek = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [today]);

  const startOfMonth = useMemo(() => {
    const d = new Date(today);
    d.setDate(1);
    return d;
  }, [today]);

  // ── Faturamento diário / semanal / mensal ─────────────────────
  const revenue = useMemo(() => {
    const entries = financialEntries.filter(e => e.type === 'RECEITA');
    const daily = entries
      .filter(e => new Date(e.date + 'T00:00:00') >= today)
      .reduce((acc, e) => acc + e.amount, 0);
    const weekly = entries
      .filter(e => new Date(e.date + 'T00:00:00') >= startOfWeek)
      .reduce((acc, e) => acc + e.amount, 0);
    const monthly = entries
      .filter(e => new Date(e.date + 'T00:00:00') >= startOfMonth)
      .reduce((acc, e) => acc + e.amount, 0);
    const total = entries.reduce((acc, e) => acc + e.amount, 0);
    return { daily, weekly, monthly, total };
  }, [financialEntries, today, startOfWeek, startOfMonth]);

  // ── Contadores de agendamento por status ──────────────────────
  const statusCount = useMemo(() => ({
    confirmados: appointments.filter(a => a.status === 'AGENDADO').length,
    pendentes: appointments.filter(a => a.status === 'PENDENTE' || a.status === 'PENDENTE_PAGAMENTO').length,
    concluidos: appointments.filter(a => a.status === 'CONCLUIDO_PAGO').length,
    cancelados: appointments.filter(a => a.status === 'CANCELADO').length,
    total: appointments.length,
  }), [appointments]);

  // ── Novos clientes no mês ─────────────────────────────────────
  const newClientsMonth = useMemo(() =>
    clients.filter(c => new Date(c.createdAt) >= startOfMonth).length,
    [clients, startOfMonth]
  );

  // ── Ranking de serviços mais realizados ───────────────────────
  const serviceRanking = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    appointments
      .filter(a => a.status === 'CONCLUIDO_PAGO')
      .forEach(a => {
        if (!map[a.serviceId]) map[a.serviceId] = { name: a.serviceName, count: 0, revenue: 0 };
        map[a.serviceId].count++;
        map[a.serviceId].revenue += a.price;
      });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [appointments]);

  // ── Ranking de profissionais por receita ──────────────────────
  const professionalRanking = useMemo(() => {
    return professionals.map(p => {
      const pApps = appointments.filter(a => a.professionalId === p.id && a.status === 'CONCLUIDO_PAGO');
      const totalRevenue = pApps.reduce((acc, a) => acc + a.price, 0);
      return { id: p.id, name: p.name, revenue: totalRevenue, count: pApps.length, avatar: p.avatar };
    }).filter(p => p.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [professionals, appointments]);

  // ── Gráfico financeiro (últimos 7 dias) ────────────────────────
  const chartData = useMemo(() => {
    const days: { name: string; receita: number; despesa: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const receita = financialEntries
        .filter(e => e.date === dateStr && e.type === 'RECEITA')
        .reduce((acc, e) => acc + e.amount, 0);
      const despesa = financialEntries
        .filter(e => e.date === dateStr && e.type === 'DESPESA')
        .reduce((acc, e) => acc + e.amount, 0);
      days.push({ name: label, receita, despesa });
    }
    return days;
  }, [financialEntries, today]);

  // ── Próximos agendamentos do dia ──────────────────────────────
  const todayStr = today.toISOString().split('T')[0];
  const todayApps = appointments
    .filter(a => a.date === todayStr && a.status !== 'CANCELADO')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const tooltipStyle = {
    backgroundColor: isDark ? '#0F0F0F' : '#fff',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: isDark ? '#fff' : '#000',
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-10">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl md:text-4xl font-black font-display tracking-tight flex items-center gap-3 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Gestão <span className="text-[#C58A4A] italic">Novo Jeito</span>
          </h1>
          <p className={`mt-1 text-sm font-medium opacity-60 ${subTextClass}`}>Controle completo da sua unidade.</p>
        </div>
        {/* Ações rápidas */}
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('appointments')}
            className="flex items-center gap-2 gradiente-ouro text-black px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
          >
            <Calendar size={14} /> Novo Agendamento
          </button>
          <button
            onClick={() => onNavigate('clients')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all hover:scale-105 ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200'}`}
          >
            <UserPlus size={14} /> Novo Cliente
          </button>
        </div>
      </div>

      {/* ── Faturamento: Diário / Semanal / Mensal / Total ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Hoje', value: revenue.daily, color: '#C58A4A', sub: 'Faturamento diário' },
          { label: 'Esta Semana', value: revenue.weekly, color: '#10b981', sub: 'Faturamento semanal' },
          { label: 'Este Mês', value: revenue.monthly, color: '#3b82f6', sub: 'Faturamento mensal' },
          { label: 'Total Geral', value: revenue.total, color: '#a855f7', sub: 'Faturamento acumulado' },
        ].map((item) => (
          <div
            key={item.label}
            onClick={() => onNavigate('financial')}
            className={`${cardClass} p-6 rounded-[2rem] cursor-pointer group hover:border-[#C58A4A]/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute inset-x-0 top-0 h-1 rounded-t-[2rem]" style={{ background: item.color, opacity: 0.7 }} />
            <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${subTextClass}`}>{item.sub}</p>
            <p className="text-xl font-black font-display italic" style={{ color: item.color }}>
              R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${subTextClass}`}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* ── Contadores de status + novos clientes ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Confirmados', value: statusCount.confirmados, icon: CalendarCheck, color: '#3b82f6' },
          { label: 'Pendentes', value: statusCount.pendentes, icon: AlertCircle, color: '#f59e0b' },
          { label: 'Concluídos', value: statusCount.concluidos, icon: CheckCircle2, color: '#10b981' },
          { label: 'Cancelados', value: statusCount.cancelados, icon: XCircle, color: '#ef4444' },
          { label: 'Novos Clientes/Mês', value: newClientsMonth, icon: Users, color: '#C58A4A' },
        ].map((item) => (
          <div
            key={item.label}
            onClick={() => onNavigate('appointments')}
            className={`${cardClass} p-5 rounded-2xl cursor-pointer hover:border-[#C58A4A]/30 transition-all group`}
          >
            <div className="flex items-center justify-between mb-3">
              <item.icon size={18} style={{ color: item.color }} />
              <ArrowUpRight size={12} className={`opacity-0 group-hover:opacity-100 transition-all ${subTextClass}`} />
            </div>
            <p className="text-2xl font-black font-display" style={{ color: item.color }}>{item.value}</p>
            <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${subTextClass}`}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* ── Gráfico Financeiro + Atendimentos do Dia ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 ${cardClass} rounded-[2rem] p-6 md:p-10`}>
          <h3 className={`text-lg font-bold mb-6 tracking-tight italic ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Performance Financeira — Últimos 7 Dias
          </h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CORES.primaria} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CORES.primaria} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#ffffff05' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#52525b' : '#71717a', fontSize: 10 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#52525b' : '#71717a', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, '']} />
                <Area type="monotone" dataKey="receita" name="Receita" stroke={CORES.primaria} strokeWidth={2.5} fill="url(#colorReceita)" />
                <Area type="monotone" dataKey="despesa" name="Despesa" stroke="#ef4444" strokeWidth={2} fill="url(#colorDespesa)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${cardClass} rounded-[2rem] p-6 md:p-10 overflow-hidden`}>
          <h3 className={`text-lg font-bold mb-6 tracking-tight italic ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Atendimentos de Hoje
          </h3>
          <div className="space-y-3 max-h-[260px] overflow-y-auto scrollbar-hide">
            {todayApps.map(app => (
              <div
                key={app.id}
                onClick={() => onNavigate('appointments')}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all group border border-transparent hover:border-[#C58A4A]/20 ${isDark ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm transition-all group-hover:bg-[#C58A4A] group-hover:text-black ${isDark ? 'bg-zinc-900 text-[#C58A4A]' : 'bg-zinc-100 text-[#C58A4A]'}`}>
                  {app.clientName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{app.clientName}</p>
                  <p className={`text-[9px] font-black uppercase truncate ${subTextClass}`}>{app.startTime} · {app.serviceName}</p>
                </div>
                <span className={`text-[8px] font-black px-2 py-1 rounded-lg ${
                  app.status === 'CONCLUIDO_PAGO' ? 'bg-emerald-500/10 text-emerald-500' :
                  app.status === 'CANCELADO' ? 'bg-red-500/10 text-red-500' :
                  'bg-blue-500/10 text-blue-400'
                }`}>
                  {app.status === 'CONCLUIDO_PAGO' ? '✓' : app.status === 'CANCELADO' ? '✗' : '●'}
                </span>
              </div>
            ))}
            {todayApps.length === 0 && (
              <p className={`text-[10px] text-center py-10 italic opacity-40 ${subTextClass}`}>Nenhum agendamento para hoje.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Ranking Serviços + Profissionais ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Serviços */}
        <div className={`${cardClass} rounded-[2rem] p-6 md:p-8`}>
          <div className="flex items-center gap-3 mb-6">
            <Trophy size={18} className="text-[#C58A4A]" />
            <h3 className={`text-base font-bold italic ${isDark ? 'text-white' : 'text-zinc-900'}`}>Serviços Mais Realizados</h3>
          </div>
          {serviceRanking.length === 0 ? (
            <p className={`text-[10px] italic opacity-40 ${subTextClass}`}>Sem dados ainda.</p>
          ) : (
            <div className="space-y-3">
              {serviceRanking.map((svc, i) => (
                <div key={svc.name} className="flex items-center gap-4">
                  <span className={`text-[10px] font-black w-5 ${i === 0 ? 'text-[#C58A4A]' : subTextClass}`}>#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-800'}`}>{svc.name}</span>
                      <span className={`text-[10px] font-black ${subTextClass}`}>{svc.count}x · R$ {svc.revenue.toFixed(0)}</span>
                    </div>
                    <div className={`h-1.5 rounded-full ${isDark ? 'bg-white/5' : 'bg-zinc-100'}`}>
                      <div
                        className="h-1.5 rounded-full gradiente-ouro"
                        style={{ width: `${Math.min((svc.count / (serviceRanking[0]?.count || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ranking de Profissionais */}
        <div className={`${cardClass} rounded-[2rem] p-6 md:p-8`}>
          <div className="flex items-center gap-3 mb-6">
            <Zap size={18} className="text-[#C58A4A]" />
            <h3 className={`text-base font-bold italic ${isDark ? 'text-white' : 'text-zinc-900'}`}>Profissionais por Receita</h3>
          </div>
          {professionalRanking.length === 0 ? (
            <p className={`text-[10px] italic opacity-40 ${subTextClass}`}>Sem dados ainda.</p>
          ) : (
            <div className="space-y-3">
              {professionalRanking.map((prof, i) => (
                <div key={prof.id} className="flex items-center gap-4">
                  <span className={`text-[10px] font-black w-5 ${i === 0 ? 'text-[#C58A4A]' : subTextClass}`}>#{i + 1}</span>
                  <img src={prof.avatar} className="w-7 h-7 rounded-xl object-cover" alt={prof.name} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-800'}`}>{prof.name}</span>
                      <span className={`text-[10px] font-black ${subTextClass}`}>{prof.count} atend. · R$ {prof.revenue.toFixed(0)}</span>
                    </div>
                    <div className={`h-1.5 rounded-full ${isDark ? 'bg-white/5' : 'bg-zinc-100'}`}>
                      <div
                        className="h-1.5 rounded-full bg-emerald-500"
                        style={{ width: `${Math.min((prof.revenue / (professionalRanking[0]?.revenue || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
