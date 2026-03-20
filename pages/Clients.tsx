import React, { useState, useMemo } from 'react';
import { Search, UserPlus, Phone, Mail, Trash2, Edit2, X, Clock, Calendar, Scissors, CheckCircle2, History, Camera, NotebookPen, Instagram, MapPin, Briefcase, Heart, Trophy, Users, Check } from 'lucide-react';
import { useBarberStore } from '../store';
import { Client, Appointment } from '../types';

const Clients: React.FC = () => {
  const { clients, appointments, referrals, validateReferral, cancelReferral, addClient, updateClient, deleteClient, theme } = useBarberStore() as any;
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', password: '',
    cpfCnpj: '', birthdate: '', gender: '',
    address: '', neighborhood: '', city: '',
    profession: '', instagram: '', howFound: '',
  });

  const IMGBB_KEY = 'da736db48f154b9108b23a36d4393848';

  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (clients || []).filter(c => 
      (c.name || '').toLowerCase().includes(term) || 
      (c.phone || '').includes(searchTerm) ||
      (c.email || '').toLowerCase().includes(term)
    );
  }, [clients, searchTerm]);

  const clientAppointments = useMemo(() => {
    if (!selectedClient) return { past: [], future: [] };
    const filtered = appointments.filter(a => a.clientId === selectedClient.id || a.clientPhone === selectedClient.phone)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const now = new Date();
    now.setHours(0,0,0,0);

    return {
      past: filtered.filter(a => new Date(a.date) < now || a.status === 'CONCLUIDO_PAGO'),
      future: filtered.filter(a => new Date(a.date) >= now && a.status !== 'CONCLUIDO_PAGO' && a.status !== 'CANCELADO')
    };
  }, [selectedClient, appointments]);

  const emptyForm = {
    name: '', phone: '', email: '', password: '',
    cpfCnpj: '', birthdate: '', gender: '',
    address: '', neighborhood: '', city: '',
    profession: '', instagram: '', howFound: '',
  };

  const handleSave = async () => {
    if (formData.name && formData.phone) {
      if (editingId) {
        await updateClient(editingId, formData);
      } else {
        await addClient(formData);
      }
      setFormData(emptyForm);
      setShowAddModal(false);
      setEditingId(null);
    }
  };

  const openEdit = (client: Client) => {
    setEditingId(client.id);
    setFormData({
      name: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
      password: client.password || '',
      cpfCnpj: (client as any).cpfCnpj || '',
      birthdate: (client as any).birthdate || '',
      gender: (client as any).gender || '',
      address: (client as any).address || '',
      neighborhood: (client as any).neighborhood || '',
      city: (client as any).city || '',
      profession: (client as any).profession || '',
      instagram: (client as any).instagram || '',
      howFound: (client as any).howFound || '',
    });
    setShowAddModal(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full overflow-auto pb-20 scrollbar-hide">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white font-display italic tracking-tight">Clientes do Barber Pub</h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">A base exclusiva da sua barbearia.</p>
        </div>
        <button onClick={() => { setEditingId(null); setFormData(emptyForm); setShowAddModal(true); }} className="flex items-center gap-2 gradiente-ouro text-black px-6 md:px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
          <UserPlus size={16} /> NOVO CLIENTE
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
        <input 
          type="text" 
          placeholder="Pesquisar Clientes (Nome ou Celular)..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 pl-16 pr-8 text-sm focus:border-[#C58A4A]/50 outline-none transition-all placeholder:text-zinc-700 font-bold text-white"
        />
      </div>

      {/* ── Painel de Indicações Pendentes ── */}
      {(referrals || []).filter((r: any) => r.status === 'PENDENTE').length > 0 && (
        <div className={`rounded-2xl p-5 border ${theme === 'light' ? 'bg-amber-50 border-amber-200' : 'bg-[#C58A4A]/10 border-[#C58A4A]/25'}`}>
          <div className="flex items-center gap-3 mb-4">
            <Users size={18} className="text-[#C58A4A]"/>
            <h3 className={`font-black text-sm uppercase tracking-widest ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
              Indicações Pendentes de Validação
            </h3>
            <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full">
              {(referrals || []).filter((r: any) => r.status === 'PENDENTE').length}
            </span>
          </div>
          <p className={`text-[10px] mb-3 ${theme === 'light' ? 'text-amber-700' : 'text-[#C58A4A]/80'}`}>
            Valide quando o indicado concluir o primeiro corte. O indicador receberá R$ {' '}
            automaticamente na carteira.
          </p>
          <div className="space-y-2">
            {(referrals || []).filter((r: any) => r.status === 'PENDENTE').map((r: any) => (
              <div key={r.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl ${theme === 'light' ? 'bg-white border border-amber-100' : 'bg-white/5 border border-white/5'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                    👤 {r.referredName} {r.referredPhone && <span className="text-zinc-500 font-normal">· {r.referredPhone}</span>}
                  </p>
                  <p className={`text-[9px] ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Indicado por: <strong>{r.referrerName}</strong> · Recompensa: R$ {r.rewardAmount}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { if (window.confirm(`Validar indicação de ${r.referredName}?
${r.referrerName} receberá R$ ${r.rewardAmount} na carteira.`)) validateReferral(r.id); }}
                    className="flex items-center gap-1 px-3 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-xl text-[9px] font-black uppercase transition-all"
                  >
                    <Check size={11}/> Validar
                  </button>
                  <button
                    onClick={() => { if (window.confirm('Cancelar esta indicação?')) cancelReferral(r.id); }}
                    className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-all"
                  >
                    <X size={12}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cartao-vidro rounded-[2.5rem] overflow-hidden border-white/5 shadow-2xl">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-white/[0.01] text-zinc-600 text-[9px] font-black uppercase tracking-[0.2em] border-b border-white/5">
                <th className="px-8 py-6">Cliente</th>
                <th className="px-8 py-6">Contato</th>
                <th className="px-8 py-6">Frequência</th>
                <th className="px-8 py-6 text-right">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => setSelectedClient(client)}>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-[#C58A4A]/20 flex items-center justify-center font-black text-[#C58A4A] text-sm italic group-hover:bg-[#C58A4A] group-hover:text-black transition-all">
                        {(client.name || "?").charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white group-hover:text-[#C58A4A] transition-all">{client.name}</p>
                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-0.5">Desde: {client.createdAt ? new Date(client.createdAt).toLocaleDateString('pt-BR') : '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-0.5">
                      <p className="text-xs text-white font-bold flex items-center gap-2">{client.phone}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{client.email || '—'}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-white italic">R$ {(client.totalSpent || 0).toFixed(2)}</span>
                      <span className="text-[9px] text-zinc-500 font-bold">Último: {client.lastVisit ? new Date(client.lastVisit + (client.lastVisit.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR') : 'Nunca'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(client)} className="p-2.5 bg-white/5 text-zinc-500 hover:text-white rounded-xl transition-all"><Edit2 size={14}/></button>
                      <button onClick={() => deleteClient(client.id)} className="p-2.5 bg-red-500/10 text-red-500/60 hover:text-red-500 rounded-xl transition-all"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-[10px] text-zinc-600 font-black uppercase italic tracking-widest">Nenhum cliente encontrado na base.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico e Agendamentos Detalhados do Cliente */}
      {selectedClient && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className="cartao-vidro w-full max-w-2xl rounded-[3rem] p-8 md:p-12 space-y-8 border-[#C58A4A]/10 relative shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-start">
               <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-[#C58A4A] text-black flex items-center justify-center text-3xl font-black italic">{(selectedClient.name || "?").charAt(0)}</div>
                  <div>
                    <h2 className="text-2xl font-black font-display italic text-white tracking-tight">{selectedClient.name}</h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{selectedClient.phone}</p>
                  </div>
               </div>
               <button onClick={() => setSelectedClient(null)} className="p-3 text-zinc-600 hover:text-white bg-white/5 rounded-2xl transition-all"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-8 pr-2">
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                     <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Total Investido</p>
                     <p className="text-xl font-black text-[#C58A4A] italic font-display">R$ {(selectedClient.totalSpent || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                     <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Serviços Concluídos</p>
                     <p className="text-xl font-black text-white italic font-display">{clientAppointments.past.length}</p>
                  </div>
               </div>

               {/* Futuros Agendamentos */}
               <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-[#C58A4A] uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><CheckCircle2 size={14} /> Próximos Serviços</h3>
                  {clientAppointments.future.map(app => (
                    <div key={app.id} className="bg-white/5 border border-[#C58A4A]/20 p-4 rounded-2xl flex items-center justify-between group hover:bg-[#C58A4A]/5 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-[#C58A4A]"><Calendar size={18}/></div>
                          <div>
                             <p className="text-sm font-bold text-white">{app.serviceName}</p>
                             <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{new Date(app.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {app.startTime}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black text-white">R$ {(+app.price || 0).toFixed(2)}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest mt-1 text-blue-400">AGENDADO</p>
                       </div>
                    </div>
                  ))}
                  {clientAppointments.future.length === 0 && <p className="text-[10px] text-zinc-600 py-2 italic">Nenhum agendamento futuro.</p>}
               </div>

               {/* Histórico Passado */}
               <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><History size={14} className="text-zinc-600"/> Histórico de Sessões</h3>
                  {clientAppointments.past.map(app => (
                    <div key={app.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-white/10 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400"><Scissors size={18}/></div>
                          <div>
                             <p className="text-sm font-bold text-white">{app.serviceName}</p>
                             <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{new Date(app.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {app.startTime}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black text-white">R$ {(+app.price || 0).toFixed(2)}</p>
                          <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${app.status === 'CONCLUIDO_PAGO' ? 'text-emerald-500' : 'text-zinc-500'}`}>{app.status.replace('_', ' ')}</p>
                       </div>
                    </div>
                  ))}
                  {clientAppointments.past.length === 0 && <p className="text-[10px] text-zinc-600 py-2 italic">Nenhum histórico encontrado.</p>}
               </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in zoom-in-95 duration-300">
          <div className={`w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-[#C58A4A]/10'}`}>

            {/* Header */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A] mb-1">{editingId ? 'Editar Cadastro' : 'Novo Cliente'}</p>
                <h2 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                  {formData.name || 'Ficha Completa'}
                </h2>
              </div>
              <button onClick={() => { setShowAddModal(false); setEditingId(null); }} className={`p-3 rounded-2xl transition-all ${theme === 'light' ? 'bg-zinc-100 text-zinc-500' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                <X size={20}/>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-8 pb-4 space-y-5 scrollbar-hide">

              {/* Identificação */}
              <div className="space-y-2">
                <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>Identificação</p>
                <input type="text" placeholder="Nome completo *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
                <div className="grid grid-cols-2 gap-2">
                  <input type="tel" placeholder="WhatsApp *" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
                  <input type="text" placeholder="CPF / CNPJ" value={formData.cpfCnpj} onChange={e => setFormData({...formData, cpfCnpj: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
                </div>
                <input type="email" placeholder="E-mail" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
              </div>

              {/* Dados pessoais */}
              <div className="space-y-2">
                <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>Dados Pessoais</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className={`text-[8px] font-black uppercase mb-1 ml-1 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>Data de Nascimento</p>
                    <input type="date" value={formData.birthdate} onChange={e => setFormData({...formData, birthdate: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
                  </div>
                  <div>
                    <p className={`text-[8px] font-black uppercase mb-1 ml-1 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>Gênero</p>
                    <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}>
                      <option value="">Selecione</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>
                <input type="text" placeholder="Profissão" value={formData.profession} onChange={e => setFormData({...formData, profession: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
              </div>

              {/* Endereço */}
              <div className="space-y-2">
                <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>Endereço</p>
                <input type="text" placeholder="Logradouro e número" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Bairro" value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
                  <input type="text" placeholder="Cidade" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
                </div>
              </div>

              {/* Social & Origem */}
              <div className="space-y-2">
                <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>Social & Origem</p>
                <input type="text" placeholder="@instagram (sem @)" value={formData.instagram} onChange={e => setFormData({...formData, instagram: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
                <select value={formData.howFound} onChange={e => setFormData({...formData, howFound: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}>
                  <option value="">Como nos conheceu?</option>
                  <option value="Indicação">Indicação de amigo</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Google">Google</option>
                  <option value="Passando na rua">Passando na rua</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* Acesso ao portal */}
              <div className="space-y-2">
                <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>Acesso ao Portal</p>
                <input type="password" placeholder="Senha (opcional — cliente define no 1º acesso)" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={`w-full border p-4 rounded-2xl outline-none text-sm font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]/50'}`}/>
                {!formData.password && <p className={`text-[9px] font-bold ml-1 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>💡 Sem senha: o cliente define no primeiro acesso ao portal.</p>}
              </div>

            </div>

            {/* Footer buttons */}
            <div className="px-8 py-6 flex gap-3 shrink-0 border-t border-white/5">
              <button onClick={() => { setShowAddModal(false); setEditingId(null); }} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all ${theme === 'light' ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200' : 'bg-white/5 text-zinc-500 hover:text-white'}`}>Cancelar</button>
              <button onClick={handleSave} disabled={!formData.name || !formData.phone} className="flex-1 gradiente-ouro text-black py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-xl disabled:opacity-40">
                {editingId ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
