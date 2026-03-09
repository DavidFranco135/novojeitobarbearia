import React, { useState, useMemo } from 'react';
import {
  Lock, Plus, Trash2, Bell, Phone,
  AlertTriangle, MessageSquare, X
} from 'lucide-react';
import { useBarberStore } from '../store';
import { BlockedSlot, InactivityCampaign } from '../types';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const Schedule: React.FC = () => {
  const store = useBarberStore() as any;
  const { professionals, clients, appointments, config, theme } = store;
  const { blockedSlots, addBlockedSlot, deleteBlockedSlot,
          inactivityCampaigns, addCampaign, deleteCampaign } = store;

  const [activeTab, setActiveTab] = useState<'blocks' | 'inactive'>('blocks');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  const [blockForm, setBlockForm] = useState({
    professionalId: '',
    date: '',
    startTime: '12:00',
    endTime: '13:00',
    reason: 'Almoço',
    recurring: false,
    recurringDays: [] as number[],
  });

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    daysInactive: 30,
    message: `Olá {nome}! Sentimos sua falta! 🪒\nFaz {dias} dias desde sua última visita.\nAgende agora: {link}`,
    discount: 0,
  });

  const inactiveClients = useMemo(() => {
    const threshold = 30;
    const now = new Date();
    return clients
      .map((c: any) => {
        const lastAppt = appointments
          .filter((a: any) => (a.clientId === c.id || a.clientPhone === c.phone) && a.status === 'CONCLUIDO_PAGO')
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const lastDate = lastAppt ? new Date(lastAppt.date) : new Date(c.createdAt);
        const daysAgo = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        return { ...c, daysAgo };
      })
      .filter((c: any) => c.daysAgo >= threshold)
      .sort((a: any, b: any) => b.daysAgo - a.daysAgo);
  }, [clients, appointments]);

  const handleSaveBlock = async () => {
    if (!blockForm.professionalId) { alert('Selecione um profissional!'); return; }
    if (!blockForm.recurring && !blockForm.date) { alert('Selecione uma data!'); return; }
    await addBlockedSlot({ ...blockForm, date: blockForm.recurring ? '*' : blockForm.date });
    setShowBlockModal(false);
    setBlockForm({ professionalId: '', date: '', startTime: '12:00', endTime: '13:00', reason: 'Almoço', recurring: false, recurringDays: [] });
  };

  const handleSaveCampaign = async () => {
    if (!campaignForm.name) { alert('Dê um nome à campanha!'); return; }
    await addCampaign({
      name: campaignForm.name,
      daysInactive: campaignForm.daysInactive,
      message: campaignForm.message,
      discount: campaignForm.discount,
      lastRun: '',
      clientsSent: [],
      status: 'ATIVA',
    });
    setShowCampaignModal(false);
    setCampaignForm({ name: '', daysInactive: 30, message: `Olá {nome}! Sentimos sua falta!`, discount: 0 });
    alert('✅ Campanha criada!');
  };

  const buildPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    return digits.startsWith('55') ? digits : `55${digits}`;
  };

  // Mensagem genérica para um cliente inativo
  const handleSendWhatsApp = (clientPhone: string, clientName: string, daysAgo: number) => {
    const bookingUrl = window.location.origin;
    const msg = encodeURIComponent(
      `Olá ${clientName}! Sentimos sua falta no ${config?.name || 'Sr. José'}! 🪒\nFaz ${daysAgo} dias desde sua última visita.\nAgende agora: ${bookingUrl}`
    );
    window.open(`https://wa.me/${buildPhone(clientPhone)}?text=${msg}`, '_blank');
  };

  // Envia a mensagem de uma campanha específica para um cliente
  const handleSendCampaignToClient = (clientPhone: string, clientName: string, daysAgo: number, camp: InactivityCampaign) => {
    const bookingUrl = window.location.origin;
    const text = camp.message
      .replace(/\{nome\}/gi, clientName)
      .replace(/\{dias\}/gi, String(daysAgo))
      .replace(/\{link\}/gi, bookingUrl)
      .replace(/\{desconto\}/gi, camp.discount > 0 ? `${camp.discount}%` : '');
    window.open(`https://wa.me/${buildPhone(clientPhone)}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Dispara campanha para todos os inativos compatíveis (um por um com delay)
  const handleBroadcastCampaign = (camp: InactivityCampaign) => {
    const targets = inactiveClients.filter((c: any) => c.daysAgo >= camp.daysInactive);
    if (targets.length === 0) { alert('Nenhum cliente inativo compatível com esta campanha.'); return; }
    if (!confirm(`Abrir WhatsApp para ${targets.length} cliente(s) inativo(s)?\nCada aba abrirá com 0.8s de intervalo.`)) return;
    targets.forEach((c: any, i: number) => {
      setTimeout(() => handleSendCampaignToClient(c.phone, c.name, c.daysAgo, camp), i * 800);
    });
  };

  const isDark = theme !== 'light';
  const bg    = isDark ? 'bg-[#111] border-white/10' : 'bg-white border-zinc-200 shadow-sm';
  const txt   = isDark ? 'text-white' : 'text-zinc-900';
  const lbl   = 'text-[10px] font-black uppercase tracking-widest text-zinc-400';

  // Inputs/textareas — fundo explícito para evitar herança branca do browser
  const inp = `w-full border p-4 rounded-xl outline-none font-bold text-sm transition-all focus:border-[#C58A4A] ${
    isDark
      ? 'bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600'
      : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
  }`;

  // Selects — appearance-none + fundo explícito para dark mode funcionar
  const sel = `w-full border p-4 rounded-xl outline-none font-bold text-sm transition-all focus:border-[#C58A4A] cursor-pointer ${
    isDark
      ? 'bg-zinc-900 border-zinc-700 text-white'
      : 'bg-zinc-50 border-zinc-300 text-zinc-900'
  }`;

  const overlay   = 'fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in-95';
  const mdl       = `w-full max-w-md rounded-[3rem] p-10 space-y-7 border shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide ${isDark ? 'bg-[#181818] border-[#C58A4A]/30' : 'bg-white border-zinc-200'}`;
  const btnCancel = `flex-1 py-4 rounded-2xl font-black uppercase text-[9px] transition-all ${isDark ? 'bg-white/5 text-zinc-400 hover:bg-white/10' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 h-full overflow-auto scrollbar-hide">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className={`text-3xl font-black font-display italic tracking-tight ${txt}`}>Controle de Agenda</h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Bloqueios · Clientes Inativos</p>
        </div>
        <button
          onClick={() => activeTab === 'blocks' ? setShowBlockModal(true) : setShowCampaignModal(true)}
          className="flex items-center gap-2 gradiente-ouro text-black px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl"
        >
          <Plus size={16} />
          {activeTab === 'blocks' ? 'Bloquear Horário' : 'Nova Campanha'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'blocks',   label: 'Bloqueios de Horário',          icon: Lock },
          { id: 'inactive', label: `Inativos (${inactiveClients.length})`, icon: Bell },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-[#C58A4A] text-black' : isDark ? 'bg-white/5 text-zinc-500' : 'bg-zinc-100 text-zinc-600'}`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ── Bloqueios ── */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          {professionals.map((prof: any) => {
            const slots: BlockedSlot[] = (blockedSlots || []).filter((s: BlockedSlot) => s.professionalId === prof.id);
            return (
              <div key={prof.id} className={`rounded-[2rem] p-6 border ${bg}`}>
                <div className="flex items-center gap-4 mb-6">
                  <img src={prof.avatar} className="w-12 h-12 rounded-2xl object-cover border border-[#C58A4A]/30" alt="" />
                  <div>
                    <p className={`font-black ${txt}`}>{prof.name}</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase">{slots.length} bloqueios</p>
                  </div>
                  <button onClick={() => { setBlockForm({ ...blockForm, professionalId: prof.id }); setShowBlockModal(true); }}
                    className="ml-auto p-2.5 bg-[#C58A4A]/10 text-[#C58A4A] hover:bg-[#C58A4A] hover:text-black rounded-xl transition-all">
                    <Plus size={16} />
                  </button>
                </div>
                {slots.length === 0 && <p className="text-[10px] text-zinc-600 italic text-center py-4">Nenhum bloqueio configurado.</p>}
                <div className="space-y-3">
                  {slots.map((slot: BlockedSlot) => (
                    <div key={slot.id} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-zinc-50 border-zinc-200'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center"><Lock size={16} className="text-red-500" /></div>
                        <div>
                          <p className={`font-black text-sm ${txt}`}>{slot.startTime} – {slot.endTime}</p>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase">
                            {slot.recurring ? `Recorrente: ${slot.recurringDays?.map(d => DAYS[d]).join(', ')}` : new Date(slot.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {slot.reason}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => deleteBlockedSlot(slot.id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-all"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Inativos ── */}
      {activeTab === 'inactive' && (
        <div className="space-y-4">
          {/* Campanhas existentes */}
          {(inactivityCampaigns || []).length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2">Campanhas Salvas</p>
              {(inactivityCampaigns || []).map((camp: InactivityCampaign) => {
                const targets = inactiveClients.filter((c: any) => c.daysAgo >= camp.daysInactive);
                return (
                  <div key={camp.id} className={`rounded-2xl p-5 border ${bg}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <MessageSquare size={20} className="text-[#C58A4A] shrink-0" />
                        <div>
                          <p className={`font-black text-sm ${txt}`}>{camp.name}</p>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase">
                            {camp.daysInactive}+ dias inativos {camp.discount > 0 && `· ${camp.discount}% desconto`} · {targets.length} cliente(s) elegíveis
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleBroadcastCampaign(camp)}
                          title="Enviar para todos os inativos elegíveis"
                          className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-2 rounded-xl font-black text-[9px] uppercase hover:scale-105 transition-all shadow"
                        >
                          <Phone size={11} /> Disparar ({targets.length})
                        </button>
                        <button onClick={() => deleteCampaign(camp.id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-all"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={`rounded-[2rem] p-6 border ${bg} flex items-center gap-4`}>
            <AlertTriangle className="text-amber-500 shrink-0" size={24} />
            <div>
              <p className={`font-black ${txt}`}>{inactiveClients.length} clientes sem visita há mais de 30 dias</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase">Clique em "WhatsApp" para enviar mensagem personalizada</p>
            </div>
          </div>

          {inactiveClients.map((client: any) => (
            <div key={client.id} className={`rounded-[2rem] p-5 border ${bg}`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${client.daysAgo > 60 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>{client.name.charAt(0)}</div>
                  <div>
                    <p className={`font-black ${txt}`}>{client.name}</p>
                    <p className="text-[9px] text-zinc-500 font-bold">{client.phone}</p>
                    <p className={`text-[9px] font-black uppercase mt-0.5 ${client.daysAgo > 60 ? 'text-red-500' : 'text-amber-500'}`}>{client.daysAgo} dias sem visita</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Botão mensagem genérica */}
                  <button onClick={() => handleSendWhatsApp(client.phone, client.name, client.daysAgo)}
                    className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-2.5 rounded-xl font-black text-[9px] uppercase hover:scale-105 transition-all shadow-lg">
                    <Phone size={11} /> WhatsApp
                  </button>
                  {/* Botões por campanha */}
                  {(inactivityCampaigns || [])
                    .filter((camp: InactivityCampaign) => client.daysAgo >= camp.daysInactive)
                    .map((camp: InactivityCampaign) => (
                      <button
                        key={camp.id}
                        onClick={() => handleSendCampaignToClient(client.phone, client.name, client.daysAgo, camp)}
                        title={`Enviar campanha: ${camp.name}`}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-black text-[9px] uppercase hover:scale-105 transition-all border ${isDark ? 'bg-white/5 border-white/10 text-zinc-300 hover:bg-[#C58A4A]/20 hover:border-[#C58A4A]/40' : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-amber-50 hover:border-amber-300'}`}
                      >
                        <MessageSquare size={11} /> {camp.name}
                      </button>
                    ))
                  }
                </div>
              </div>
            </div>
          ))}

          {inactiveClients.length === 0 && (
            <div className={`rounded-[2rem] p-16 text-center border ${bg}`}>
              <Bell className="mx-auto mb-4 text-zinc-600" size={48} />
              <p className="text-[10px] font-black uppercase text-zinc-600">Todos os clientes estão ativos!</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Bloquear Horário ── */}
      {showBlockModal && (
        <div className={overlay}>
          <div className={mdl}>
            <div className="flex items-center justify-between">
              <h2 className={`text-2xl font-black font-display italic ${txt}`}>Bloquear Horário</h2>
              <button onClick={() => setShowBlockModal(false)} className={`p-2 rounded-xl transition-all ${isDark ? "bg-white/5 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:text-zinc-900"}`}><X size={20} /></button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className={lbl}>Profissional</label>
                <select value={blockForm.professionalId} onChange={e => setBlockForm({ ...blockForm, professionalId: e.target.value })} className={sel} style={isDark ? { colorScheme: 'dark' } : {}}>
                  <option value="" className={isDark ? "bg-zinc-900" : "bg-white"}>Selecione...</option>
                  {professionals.map((p: any) => <option key={p.id} value={p.id} className={isDark ? "bg-zinc-900 text-white" : "bg-white text-zinc-900"}>{p.name}</option>)}
                </select>
              </div>

              <label className={`flex items-center gap-3 cursor-pointer ${txt}`}>
                <input type="checkbox" checked={blockForm.recurring} onChange={e => setBlockForm({ ...blockForm, recurring: e.target.checked })} className="w-5 h-5 rounded accent-[#C58A4A]" />
                <span className="text-sm font-black">Bloqueio Recorrente (toda semana)</span>
              </label>

              {blockForm.recurring ? (
                <div className="space-y-2">
                  <label className={lbl}>Dias da Semana</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((day, i) => (
                      <button key={i} type="button"
                        onClick={() => {
                          const days = blockForm.recurringDays.includes(i)
                            ? blockForm.recurringDays.filter(d => d !== i)
                            : [...blockForm.recurringDays, i];
                          setBlockForm({ ...blockForm, recurringDays: days });
                        }}
                        className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase ${blockForm.recurringDays.includes(i) ? 'bg-[#C58A4A] text-black' : isDark ? 'bg-white/10 text-zinc-400' : 'bg-zinc-100 text-zinc-600'}`}
                      >{day}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className={lbl}>Data</label>
                  <input type="date" value={blockForm.date} onChange={e => setBlockForm({ ...blockForm, date: e.target.value })} className={inp} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className={lbl}>Início</label>
                  <input type="time" value={blockForm.startTime} onChange={e => setBlockForm({ ...blockForm, startTime: e.target.value })} className={inp} />
                </div>
                <div className="space-y-2">
                  <label className={lbl}>Fim</label>
                  <input type="time" value={blockForm.endTime} onChange={e => setBlockForm({ ...blockForm, endTime: e.target.value })} className={inp} />
                </div>
              </div>

              <div className="space-y-2">
                <label className={lbl}>Motivo</label>
                <select value={blockForm.reason} onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })} className={sel} style={isDark ? { colorScheme: 'dark' } : {}}>
                  {['Almoço', 'Folga', 'Férias', 'Reunião', 'Manutenção', 'Outro'].map(r => <option key={r} value={r} className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900'}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowBlockModal(false)} className={btnCancel}>Cancelar</button>
              <button onClick={handleSaveBlock} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black uppercase text-[9px] hover:bg-red-700 transition-all">Bloquear</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nova Campanha ── */}
      {showCampaignModal && (
        <div className={overlay}>
          <div className={mdl}>
            <div className="flex items-center justify-between">
              <h2 className={`text-2xl font-black font-display italic ${txt}`}>Nova Campanha</h2>
              <button onClick={() => setShowCampaignModal(false)} className={`p-2 rounded-xl transition-all ${isDark ? "bg-white/5 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:text-zinc-900"}`}><X size={20} /></button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className={lbl}>Nome da Campanha</label>
                <input type="text" placeholder="Ex: Reconquista de Inativos" value={campaignForm.name}
                  onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })} className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className={lbl}>Dias Inativo</label>
                  <input type="number" min={7} value={campaignForm.daysInactive}
                    onChange={e => setCampaignForm({ ...campaignForm, daysInactive: parseInt(e.target.value) || 30 })} className={inp} />
                </div>
                <div className="space-y-2">
                  <label className={lbl}>Desconto %</label>
                  <input type="number" min={0} max={100} value={campaignForm.discount}
                    onChange={e => setCampaignForm({ ...campaignForm, discount: parseInt(e.target.value) || 0 })} className={inp} />
                </div>
              </div>
              <div className="space-y-2">
                <label className={lbl}>
                  Mensagem <span className={`normal-case ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>(use {'{nome}'}, {'{dias}'}, {'{link}'})</span>
                </label>
                <textarea rows={5} value={campaignForm.message}
                  onChange={e => setCampaignForm({ ...campaignForm, message: e.target.value })}
                  className={`${inp} resize-none`} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCampaignModal(false)} className={btnCancel}>Cancelar</button>
              <button onClick={handleSaveCampaign} className="flex-1 gradiente-ouro text-black py-4 rounded-2xl font-black uppercase text-[9px]">Criar Campanha</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
