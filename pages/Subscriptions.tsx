import React, { useState, useMemo } from 'react';
import {
  Crown, Plus, X, Check, Clock, AlertCircle,
  TrendingUp, Users, DollarSign, MessageSquare,
  CheckSquare, Square, Send, PhoneCall, Bell
} from 'lucide-react';
import { useBarberStore } from '../store';
import { Subscription } from '../types';

const Subscriptions: React.FC = () => {
  const store = useBarberStore() as any;
  const { clients, config, theme } = store;
  const { subscriptions, addSubscription, updateSubscription } = store;

  const [showModal, setShowModal]         = useState(false);
  const [filterStatus, setFilterStatus]   = useState<'TODAS' | 'ATIVA' | 'A_VENCER' | 'VENCIDA' | 'CANCELADA'>('TODAS');
  const [selectedIds, setSelectedIds]     = useState<string[]>([]);   // multi-select para lembrete
  const [formData, setFormData]           = useState({
    clientId: '',
    planId: '',
    usageLimit: 0,
    paymentMethod: 'PIX',
  });

  const plans = config.vipPlans?.filter((p: any) => p.status === 'ATIVO') || [];

  // ── label legível do período ──────────────────────────────────
  const periodLabel = (plan: any) => {
    if (!plan) return '';
    if (plan.period === 'MENSAL')  return 'mês';
    if (plan.period === 'ANUAL')   return 'ano';
    if (plan.period === 'SEMANAL') return 'semana';
    if (plan.period === 'DIAS')    return `${plan.customDays || '?'}d`;
    return plan.period;
  };

  // ── calcula data de fim baseada no período do plano ───────────
  const calcEndDate = (plan: any): Date => {
    const end = new Date();
    if (plan.period === 'MENSAL')  end.setMonth(end.getMonth() + 1);
    else if (plan.period === 'ANUAL')   end.setFullYear(end.getFullYear() + 1);
    else if (plan.period === 'SEMANAL') end.setDate(end.getDate() + 7);
    else if (plan.period === 'DIAS')    end.setDate(end.getDate() + (plan.customDays || 30));
    else end.setMonth(end.getMonth() + 1);
    return end;
  };

  // ── enriquece assinaturas com status computado e dias restantes
  const enriched = useMemo(() => {
    const subs: Subscription[] = subscriptions || [];
    const today = new Date();
    return subs
      .map(sub => {
        const end = new Date(sub.endDate);
        let computedStatus: string = sub.status;
        if (sub.status === 'ATIVA' && end < today) computedStatus = 'VENCIDA';
        const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const aVencer  = sub.status === 'ATIVA' && daysLeft > 0 && daysLeft <= 5;
        return { ...sub, computedStatus, daysLeft, aVencer };
      })
      .filter(s => {
        if (filterStatus === 'TODAS')    return true;
        if (filterStatus === 'A_VENCER') return s.aVencer;
        return s.computedStatus === filterStatus;
      });
  }, [subscriptions, filterStatus]);

  // ── assinaturas A VENCER (para badge e aba) ──────────────────
  const aVencerCount = useMemo(() => {
    const subs: Subscription[] = subscriptions || [];
    const today = new Date();
    return subs.filter(s => {
      const end   = new Date(s.endDate);
      const days  = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return s.status === 'ATIVA' && days > 0 && days <= 5;
    }).length;
  }, [subscriptions]);

  const stats = useMemo(() => {
    const subs: Subscription[] = subscriptions || [];
    const ativas = subs.filter(s => s.status === 'ATIVA');
    const mrr    = ativas.reduce((a, s) => a + s.price, 0);
    return {
      total:   subs.length,
      ativas:  ativas.length,
      mrr,
      vencidas: subs.filter(s => s.status === 'VENCIDA').length,
    };
  }, [subscriptions]);

  // ── criar assinatura ─────────────────────────────────────────
  const handleCreate = async () => {
    if (!formData.clientId || !formData.planId) {
      alert('Selecione cliente e plano!');
      return;
    }
    const client = clients.find((c: any) => c.id === formData.clientId);
    const plan   = plans.find((p: any) => p.id === formData.planId);
    if (!client || !plan) return;

    const startDate = new Date();
    const endDate   = calcEndDate(plan);

    await addSubscription({
      clientId:    formData.clientId,
      clientName:  client.name,
      planId:      formData.planId,
      planName:    plan.name,
      price:       plan.price,
      startDate:   startDate.toISOString().split('T')[0],
      endDate:     endDate.toISOString().split('T')[0],
      status:      'ATIVA',
      usageCount:  0,
      usageLimit:  formData.usageLimit || undefined,
      paymentHistory: [{
        id:     `pay_${Date.now()}`,
        date:   new Date().toLocaleDateString('pt-BR'),
        amount: plan.price,
        method: formData.paymentMethod,
        status: 'PAGO',
      }],
      createdAt: new Date().toISOString(),
    });
    setShowModal(false);
    setFormData({ clientId: '', planId: '', usageLimit: 0, paymentMethod: 'PIX' });
    alert('✅ Assinatura criada com sucesso!');
  };

  // ── toggle seleção individual ────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── selecionar / desselecionar todos os A VENCER ─────────────
  const toggleSelectAll = () => {
    const ids = enriched.map(s => s.id);
    setSelectedIds(prev => prev.length === ids.length ? [] : ids);
  };

  // ── abrir WhatsApp com mensagem de lembrete ──────────────────
  const openWhatsApp = (sub: any) => {
    const client = clients.find((c: any) => c.id === sub.clientId);
    const phone  = (client?.phone || sub.clientPhone || '').replace(/\D/g, '');
    if (!phone) { alert('Cliente sem telefone cadastrado!'); return; }
    const shopName = config.name || 'Barbearia';
    const msg = encodeURIComponent(
      `Olá ${sub.clientName}! 👋\n\nPassando para avisar que sua assinatura *${sub.planName}* na *${shopName}* vence em *${sub.daysLeft} dia(s)* (${new Date(sub.endDate).toLocaleDateString('pt-BR')}).\n\nPara renovar e continuar aproveitando todos os benefícios, entre em contato conosco! ✂️🔥`
    );
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
  };

  // ── enviar lembrete para todos os selecionados ───────────────
  const handleSendReminders = () => {
    if (selectedIds.length === 0) {
      alert('Selecione ao menos um cliente!');
      return;
    }
    const toSend = enriched.filter(s => selectedIds.includes(s.id));
    toSend.forEach((sub, i) => {
      setTimeout(() => openWhatsApp(sub), i * 600); // abre um por vez com delay
    });
    setSelectedIds([]);
  };

  // ── estilos ──────────────────────────────────────────────────
  const statusConfig = {
    ATIVA:    { color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: Check },
    VENCIDA:  { color: 'text-red-500 bg-red-500/10 border-red-500/20',            icon: AlertCircle },
    CANCELADA:{ color: 'text-zinc-500 bg-white/5 border-white/10',                icon: X },
    PAUSADA:  { color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',      icon: Clock },
  };

  const isDark     = theme !== 'light';
  const bg         = isDark ? 'bg-[#111] border-white/10' : 'bg-white border-zinc-200 shadow-sm';
  const txt        = isDark ? 'text-white' : 'text-zinc-900';
  const optStyle   = { backgroundColor: isDark ? '#18181b' : '#fff', color: isDark ? '#fff' : '#18181b' };
  const inp        = `w-full border p-4 rounded-xl outline-none font-bold text-sm transition-all
    ${isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-[#C58A4A]'
             : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]'}`;
  const overlay    = 'fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in-95';
  const mdl        = `w-full max-w-md rounded-[3rem] p-10 space-y-7 border shadow-2xl
    ${isDark ? 'bg-[#111] border-[#C58A4A]/30' : 'bg-white border-zinc-200'}`;
  const btnCancel  = `flex-1 py-4 rounded-2xl font-black uppercase text-[9px]
    ${isDark ? 'bg-white/5 text-zinc-500' : 'bg-zinc-100 text-zinc-600'}`;
  const lbl        = `text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`;

  // ── tabs ─────────────────────────────────────────────────────
  const tabs: { key: typeof filterStatus; label: string; badge?: number }[] = [
    { key: 'TODAS',     label: 'Todas' },
    { key: 'ATIVA',     label: 'Ativas' },
    { key: 'A_VENCER',  label: 'A Vencer', badge: aVencerCount },
    { key: 'VENCIDA',   label: 'Vencidas' },
    { key: 'CANCELADA', label: 'Canceladas' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 h-full overflow-auto scrollbar-hide">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className={`text-3xl font-black font-display italic tracking-tight ${txt}`}>Assinaturas</h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Controle de planos · lembretes · renovações</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 gradiente-ouro text-black px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
          <Plus size={16} /> Nova Assinatura
        </button>
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',    value: stats.total,              icon: Users,       color: '#C58A4A' },
          { label: 'Ativas',   value: stats.ativas,             icon: Crown,       color: '#10b981' },
          { label: 'MRR',      value: `R$ ${stats.mrr.toFixed(2)}`, icon: TrendingUp, color: '#3b82f6' },
          { label: 'Vencidas', value: stats.vencidas,           icon: AlertCircle, color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} className={`rounded-[2rem] p-6 border ${bg}`}>
            <s.icon size={22} style={{ color: s.color }} className="mb-4" />
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{s.label}</p>
            <p className="text-2xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs de filtro ── */}
      <div className="flex gap-2 flex-wrap items-center">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setFilterStatus(t.key); setSelectedIds([]); }}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
              ${filterStatus === t.key
                ? t.key === 'A_VENCER'
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                  : 'bg-[#C58A4A] text-black shadow-lg'
                : isDark ? 'bg-white/5 text-zinc-500 hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
            {t.key === 'A_VENCER' && <Bell size={11} />}
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-black
                ${filterStatus === t.key ? 'bg-black/20 text-white' : 'bg-amber-500 text-black'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Banner + ações quando está na aba A VENCER ── */}
      {filterStatus === 'A_VENCER' && (
        <div className={`rounded-2xl p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4
          ${isDark ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-400/30 bg-amber-50'}`}>
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-amber-500 font-black text-sm">
                {aVencerCount} assinatura{aVencerCount !== 1 ? 's' : ''} vence{aVencerCount === 1 ? '' : 'm'} em até 5 dias
              </p>
              <p className={`text-[10px] font-bold mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Selecione os clientes abaixo e envie um lembrete pelo WhatsApp
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={toggleSelectAll}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase border transition-all
                ${isDark ? 'border-white/10 bg-white/5 text-zinc-400 hover:text-white' : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'}`}>
              {selectedIds.length === enriched.length && enriched.length > 0
                ? <><CheckSquare size={14}/> Desmarcar todos</>
                : <><Square size={14}/> Selecionar todos</>}
            </button>
            {selectedIds.length > 0 && (
              <button onClick={handleSendReminders}
                className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase shadow-lg shadow-emerald-500/30 hover:scale-105 transition-all">
                <MessageSquare size={14} />
                Enviar lembrete{selectedIds.length > 1 ? 's' : ''} ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Lista de assinaturas ── */}
      <div className="space-y-4">
        {enriched.length === 0 && (
          <div className={`rounded-[2rem] p-16 text-center border ${bg}`}>
            <Crown className="mx-auto mb-4 text-zinc-600" size={48} />
            <p className="text-[10px] font-black uppercase text-zinc-600">
              {filterStatus === 'A_VENCER' ? 'Nenhuma assinatura vencendo nos próximos 5 dias.' : 'Nenhuma assinatura encontrada.'}
            </p>
          </div>
        )}

        {enriched.map(sub => {
          const sc         = statusConfig[sub.computedStatus as keyof typeof statusConfig] || statusConfig.ATIVA;
          const StatusIcon = sc.icon;
          const usagePct   = sub.usageLimit ? Math.min(100, Math.round((sub.usageCount / sub.usageLimit) * 100)) : null;
          const isSelected = selectedIds.includes(sub.id);
          const isAVencer  = sub.aVencer;

          return (
            <div key={sub.id}
              className={`rounded-[2rem] p-6 md:p-8 border transition-all
                ${isAVencer && filterStatus === 'A_VENCER'
                  ? isDark
                    ? `${bg} border-amber-500/30 ${isSelected ? 'ring-2 ring-amber-500/50' : ''}`
                    : `bg-amber-50 border-amber-300 ${isSelected ? 'ring-2 ring-amber-400' : ''}`
                  : bg}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                {/* ── Checkbox de seleção (visível na aba A VENCER) ── */}
                <div className="flex items-center gap-4 flex-1">
                  {filterStatus === 'A_VENCER' && (
                    <button onClick={() => toggleSelect(sub.id)}
                      className="flex-shrink-0 transition-transform hover:scale-110">
                      {isSelected
                        ? <CheckSquare size={22} className="text-amber-500" />
                        : <Square size={22} className={isDark ? 'text-zinc-600' : 'text-zinc-400'} />}
                    </button>
                  )}

                  {/* Avatar + info */}
                  <div className="flex items-center gap-5 flex-1">
                    <div className="w-14 h-14 rounded-2xl bg-[#C58A4A]/10 flex items-center justify-center text-2xl font-black text-[#C58A4A] flex-shrink-0">
                      {sub.clientName?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className={`font-black text-lg ${txt}`}>{sub.clientName}</p>
                      <p className="text-zinc-500 text-[9px] font-black uppercase">{sub.planName}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase ${sc.color}`}>
                          <StatusIcon size={10} /> {sub.computedStatus}
                        </span>
                        {sub.computedStatus === 'ATIVA' && sub.daysLeft > 0 && (
                          <span className={`text-[9px] font-black ${sub.daysLeft <= 5 ? 'text-amber-500' : isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            {sub.daysLeft <= 5 ? `⚠️ Vence em ${sub.daysLeft}d` : `${sub.daysLeft}d restantes`}
                          </span>
                        )}
                        {sub.computedStatus === 'ATIVA' && sub.daysLeft <= 0 && (
                          <span className="text-[9px] font-black text-amber-500">Vence hoje</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Ações ── */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Usos</p>
                    <p className={`font-black text-xl ${txt}`}>{sub.usageCount}{sub.usageLimit ? `/${sub.usageLimit}` : ''}</p>
                    {usagePct !== null && (
                      <div className={`mt-1 w-16 h-1.5 rounded-full ${isDark ? 'bg-white/10' : 'bg-zinc-200'}`}>
                        <div className="h-full bg-[#C58A4A] rounded-full" style={{ width: `${usagePct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Valor</p>
                    <p className="font-black text-xl text-[#C58A4A]">R$ {sub.price.toFixed(2)}</p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {/* ── Botão WhatsApp individual ── */}
                    {sub.computedStatus === 'ATIVA' && (
                      <button onClick={() => openWhatsApp(sub)}
                        title="Enviar lembrete no WhatsApp"
                        className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all">
                        <MessageSquare size={16} />
                      </button>
                    )}
                    {sub.computedStatus === 'ATIVA' && (
                      <button onClick={() => updateSubscription(sub.id, { usageCount: (sub.usageCount || 0) + 1 })}
                        className="p-3 gradiente-ouro text-black rounded-xl font-black text-[10px]">+Uso</button>
                    )}
                    <button onClick={() => updateSubscription(sub.id, { status: sub.status === 'ATIVA' ? 'CANCELADA' : 'ATIVA' })}
                      className={`p-3 rounded-xl text-[9px] font-black border transition-all
                        ${isDark ? 'bg-white/5 border-white/10 text-zinc-500 hover:text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200'}`}>
                      {sub.status === 'ATIVA' ? 'Cancelar' : 'Reativar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal Nova Assinatura ── */}
      {showModal && (
        <div className={overlay}>
          <div className={mdl}>
            <div className="flex items-center justify-between">
              <h2 className={`text-2xl font-black font-display italic ${txt}`}>Nova Assinatura</h2>
              <button onClick={() => setShowModal(false)}
                className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Cliente */}
              <div className="space-y-2">
                <label className={lbl}>Cliente</label>
                <select
                  value={formData.clientId}
                  onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                  className={inp}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                >
                  <option value="" style={optStyle}>Selecione o cliente...</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id} style={optStyle}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Plano */}
              <div className="space-y-2">
                <label className={lbl}>Plano VIP</label>
                <select
                  value={formData.planId}
                  onChange={e => setFormData({ ...formData, planId: e.target.value })}
                  className={inp}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                >
                  <option value="" style={optStyle}>Selecione o plano...</option>
                  {plans.map((p: any) => (
                    <option key={p.id} value={p.id} style={optStyle}>
                      {p.name} — R$ {p.price}/{periodLabel(p)}
                    </option>
                  ))}
                </select>
                {plans.length === 0 && (
                  <p className="text-[10px] text-amber-500 font-bold">⚠️ Nenhum plano VIP ativo. Crie um em Configurações.</p>
                )}
                {/* Preview do plano selecionado */}
                {formData.planId && (() => {
                  const plan = plans.find((p: any) => p.id === formData.planId);
                  if (!plan) return null;
                  const end = calcEndDate(plan);
                  return (
                    <div className={`p-3 rounded-xl border mt-2 ${isDark ? 'border-[#C58A4A]/20 bg-[#C58A4A]/5' : 'border-amber-300 bg-amber-50'}`}>
                      <p className="text-[9px] font-black uppercase text-[#C58A4A]">
                        Vencimento: {end.toLocaleDateString('pt-BR')} · {periodLabel(plan)}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Limite de usos */}
              <div className="space-y-2">
                <label className={lbl}>Limite de Usos (coloque a quantidade de usos)</label>
                <input
                  type="number" min={0}
                  value={formData.usageLimit}
                  onChange={e => setFormData({ ...formData, usageLimit: parseInt(e.target.value) || 0 })}
                  className={inp}
                />
              </div>

              {/* Forma de pagamento */}
              <div className="space-y-2">
                <label className={lbl}>Forma de Pagamento</label>
                <select
                  value={formData.paymentMethod}
                  onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className={inp}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                >
                  {['PIX', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro'].map(m => (
                    <option key={m} value={m} style={optStyle}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className={btnCancel}>Cancelar</button>
              <button onClick={handleCreate} className="flex-1 gradiente-ouro text-black py-4 rounded-2xl font-black uppercase text-[9px]">
                Criar Assinatura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
