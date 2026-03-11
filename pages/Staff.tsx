import React, { useState } from 'react';
import { Users, UserPlus, Trash2, Edit2, X, Eye, EyeOff, Shield, Scissors, Monitor, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { useBarberStore } from '../store';

// Páginas disponíveis por modo
const PAGES_ALL = [
  { key: 'dashboard',     label: 'Dashboard',        icon: '📊' },
  { key: 'appointments',  label: 'Agendamentos',      icon: '📅' },
  { key: 'clients',       label: 'Membros',           icon: '👥' },
  { key: 'schedule',      label: 'Agenda Visual',     icon: '🗓️' },
  { key: 'financial',     label: 'Caixa',             icon: '💰' },
  { key: 'services',      label: 'Serviços',          icon: '✂️' },
  { key: 'professionals', label: 'Profissionais',     icon: '💈' },
  { key: 'loyalty',       label: 'Programa VIP',      icon: '⭐' },
  { key: 'subscriptions', label: 'Assinaturas',       icon: '📋' },
  { key: 'partners',      label: 'Parceiros',         icon: '🤝' },
  { key: 'suggestions',   label: 'Sugestões',         icon: '💬' },
  { key: 'automacoes',    label: 'Automações',        icon: '🤖' },
  { key: 'settings',      label: 'Configurações',     icon: '⚙️' },
];

const PRESET_BARBEIRO = ['appointments', 'schedule', 'clients'];
const PRESET_RECEPCAO = ['appointments', 'schedule', 'clients', 'services', 'financial'];

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'BARBEIRO' | 'RECEPCAO' | 'ADMIN';
  allowedPages: string[];
  defaultPage: string;
  active: boolean;
  createdAt: string;
  avatar?: string;
};

const Staff: React.FC = () => {
  const { staff, addStaff, updateStaff, deleteStaff, theme } = useBarberStore() as any;
  const isDark = theme !== 'light';

  const [showModal,   setShowModal]   = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [showPass,    setShowPass]    = useState(false);
  const [saving,      setSaving]      = useState(false);

  const empty = {
    name: '', email: '', phone: '', password: '',
    role: 'BARBEIRO' as const,
    allowedPages: [...PRESET_BARBEIRO],
    defaultPage: 'appointments',
    active: true,
  };
  const [form, setForm] = useState(empty);

  const cardClass = isDark
    ? 'cartao-vidro border-white/5'
    : 'bg-white border border-zinc-200 shadow-sm';

  const inputClass = `w-full border p-4 rounded-xl outline-none font-bold transition-all text-sm ${
    isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600' : 'bg-zinc-50 border-zinc-300 text-zinc-900'
  }`;

  const openNew = () => {
    setEditingId(null);
    setForm(empty);
    setShowModal(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditingId(s.id);
    setForm({ name: s.name, email: s.email, phone: s.phone, password: s.password, role: s.role, allowedPages: s.allowedPages, defaultPage: s.defaultPage, active: s.active });
    setShowModal(true);
  };

  const applyPreset = (preset: 'BARBEIRO' | 'RECEPCAO') => {
    const pages = preset === 'BARBEIRO' ? PRESET_BARBEIRO : PRESET_RECEPCAO;
    setForm(f => ({ ...f, role: preset, allowedPages: pages, defaultPage: pages[0] }));
  };

  const togglePage = (key: string) => {
    setForm(f => {
      const has = f.allowedPages.includes(key);
      const updated = has ? f.allowedPages.filter(p => p !== key) : [...f.allowedPages, key];
      return { ...f, allowedPages: updated, defaultPage: updated.includes(f.defaultPage) ? f.defaultPage : (updated[0] || 'appointments') };
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.email || !form.password) {
      alert('Preencha nome, e-mail e senha.');
      return;
    }
    if (form.allowedPages.length === 0) {
      alert('Selecione pelo menos uma página.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateStaff(editingId, form);
      } else {
        await addStaff(form);
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (r: string) =>
    r === 'BARBEIRO' ? { label: 'Barbeiro', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
    : r === 'RECEPCAO' ? { label: 'Recepção', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' }
    : { label: 'Admin', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full overflow-auto pb-20 scrollbar-hide">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className={`text-3xl font-black font-display italic tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Colaboradores
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            Contas de acesso da equipe — sincronizado com Firebase.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 gradiente-ouro text-black px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl"
        >
          <UserPlus size={16}/> NOVO COLABORADOR
        </button>
      </div>

      {/* Info banner */}
      <div className={`rounded-2xl p-5 border flex items-start gap-4 ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
        <Shield size={20} className="text-amber-500 shrink-0 mt-0.5"/>
        <div>
          <p className={`text-sm font-black ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Como funciona</p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            Cada colaborador acessa o sistema com e-mail e senha próprios. Você controla quais páginas ficam visíveis para cada um.
            O modo <strong>Barbeiro</strong> libera agenda e atendimentos. O modo <strong>Recepção</strong> inclui caixa e membros.
          </p>
        </div>
      </div>

      {/* List */}
      {(!staff || staff.length === 0) ? (
        <div className={`${cardClass} rounded-[2.5rem] p-16 text-center`}>
          <Users size={48} className="mx-auto mb-4 text-zinc-700"/>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            Nenhum colaborador cadastrado ainda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {(staff as StaffMember[]).map(s => {
            const rl = roleLabel(s.role);
            return (
              <div key={s.id} className={`${cardClass} rounded-[2.5rem] p-7 space-y-5 relative`}>
                {/* Active badge */}
                <div className={`absolute top-5 right-5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${s.active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-800 border-zinc-700'}`}>
                  {s.active ? '● ATIVO' : '○ INATIVO'}
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C58A4A] to-[#8B5E2E] flex items-center justify-center text-black font-black text-2xl italic shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <p className={`font-black text-base ${isDark ? 'text-white' : 'text-zinc-900'}`}>{s.name}</p>
                    <p className="text-[10px] text-zinc-500">{s.email}</p>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${rl.color}`}>
                  {s.role === 'BARBEIRO' ? <Scissors size={11}/> : <Monitor size={11}/>}
                  {rl.label}
                </span>

                {/* Pages chips */}
                <div className="flex flex-wrap gap-1.5">
                  {s.allowedPages.slice(0, 6).map(p => {
                    const pg = PAGES_ALL.find(x => x.key === p);
                    return pg ? (
                      <span key={p} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide ${isDark ? 'bg-white/5 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                        {pg.icon} {pg.label}
                      </span>
                    ) : null;
                  })}
                  {s.allowedPages.length > 6 && (
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black ${isDark ? 'bg-white/5 text-zinc-600' : 'bg-zinc-100 text-zinc-400'}`}>
                      +{s.allowedPages.length - 6}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => openEdit(s)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${isDark ? 'bg-white/5 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}
                  >
                    <Edit2 size={13}/> Editar
                  </button>
                  <button
                    onClick={async () => {
                      await updateStaff(s.id, { active: !s.active });
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${s.active ? (isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-400') : (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-500')}`}
                  >
                    {s.active ? <><ToggleRight size={13}/> Desativar</> : <><ToggleLeft size={13}/> Ativar</>}
                  </button>
                  <button
                    onClick={() => { if (window.confirm(`Remover ${s.name}?`)) deleteStaff(s.id); }}
                    className="p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL: Criar / Editar Colaborador
      ══════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className={`w-full max-w-xl rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] ${isDark ? 'cartao-vidro border-[#C58A4A]/10' : 'bg-white border border-zinc-200'}`}>

            {/* Header */}
            <div className="p-8 pb-4 flex justify-between items-center shrink-0">
              <h2 className={`text-2xl font-black font-display italic tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {editingId ? 'Editar Colaborador' : 'Novo Colaborador'}
              </h2>
              <button onClick={() => setShowModal(false)} className={`p-3 rounded-2xl transition-all ${isDark ? 'bg-white/5 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                <X size={20}/>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-8 pb-4 space-y-6 scrollbar-hide">

              {/* Dados básicos */}
              <div className="space-y-3">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Dados Pessoais</label>
                <input type="text"  placeholder="Nome completo"        value={form.name}  onChange={e => setForm(f => ({...f, name: e.target.value}))}  className={inputClass}/>
                <input type="email" placeholder="E-mail de acesso"     value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className={inputClass}/>
                <input type="tel"   placeholder="WhatsApp (opcional)"  value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className={inputClass}/>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Senha de acesso (mín. 6 caracteres)"
                    value={form.password}
                    onChange={e => setForm(f => ({...f, password: e.target.value}))}
                    className={inputClass + ' pr-12'}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {/* Modo / Preset */}
              <div className="space-y-3">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Modo de Acesso</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'BARBEIRO', label: 'Barbeiro', icon: <Scissors size={18}/>, desc: 'Agenda, atendimentos e membros' },
                    { key: 'RECEPCAO', label: 'Recepção', icon: <Monitor size={18}/>, desc: 'Agenda, caixa, membros e mais' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => applyPreset(opt.key as any)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all space-y-2 ${form.role === opt.key ? 'border-[#C58A4A] bg-[#C58A4A]/10' : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'}`}
                    >
                      <div className={`${form.role === opt.key ? 'text-[#C58A4A]' : isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{opt.icon}</div>
                      <p className={`font-black text-sm ${form.role === opt.key ? (isDark ? 'text-white' : 'text-zinc-900') : isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{opt.label}</p>
                      <p className={`text-[9px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Páginas liberadas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Páginas Visíveis ({form.allowedPages.length} selecionadas)
                  </label>
                  <span className={`text-[9px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Toque para ativar/desativar</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PAGES_ALL.map(pg => {
                    const on = form.allowedPages.includes(pg.key);
                    return (
                      <button
                        key={pg.key}
                        type="button"
                        onClick={() => togglePage(pg.key)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${on ? (isDark ? 'border-[#C58A4A]/40 bg-[#C58A4A]/10' : 'border-amber-300 bg-amber-50') : (isDark ? 'border-white/5 bg-white/[0.02] hover:bg-white/5' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100')}`}
                      >
                        <span className="text-base">{pg.icon}</span>
                        <span className={`text-[10px] font-black flex-1 ${on ? (isDark ? 'text-[#C58A4A]' : 'text-amber-700') : isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{pg.label}</span>
                        {on && <Check size={12} className="text-[#C58A4A] shrink-0"/>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Página inicial */}
              {form.allowedPages.length > 0 && (
                <div className="space-y-2">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Página inicial ao entrar</label>
                  <select
                    value={form.defaultPage}
                    onChange={e => setForm(f => ({...f, defaultPage: e.target.value}))}
                    className={inputClass}
                  >
                    {form.allowedPages.map(key => {
                      const pg = PAGES_ALL.find(x => x.key === key);
                      return pg ? <option key={key} value={key} className="bg-zinc-950">{pg.icon} {pg.label}</option> : null;
                    })}
                  </select>
                </div>
              )}

              {/* Ativo */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-50'}`}>
                <div>
                  <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>Conta Ativa</p>
                  <p className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Colaboradores inativos não conseguem entrar</p>
                </div>
                <button type="button" onClick={() => setForm(f => ({...f, active: !f.active}))}>
                  {form.active
                    ? <ToggleRight size={32} className="text-emerald-500"/>
                    : <ToggleLeft  size={32} className="text-zinc-500"/>
                  }
                </button>
              </div>

            </div>

            {/* Footer */}
            <div className={`p-8 pt-4 flex gap-3 shrink-0 border-t ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
              <button onClick={() => setShowModal(false)} className={`flex-1 py-5 rounded-2xl font-black text-[9px] uppercase tracking-widest ${isDark ? 'bg-white/5 text-zinc-500 hover:text-white' : 'bg-zinc-100 text-zinc-500'} transition-all`}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 gradiente-ouro text-black py-5 rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-xl disabled:opacity-50">
                {saving ? '⟳ Salvando...' : editingId ? '✓ Atualizar' : '+ Criar Conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
