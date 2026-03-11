import React, { useState, useMemo, useRef } from 'react';
import { Search, UserPlus, Phone, Mail, Trash2, Edit2, X, Clock, Calendar, Scissors,
         CheckCircle2, History, Camera, NotebookPen, ImagePlus, Trash } from 'lucide-react';
import { useBarberStore } from '../store';
import { Client, Appointment } from '../types';

const IMGBB_API_KEY = 'da736db48f154b9108b23a36d4393848';

const uploadToImgBB = async (file: File): Promise<string> => {
  // Comprime antes de enviar
  const compressed = await new Promise<Blob>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = img.width  * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.82);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
  const fd = new FormData();
  fd.append('image', compressed, 'photo.jpg');
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
  const data = await res.json();
  if (!data.success) throw new Error('Falha no upload da foto');
  return data.data.url as string;
};

const Clients: React.FC = () => {
  const { clients, appointments, addClient, updateClient, deleteClient, theme } = useBarberStore() as any;
  const isDark = theme !== 'light';

  const [showAddModal,   setShowAddModal]   = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [searchTerm,     setSearchTerm]     = useState('');

  const [formData, setFormData] = useState({ name: '', phone: '', email: '', password: '' });

  // ── Notes & Photos state (inside detail modal) ─────────────
  const [notes,         setNotes]         = useState('');
  const [photos,        setPhotos]        = useState<string[]>([]);
  const [uploading,     setUploading]     = useState(false);
  const [savingNotes,   setSavingNotes]   = useState(false);
  const [lightboxImg,   setLightboxImg]   = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const filteredClients = useMemo(() => clients.filter((c: any) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [clients, searchTerm]);

  const clientAppointments = useMemo(() => {
    if (!selectedClient) return { past: [], future: [] };
    const filtered = appointments
      .filter((a: any) => a.clientId === selectedClient.id || a.clientPhone === (selectedClient as any).phone)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const now = new Date(); now.setHours(0,0,0,0);
    return {
      past:   filtered.filter((a: any) => new Date(a.date) < now || a.status === 'CONCLUIDO_PAGO'),
      future: filtered.filter((a: any) => new Date(a.date) >= now && a.status !== 'CONCLUIDO_PAGO' && a.status !== 'CANCELADO'),
    };
  }, [selectedClient, appointments]);

  const openClient = (client: Client) => {
    setSelectedClient(client);
    setNotes((client as any).notes || '');
    setPhotos((client as any).photos || []);
  };

  const handleSave = async () => {
    if (formData.name && formData.phone) {
      if (editingId) await updateClient(editingId, formData);
      else           await addClient(formData);
      setFormData({ name: '', phone: '', email: '', password: '' });
      setShowAddModal(false);
      setEditingId(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedClient) return;
    setSavingNotes(true);
    try {
      await updateClient(selectedClient.id, { notes, photos });
      setSelectedClient(prev => prev ? { ...prev, notes, photos } as any : prev);
    } finally { setSavingNotes(false); }
  };

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(uploadToImgBB));
      const updated = [...photos, ...urls];
      setPhotos(updated);
      await updateClient(selectedClient!.id, { photos: updated });
      setSelectedClient(prev => prev ? { ...prev, photos: updated } as any : prev);
    } catch (err) {
      alert('Erro ao enviar foto. Verifique a conexão.');
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (url: string) => {
    if (!window.confirm('Remover esta foto?')) return;
    const updated = photos.filter(p => p !== url);
    setPhotos(updated);
    await updateClient(selectedClient!.id, { photos: updated });
    setSelectedClient(prev => prev ? { ...prev, photos: updated } as any : prev);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full overflow-auto pb-20 scrollbar-hide">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white font-display italic tracking-tight">Clientes do Barber Pub</h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">A base exclusiva da sua barbearia.</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setFormData({ name:'', phone:'', email:'', password:'' }); setShowAddModal(true); }}
          className="flex items-center gap-2 gradiente-ouro text-black px-6 md:px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl"
        >
          <UserPlus size={16} /> NOVO CLIENTE
        </button>
      </div>

      {/* Search */}
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

      {/* Table */}
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
              {filteredClients.map((client: any) => (
                <tr key={client.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => openClient(client)}>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="relative w-10 h-10 rounded-xl bg-zinc-900 border border-[#C58A4A]/20 flex items-center justify-center font-black text-[#C58A4A] text-sm italic group-hover:bg-[#C58A4A] group-hover:text-black transition-all overflow-hidden">
                        {client.avatar
                          ? <img src={client.avatar} className="w-full h-full object-cover" alt="" />
                          : client.name.charAt(0)
                        }
                        {((client.photos?.length || 0) > 0) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#C58A4A] rounded-full border border-black flex items-center justify-center">
                            <Camera size={6} className="text-black" />
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white group-hover:text-[#C58A4A] transition-all">{client.name}</p>
                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-0.5">
                          Desde: {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                          {client.notes && <span className="ml-2 text-amber-500/60">📝</span>}
                        </p>
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
                      <span className="text-xs font-black text-white italic">R$ {client.totalSpent.toFixed(2)}</span>
                      <span className="text-[9px] text-zinc-500 font-bold">Último: {client.lastVisit ? new Date(client.lastVisit).toLocaleDateString('pt-BR') : 'Nunca'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditingId(client.id); setFormData(client); setShowAddModal(true); }} className="p-2.5 bg-white/5 text-zinc-500 hover:text-white rounded-xl transition-all"><Edit2 size={14}/></button>
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

      {/* ══════════════════════════════════════════════════════
          MODAL: Detalhes do Cliente
      ══════════════════════════════════════════════════════ */}
      {selectedClient && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className="cartao-vidro w-full max-w-2xl rounded-[3rem] border-[#C58A4A]/10 shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header — fixo */}
            <div className="p-8 pb-4 flex justify-between items-start shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-[1.5rem] bg-[#C58A4A] text-black flex items-center justify-center text-3xl font-black italic overflow-hidden">
                  {(selectedClient as any).avatar
                    ? <img src={(selectedClient as any).avatar} className="w-full h-full object-cover" alt="" />
                    : selectedClient.name.charAt(0)
                  }
                </div>
                <div>
                  <h2 className="text-2xl font-black font-display italic text-white tracking-tight">{selectedClient.name}</h2>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{(selectedClient as any).phone}</p>
                </div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="p-3 text-zinc-600 hover:text-white bg-white/5 rounded-2xl transition-all"><X size={24}/></button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-8 pb-8 space-y-8">

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Total Investido</p>
                  <p className="text-xl font-black text-[#C58A4A] italic font-display">R$ {selectedClient.totalSpent.toFixed(2)}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Serviços Concluídos</p>
                  <p className="text-xl font-black text-white italic font-display">{clientAppointments.past.length}</p>
                </div>
              </div>

              {/* ── OBSERVAÇÕES DO BARBEIRO ─────────────────────── */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <NotebookPen size={14}/> Observações do Barbeiro
                </h3>
                <textarea
                  rows={4}
                  placeholder="Ex: Gosta de degradê baixo, não gosta de máquina no topo, usa pomada matte..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-amber-500/40 resize-none font-medium leading-relaxed"
                />
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="gradiente-ouro text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                >
                  {savingNotes ? '⟳ Salvando...' : '💾 Salvar Observações'}
                </button>
              </div>

              {/* ── GALERIA DE FOTOS ────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-[#C58A4A] uppercase tracking-[0.2em] flex items-center gap-2">
                    <Camera size={14}/> Fotos do Corte ({photos.length})
                  </h3>
                  <label className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest cursor-pointer transition-all ${uploading ? 'opacity-50 cursor-wait' : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20'}`}>
                    <ImagePlus size={14}/>
                    {uploading ? 'Enviando...' : 'Adicionar Fotos'}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAddPhotos}
                      disabled={uploading}
                    />
                  </label>
                </div>

                {photos.length === 0 ? (
                  <div
                    className="border-2 border-dashed border-white/10 rounded-2xl p-10 text-center cursor-pointer hover:border-[#C58A4A]/30 transition-all"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Camera size={32} className="mx-auto mb-3 text-zinc-600"/>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Nenhuma foto ainda</p>
                    <p className="text-[9px] text-zinc-700 mt-1">Clique para adicionar fotos do corte</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {photos.map((url, i) => (
                      <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden border border-white/10">
                        <img
                          src={url}
                          alt={`Corte ${i+1}`}
                          className="w-full h-full object-cover cursor-pointer transition-all group-hover:scale-105"
                          onClick={() => setLightboxImg(url)}
                        />
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(url)}
                          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600"
                        >
                          <Trash size={12}/>
                        </button>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all pointer-events-none"/>
                      </div>
                    ))}
                    {/* Add more button */}
                    <label className="aspect-square rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-[#C58A4A]/40 transition-all group">
                      <ImagePlus size={20} className="text-zinc-600 group-hover:text-[#C58A4A] transition-all mb-1"/>
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-[#C58A4A]">Mais</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} disabled={uploading}/>
                    </label>
                  </div>
                )}
              </div>

              {/* Próximos Agendamentos */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-[#C58A4A] uppercase tracking-[0.2em] flex items-center gap-2"><CheckCircle2 size={14}/> Próximos Serviços</h3>
                {clientAppointments.future.map((app: any) => (
                  <div key={app.id} className="bg-white/5 border border-[#C58A4A]/20 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-[#C58A4A]"><Calendar size={18}/></div>
                      <div>
                        <p className="text-sm font-bold text-white">{app.serviceName}</p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{new Date(app.date).toLocaleDateString('pt-BR')} • {app.startTime}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-white">R$ {app.price}</p>
                      <p className="text-[8px] font-black uppercase tracking-widest mt-1 text-blue-400">AGENDADO</p>
                    </div>
                  </div>
                ))}
                {clientAppointments.future.length === 0 && <p className="text-[10px] text-zinc-600 py-2 italic">Nenhum agendamento futuro.</p>}
              </div>

              {/* Histórico */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2"><History size={14} className="text-zinc-600"/> Histórico de Sessões</h3>
                {clientAppointments.past.map((app: any) => (
                  <div key={app.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400"><Scissors size={18}/></div>
                      <div>
                        <p className="text-sm font-bold text-white">{app.serviceName}</p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{new Date(app.date).toLocaleDateString('pt-BR')} • {app.startTime}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-white">R$ {app.price}</p>
                      <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${app.status === 'CONCLUIDO_PAGO' ? 'text-emerald-500' : 'text-zinc-500'}`}>{app.status.replace('_',' ')}</p>
                    </div>
                  </div>
                ))}
                {clientAppointments.past.length === 0 && <p className="text-[10px] text-zinc-600 py-2 italic">Nenhum histórico encontrado.</p>}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ──────────────────────────────────────────── */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in"
          onClick={() => setLightboxImg(null)}
        >
          <button className="absolute top-6 right-6 p-3 bg-white/10 rounded-2xl text-white hover:bg-white/20 transition-all">
            <X size={24}/>
          </button>
          <img
            src={lightboxImg}
            alt="Foto ampliada"
            className="max-w-full max-h-full rounded-3xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: Adicionar / Editar Cliente
      ══════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95 duration-300">
          <div className="cartao-vidro w-full max-w-lg rounded-[3rem] p-8 md:p-12 space-y-10 border-[#C58A4A]/20 shadow-2xl relative">
            <h2 className="text-2xl font-black font-display italic text-white tracking-tight">{editingId ? 'Refinar Cadastro' : 'Novo Cliente'}</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Nome Completo</label>
                <input type="text" placeholder="Ex: Carlos Alberto" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-white font-bold focus:border-[#C58A4A]/50"/>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">WhatsApp / Celular</label>
                <input type="tel" placeholder="(21) 99999-9999" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-white font-bold focus:border-[#C58A4A]/50"/>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">E-mail</label>
                <input type="email" placeholder="email@provedor.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-white font-bold focus:border-[#C58A4A]/50"/>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">
                  Senha do Portal <span className="normal-case text-zinc-700">(opcional)</span>
                </label>
                <input type="password" placeholder="Deixe vazio para o cliente definir" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-white font-bold focus:border-[#C58A4A]/50"/>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowAddModal(false)} className="flex-1 bg-white/5 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-[9px] text-zinc-600 hover:text-white transition-all">Cancelar</button>
                <button onClick={handleSave} className="flex-1 gradiente-ouro text-black py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-[9px] shadow-2xl">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Clients;
