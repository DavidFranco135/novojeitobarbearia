import React, { useState } from 'react';
import {
  Save, Store, Upload, ImageIcon, User as UserIcon, Trash2, Plus, Camera,
  MapPin, RotateCcw, Crown, X, Star, Image, Phone, Instagram,
  Clock, Link, Edit3
} from 'lucide-react';
import { useBarberStore } from '../store';
import { VipPlan } from '../types';

const Settings: React.FC = () => {
  const { config, updateConfig, user, updateUser, resetAllLikes, theme, appointments, clients } = useBarberStore() as any;
  const [formData, setFormData] = useState({ ...config });
  const [userData, setUserData] = useState({
    name: user?.name || '',
    avatar: user?.avatar || config.logo || 'https://i.pravatar.cc/150'
  });
  const [loading, setLoading] = useState(false);
  const [cutGalleryDesc, setCutGalleryDesc] = useState('');
  const [cutGalleryLoading, setCutGalleryLoading] = useState(false);
  const [newAdminPass, setNewAdminPass] = useState('');
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessMsg, setReprocessMsg] = useState<{ok:boolean;txt:string}|null>(null);
  // ── Abas do Settings ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'geral'|'planos'|'fidelidade'|'seguranca'>('geral');
  // ── Gestão de Selos ───────────────────────────────────────────
  const [loyaltyCards, setLoyaltyCards] = useState<any[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltySearch, setLoyaltySearch] = useState('');
  const [editingCard, setEditingCard] = useState<any>(null);
  const [editStamps, setEditStamps] = useState('');
  const [editCredits, setEditCredits] = useState('');
  const [editFreeCuts, setEditFreeCuts] = useState('');
  const [loyaltySaveMsg, setLoyaltySaveMsg] = useState<{ok:boolean;txt:string}|null>(null);
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [passMsg, setPassMsg] = useState<{ok:boolean;txt:string}|null>(null);
  const [showVipPlanModal, setShowVipPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<VipPlan | null>(null);
  const [newPlan, setNewPlan] = useState<Partial<VipPlan>>({
    name: '', price: 0, period: 'MENSAL', benefits: [''], status: 'ATIVO', maxCuts: 4, vipCommissionPct: 50, members: []
  });

  const IMGBB_API_KEY = 'da736db48f154b9108b23a36d4393848';

  const uploadToImgBB = async (file: File): Promise<string> => {
    const data = new FormData();
    data.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: data });
    const json = await res.json();
    if (json.success) return json.data.url;
    throw new Error('Erro no upload');
  };

  const handleImageChange = async (
    field: 'logo' | 'coverImage' | 'loginBackground' | 'aboutImage' | 'locationImage',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const url = await uploadToImgBB(file);
      setFormData(prev => ({ ...prev, [field]: url }));
      if (field === 'logo') setUserData(prev => ({ ...prev, avatar: url }));
    } catch { alert('Erro ao subir imagem.'); }
    finally { setLoading(false); }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const url = await uploadToImgBB(file);
      setFormData(prev => ({ ...prev, gallery: [...(prev.gallery || []), url] }));
    } catch { alert('Erro na galeria.'); }
    finally { setLoading(false); }
  };

  const removeGalleryImage = (index: number) => {
    setFormData(prev => ({ ...prev, gallery: (prev.gallery || []).filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updatedConfig = { ...formData, logo: userData.avatar, adminName: userData.name };
      await updateConfig(updatedConfig);
      if (user) {
        const updatedUser = { ...user, name: userData.name, avatar: userData.avatar };
        updateUser(updatedUser);
        localStorage.setItem('brb_user', JSON.stringify(updatedUser));
      }
      alert('✅ Configurações Master Sincronizadas!');
    } catch (err) {
      console.error(err);
      alert('Erro ao sincronizar.');
    } finally { setLoading(false); }
  };

  // ── VIP Plans helpers ────────────────────────────────────────
  const handleSaveVipPlan = () => {
    if (!newPlan.name || !newPlan.price || !newPlan.benefits?.filter(b => b.trim()).length) {
      alert('Preencha todos os campos!'); return;
    }
    const plan: VipPlan = {
      id: editingPlan?.id || `vip${Date.now()}`,
      name: newPlan.name!,
      price: newPlan.price!,
      period: newPlan.period!,
      customDays: newPlan.customDays,
      benefits: newPlan.benefits!.filter(b => b.trim()),
      discount: newPlan.discount ?? 0,
      featured: newPlan.featured ?? false,
      status: newPlan.status!,
      members: (newPlan as any).members || [],
      // maxCuts = soma dos cortes de todos os membros (ou valor manual se sem membros)
      maxCuts: ((newPlan as any).members && (newPlan as any).members.length > 0)
        ? (newPlan as any).members.reduce((s: number, m: any) => s + (m.cuts || 0), 0)
        : (newPlan.maxCuts ?? 4),
      vipCommissionPct: newPlan.vipCommissionPct ?? 50
    };
    const current = formData.vipPlans || [];
    setFormData(prev => ({
      ...prev,
      vipPlans: editingPlan ? current.map(p => p.id === editingPlan.id ? plan : p) : [...current, plan]
    }));
    setShowVipPlanModal(false);
    setEditingPlan(null);
    setNewPlan({ name: '', price: 0, period: 'MENSAL', benefits: [''], status: 'ATIVO', customDays: 30, featured: false, maxCuts: 4, vipCommissionPct: 50, members: [] });
  };

  const handleEditPlan   = (plan: VipPlan) => { setEditingPlan(plan); setNewPlan(plan); setShowVipPlanModal(true); };
  const handleDeletePlan = (id: string)    => { if (confirm('Excluir plano?')) setFormData(prev => ({ ...prev, vipPlans: (prev.vipPlans || []).filter(p => p.id !== id) })); };
  const handleTogglePlan = (id: string)    => setFormData(prev => ({ ...prev, vipPlans: (prev.vipPlans || []).map(p => p.id === id ? { ...p, status: p.status === 'ATIVO' ? 'INATIVO' as const : 'ATIVO' as const } : p) }));

  const addBenefit    = ()                        => setNewPlan(prev => ({ ...prev, benefits: [...(prev.benefits || []), ''] }));
  const updateBenefit = (i: number, v: string)    => { const b = [...(newPlan.benefits || [])]; b[i] = v; setNewPlan(prev => ({ ...prev, benefits: b })); };
  const removeBenefit = (i: number)               => setNewPlan(prev => ({ ...prev, benefits: (prev.benefits || []).filter((_, idx) => idx !== i) }));

  // ── Styles ────────────────────────────────────────────────────
  const isDark = theme !== 'light';
  const inp  = `w-full border-2 p-5 rounded-2xl font-bold outline-none transition-all ${isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-[#C58A4A]' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]'}`;
  const lbl  = `text-[10px] font-black uppercase tracking-widest ml-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`;
  const card = `rounded-[3rem] p-8 md:p-12 border-2 space-y-8 ${isDark ? 'cartao-vidro border-white/10' : 'bg-white border-zinc-200 shadow-sm'}`;
  const h3   = `text-xl font-black font-display italic flex items-center gap-3 ${isDark ? 'text-white' : 'text-zinc-900'}`;

  // Upload card helper
  const ImgCard = ({ label, field, src }: { label: string; field: any; src?: string }) => (
    <div className="space-y-3">
      <label className={lbl}>{label}</label>
      <div className={`relative group h-36 rounded-2xl overflow-hidden border-2 ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-50'}`}>
        {src ? (
          <img src={src} className="w-full h-full object-cover" alt={label} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image size={32} className="text-zinc-600" />
          </div>
        )}
        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center cursor-pointer gap-2 text-white text-[10px] font-black uppercase tracking-widest">
          <Upload size={24} /> {loading ? 'Enviando...' : 'Trocar Foto'}
          <input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(field, e)} disabled={loading} />
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 h-full overflow-auto scrollbar-hide">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className={`text-4xl font-black font-display italic tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>Painel Master</h1>
          <p className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Configurações Avançadas · Página Pública · Planos</p>
        </div>
        <button
          type="button" disabled={loading}
          className="flex items-center justify-center gap-3 text-white px-12 py-5 rounded-[2.5rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
          onClick={handleSave}
          style={{ backgroundColor: '#66360f' }}
        >
          {loading ? '⏳ Sincronizando...' : <><Save size={20} /> Gravar Tudo</>}
        </button>
      </div>

      {/* ── Abas de Navegação ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 border-b border-white/10">
        {([
          { key: 'geral',      label: '⚙️ Geral',      },
          { key: 'planos',     label: '👑 Planos VIP',  },
          { key: 'fidelidade', label: '🏅 Fidelidade',  },
          { key: 'seguranca',  label: '🔐 Segurança',   },
        ] as const).map(tab => (
          <button key={tab.key} type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all flex-shrink-0 ${activeTab === tab.key ? 'gradiente-ouro text-black shadow-lg' : isDark ? 'bg-white/5 text-zinc-400 hover:bg-white/10' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
          >{tab.label}</button>
        ))}
      </div>

      {/* ══ ABA GERAL ══ */}
      {activeTab === 'geral' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* ══ Coluna Principal ══ */}
        <div className="lg:col-span-2 space-y-10">

          {/* 1. Perfil Master */}
          <div className={card}>
            <h3 className={h3}><UserIcon size={22} className="text-[#C58A4A]" /> Perfil Master</h3>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="relative group w-36 h-36 shrink-0">
                <img src={userData.avatar} className="w-full h-full rounded-[2.5rem] object-cover border-4 border-[#C58A4A]/30 shadow-2xl" alt="Avatar" />
                <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center rounded-[2.5rem] cursor-pointer text-[10px] font-black uppercase tracking-widest gap-2 text-white">
                  <Upload size={22} /> {loading ? '...' : 'Trocar'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange('logo', e)} disabled={loading} />
                </label>
              </div>
              <div className="flex-1 w-full space-y-4">
                <div className="space-y-2">
                  <label className={lbl}>Assinatura Digital (Seu Nome)</label>
                  <input type="text" value={userData.name} onChange={e => setUserData({ ...userData, name: e.target.value })} className={inp} placeholder="Sr. José" />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Identidade */}
          <div className={card}>
            <h3 className={h3}><Store size={22} className="text-[#C58A4A]" /> Identidade do Barber Pub</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={lbl}>Nome da Casa</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inp} />
              </div>
              <div className="space-y-2">
                <label className={lbl}>Slogan / Resumo Header</label>
                <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className={inp} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={lbl}>Título da Seção "Quem Somos"</label>
                <input type="text" value={formData.aboutTitle} onChange={e => setFormData({ ...formData, aboutTitle: e.target.value })} className={inp} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={lbl}>Texto "Quem Somos"</label>
                <textarea rows={5} value={formData.aboutText} onChange={e => setFormData({ ...formData, aboutText: e.target.value })}
                  className={`w-full border-2 p-5 rounded-2xl font-medium resize-none outline-none transition-all ${isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-[#C58A4A]' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]'}`} />
              </div>
            </div>
          </div>

          {/* 3. Contato & Localização */}
          <div className={card}>
            <h3 className={h3}><MapPin size={22} className="text-[#C58A4A]" /> Contato & Localização</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={lbl}>WhatsApp Business</label>
                <div className="relative">
                  <Phone size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                  <input type="text" value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                    className={`${inp} pl-10`} placeholder="21999999999" />
                </div>
              </div>
              <div className="space-y-2">
                <label className={lbl}>Instagram</label>
                <div className="relative">
                  <Instagram size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                  <input type="text" value={formData.instagram} onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                    className={`${inp} pl-10`} placeholder="@srjosebarberpub" />
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={lbl}>Endereço Completo</label>
                <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className={inp} placeholder="Rua, número, bairro, cidade" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={lbl}>Link Google Maps (URL)</label>
                <div className="relative">
                  <Link size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                  <input type="text" value={formData.locationUrl || ''} onChange={e => setFormData({ ...formData, locationUrl: e.target.value })}
                    className={`${inp} pl-10`} placeholder="https://maps.google.com/..." />
                </div>
              </div>
              <div className="space-y-2">
                <label className={lbl}>Horário de Abertura</label>
                <div className="relative">
                  <Clock size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                  <input type="time" value={formData.openingTime || '08:00'} onChange={e => setFormData({ ...formData, openingTime: e.target.value })}
                    className={`${inp} pl-10`} />
                </div>
              </div>
              <div className="space-y-2">
                <label className={lbl}>Horário de Fechamento</label>
                <div className="relative">
                  <Clock size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                  <input type="time" value={formData.closingTime || '20:00'} onChange={e => setFormData({ ...formData, closingTime: e.target.value })}
                    className={`${inp} pl-10`} />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Imagens da Página Pública */}
          <div className={card}>
            <h3 className={h3}><ImageIcon size={22} className="text-[#C58A4A]" /> Imagens da Página Pública</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImgCard label="Foto Capa (Header)" field="coverImage" src={formData.coverImage} />
              <ImgCard label="Fundo da Tela de Login" field="loginBackground" src={formData.loginBackground} />
              <ImgCard label="Foto Seção 'Quem Somos'" field="aboutImage" src={formData.aboutImage} />
              <ImgCard label="Foto / Mapa Localização" field="locationImage" src={formData.locationImage} />
            </div>
          </div>

          {/* 5. Galeria "Nosso Ambiente" */}
          <div className={card}>
            <div className="flex items-center justify-between">
              <h3 className={h3}><Image size={22} className="text-[#C58A4A]" /> Galeria — Nosso Ambiente</h3>
              <label className={`flex items-center gap-2 gradiente-ouro text-black px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer shadow-lg hover:scale-105 transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                <Plus size={14} /> {loading ? 'Enviando...' : 'Adicionar Foto'}
                <input type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={loading} />
              </label>
            </div>
            {(!formData.gallery || formData.gallery.length === 0) && (
              <div className={`rounded-2xl p-10 text-center border-2 border-dashed ${isDark ? 'border-white/10 text-zinc-600' : 'border-zinc-300 text-zinc-400'}`}>
                <Image size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma foto ainda. Adicione imagens do ambiente.</p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(formData.gallery || []).map((img, i) => (
                <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden">
                  <img src={img} className="w-full h-full object-cover" alt={`Galeria ${i + 1}`} />
                  <button
                    type="button"
                    onClick={() => removeGalleryImage(i)}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-700 shadow-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className={`absolute bottom-2 left-2 px-2 py-1 rounded-lg text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'bg-black/70 text-zinc-300' : 'bg-white/80 text-zinc-600'}`}>
                    Foto {i + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5b. Galeria de Fotos de Cortes */}
          <div className={card}>
            <h3 className={h3}><Camera size={22} className="text-[#C58A4A]" /> Galeria de Fotos de Cortes</h3>
            <p className={`text-[10px] mt-1 mb-5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Exibida na página pública. Clientes clicam e abrem em tela cheia com descrição.</p>
            <input
              type="text"
              placeholder="Descrição do corte (ex: Degradê com barba delineada)"
              value={cutGalleryDesc}
              onChange={e => setCutGalleryDesc(e.target.value)}
              className={`w-full border p-4 rounded-xl text-sm font-bold outline-none mb-3 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600' : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'}`}
            />
            <label className={`flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all font-black text-[10px] uppercase tracking-widest mb-6 ${cutGalleryLoading ? 'opacity-50 pointer-events-none border-zinc-600 text-zinc-500' : 'border-[#C58A4A]/40 text-[#C58A4A] hover:border-[#C58A4A] hover:bg-[#C58A4A]/5'}`}>
              <Camera size={14}/> {cutGalleryLoading ? 'Enviando...' : 'Adicionar Foto de Corte'}
              <input type="file" accept="image/*" className="hidden" disabled={cutGalleryLoading} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCutGalleryLoading(true);
                try {
                  const data = new FormData();
                  data.append('image', file);
                  const res = await fetch('https://api.imgbb.com/1/upload?key=da736db48f154b9108b23a36d4393848', { method: 'POST', body: data });
                  const json = await res.json();
                  if (!json.success) throw new Error('Falha');
                  const url = json.data.url;
                  const current: {url:string;desc:string}[] = (formData as any).cutGallery || [];
                  const updated = [...current, { url, desc: cutGalleryDesc.trim() }];
                  setFormData(prev => ({ ...prev, cutGallery: updated } as any));
                  await updateConfig({ cutGallery: updated } as any);
                  setCutGalleryDesc('');
                  alert('✅ Foto adicionada com sucesso!');
                } catch { alert('Erro ao enviar foto.'); }
                setCutGalleryLoading(false);
                e.target.value = '';
              }} />
            </label>
            {!((formData as any).cutGallery) || ((formData as any).cutGallery || []).length === 0 ? (
              <div className={`rounded-2xl p-8 text-center border-2 border-dashed ${isDark ? 'border-white/10 text-zinc-600' : 'border-zinc-300 text-zinc-400'}`}>
                <p className="text-3xl mb-2">📸</p>
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma foto ainda</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {((formData as any).cutGallery || []).map((photo: {url:string;desc:string}, i: number) => (
                  <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden">
                    <img src={photo.url} className="w-full h-full object-cover" alt={photo.desc || `Corte ${i+1}`} />
                    <button type="button" onClick={async () => {
                      if (!window.confirm('Excluir esta foto?')) return;
                      const current: {url:string;desc:string}[] = (formData as any).cutGallery || [];
                      const updated = current.filter((_,idx) => idx !== i);
                      setFormData(prev => ({ ...prev, cutGallery: updated } as any));
                      await updateConfig({ cutGallery: updated } as any);
                    }} className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                      <Trash2 size={14}/>
                    </button>
                    {photo.desc && (
                      <div className={`absolute bottom-0 inset-x-0 p-2 opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'bg-black/70' : 'bg-white/80'}`}>
                        <p className={`text-[9px] font-bold line-clamp-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{photo.desc}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. Programa de Fidelidade */}
          <div className={card}>
            <h3 className={h3}><Star size={22} className="text-[#C58A4A]" /> Programa de Fidelidade</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={lbl}>Selos para Corte Grátis</label>
                <input type="number" min={1} max={50}
                  value={(formData as any).stampsForFreeCut ?? 10}
                  onChange={e => setFormData({ ...formData, stampsForFreeCut: parseInt(e.target.value) || 10 } as any)}
                  className={inp} />
                <p className={`text-[10px] font-bold ml-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Ex: 10 selos = 1 corte cortesia</p>
              </div>
              <div className="space-y-2">
                <label className={lbl}>Cashback % por Serviço</label>
                <input type="number" min={0} max={20} step={0.5}
                  value={(formData as any).cashbackPercent ?? 5}
                  onChange={e => setFormData({ ...formData, cashbackPercent: parseFloat(e.target.value) || 0 } as any)}
                  className={inp}
                />
              </div>
            </div>

            {/* ── Indique e Ganhe ── */}
            <div className={`rounded-[2rem] border p-6 space-y-4 ${isDark ? 'border-[#C58A4A]/20 bg-[#C58A4A]/5' : 'border-amber-200 bg-amber-50'}`}>
              <h4 className={`font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                🎁 Indique e Ganhe
              </h4>
              <p className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Ambos ganham: o indicador recebe crédito quando o indicado concluir o primeiro corte. O indicado também recebe crédito de boas-vindas.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={lbl}>Recompensa do Indicador (R$)</label>
                  <input type="number" min={0} step={1}
                    value={(formData as any).referralRewardAmount ?? 5}
                    onChange={e => setFormData({ ...formData, referralRewardAmount: parseFloat(e.target.value) || 5 } as any)}
                    className={inp}
                    placeholder="Ex: 5"
                  />
                  <p className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Crédito adicionado à carteira de quem indicou</p>
                </div>
                <div className="space-y-2">
                  <label className={lbl}>Recompensa do Indicado (R$)</label>
                  <input type="number" min={0} step={1}
                    value={(formData as any).referralReferredRewardAmount ?? (formData as any).referralRewardAmount ?? 5}
                    onChange={e => setFormData({ ...formData, referralReferredRewardAmount: parseFloat(e.target.value) || 0 } as any)}
                    className={inp}
                    placeholder="Ex: 5"
                  />
                  <p className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Crédito de boas-vindas para quem foi indicado</p>
                </div>
                <div className="space-y-2">
                  <label className={lbl}>Indicações para Corte Grátis</label>
                  <input type="number" min={1} step={1}
                    value={(formData as any).referralFreeCutThreshold ?? 3}
                    onChange={e => setFormData({ ...formData, referralFreeCutThreshold: parseInt(e.target.value) || 3 } as any)}
                    className={inp}
                    placeholder="Ex: 3"
                  />
                  <p className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>A cada X indicações validadas, ganha 1 corte grátis</p>
                </div>
              </div>
              <div className={`p-3 rounded-xl text-[10px] ${isDark ? 'bg-black/30 text-zinc-300' : 'bg-white text-zinc-600'}`}>
                💡 Indicador ganha R$ {(formData as any).referralRewardAmount ?? 5} · Indicado ganha R$ {(formData as any).referralReferredRewardAmount ?? (formData as any).referralRewardAmount ?? 5} · {(formData as any).referralFreeCutThreshold ?? 3} indicações = 1 corte grátis
              </div>
            </div>

            {/* ── Integração Asaas ────────────────────────────────── */}
            <div className={`rounded-[2rem] border p-8 space-y-6 ${isDark ? 'border-white/5 bg-white/2' : 'border-zinc-200 bg-white'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-[#00a650] flex items-center justify-center">
                  <span className="text-white font-black text-sm">A$</span>
                </div>
                <div>
                  <h3 className={`text-lg font-black font-display italic ${isDark ? 'text-white' : 'text-zinc-900'}`}>Integração Asaas</h3>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Pagamentos PIX · Cartão · Link de cobrança</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Chave de API</label>
                  <input
                    type="password"
                    placeholder="$aas_... (cole sua chave de API)"
                    value={(formData as any).asaasKey || ''}
                    onChange={e => setFormData({ ...formData, asaasKey: e.target.value } as any)}
                    className={`w-full border p-4 rounded-2xl outline-none font-mono text-sm transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#00a650]' : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#00a650]'}`}
                  />
                  <p className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Encontre em: Asaas → Minha Conta → Integrações → Chave de API</p>
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Ambiente</label>
                  <select
                    value={(formData as any).asaasEnv || 'sandbox'}
                    onChange={e => setFormData({ ...formData, asaasEnv: e.target.value } as any)}
                    className={`w-full border p-4 rounded-2xl outline-none font-bold transition-all ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-900'}`}
                    style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  >
                    <option value="sandbox">Sandbox (testes)</option>
                    <option value="producao">Produção (dinheiro real)</option>
                  </select>
                </div>
                <div className={`flex items-center gap-3 p-4 rounded-2xl ${isDark ? 'bg-[#00a650]/10 border border-[#00a650]/20' : 'bg-green-50 border border-green-200'}`}>
                  <span className="text-green-500 text-xl">💳</span>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-green-400' : 'text-green-600'}`}>Com Asaas configurado você pode:</p>
                    <p className={`text-[9px] mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Gerar PIX na hora · Enviar link por WhatsApp · Controle de pagamentos</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* 7. Planos VIP */}
          <div className={card}>
            <div className="flex items-center justify-between">
              <h3 className={h3}><Crown size={22} className="text-[#C58A4A]" /> Planos VIP</h3>
              <button type="button"
                onClick={() => { setEditingPlan(null); setNewPlan({ name: '', price: 0, period: 'MENSAL', benefits: [''], status: 'ATIVO', customDays: 30, featured: false }); setShowVipPlanModal(true); }}
                className="flex items-center gap-2 gradiente-ouro text-black px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all">
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {(!formData.vipPlans || formData.vipPlans.length === 0) && (
              <p className={`text-center py-8 italic text-sm ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Nenhum plano VIP cadastrado.</p>
            )}
            <div className="space-y-4">
              {formData.vipPlans?.map(plan => (
                <div key={plan.id} className={`rounded-2xl p-6 border transition-all ${isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{plan.name}</h4>
                          {(plan as any).featured && <span className="text-[9px] font-black text-[#C58A4A] bg-[#C58A4A]/10 border border-[#C58A4A]/30 px-2 py-0.5 rounded-full">⭐ DESTAQUE</span>}
                          {(plan as any).maxCuts && <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">✂️ {(plan as any).maxCuts} cortes • {(plan as any).vipCommissionPct || 0}% comissão</span>}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${plan.status === 'ATIVO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{plan.status}</span>
                      </div>
                      <p className={`text-2xl font-black mb-2 ${isDark ? 'text-[#C58A4A]' : 'text-blue-600'}`}>
                        R$ {plan.price.toFixed(2)} <span className="text-sm font-bold">/{plan.period === 'MENSAL' ? 'mês' : plan.period === 'ANUAL' ? 'ano' : plan.period === 'SEMANAL' ? 'semana' : `${plan.customDays || '?'}d`}</span>
                      </p>
                      <div className="space-y-1">
                        {plan.benefits.slice(0, 3).map((b, i) => (
                          <p key={i} className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>• {b}</p>
                        ))}
                        {plan.benefits.length > 3 && <p className="text-xs text-zinc-500 italic">+{plan.benefits.length - 3} benefícios</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => handleEditPlan(plan)} className={`p-2 rounded-xl border transition-all ${isDark ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-white' : 'bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50'}`}><Edit3 size={15} /></button>
                      <button type="button" onClick={() => handleTogglePlan(plan.id)} className={`p-2 rounded-xl border transition-all ${plan.status === 'ATIVO' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-red-500/10 border-red-500 text-red-400'}`}><Crown size={15} /></button>
                      <button type="button" onClick={() => handleDeletePlan(plan.id)} className="p-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 8. Gestão de Barbeiros */}
          <div className={card}>
            <div className="flex items-center justify-between">
              <h3 className={h3}><UserIcon size={22} className="text-[#C58A4A]" /> Gestão de Barbeiros</h3>
              <button type="button"
                onClick={async () => {
                  if (confirm('Reiniciar todos os contadores de curtidas?')) {
                    await resetAllLikes();
                    alert('Contadores reiniciados!');
                  }
                }}
                className="p-3 border-2 rounded-xl transition-all hover:scale-105"
                style={{ backgroundColor: '#66360f20', borderColor: '#66360f', color: '#66360f' }}>
                <RotateCcw size={20} />
              </button>
            </div>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Reinicie os contadores de curtidas de todos os profissionais.</p>
          </div>

        </div>

        {/* ══ Aside ══ */}
        <aside className="space-y-8">

          {/* Logo */}
          <div className={`rounded-[3rem] p-8 border-2 text-center flex flex-col items-center ${isDark ? 'cartao-vidro border-white/10' : 'bg-white border-zinc-200 shadow-sm'}`}>
            <h3 className={`text-lg font-black font-display italic mb-6 ${isDark ? 'text-white' : 'text-zinc-900'}`}>Logo Principal</h3>
            <div className="relative group w-44 h-44">
              <img src={formData.logo || userData.avatar} className="w-full h-full rounded-[2.5rem] object-cover border-4 border-[#C58A4A]/40 shadow-2xl" alt="Logo" />
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center rounded-[2.5rem] cursor-pointer flex-col gap-2 text-white text-[10px] font-black uppercase tracking-widest">
                <Upload size={28} /> Trocar
                <input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange('logo', e)} />
              </label>
            </div>
            <p className={`text-[9px] font-bold uppercase tracking-widest mt-4 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Aparece no header e login</p>
          </div>

          {/* Preview rápido */}
          <div className={`rounded-[3rem] p-8 border-2 space-y-4 ${isDark ? 'cartao-vidro border-white/10' : 'bg-white border-zinc-200 shadow-sm'}`}>
            <h3 className={`text-lg font-black font-display italic ${isDark ? 'text-white' : 'text-zinc-900'}`}>Preview Rápido</h3>
            <div className="space-y-3 text-sm">
              <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-zinc-50'}`}>
                <Phone size={14} className="text-[#C58A4A] shrink-0" />
                <span className={`text-xs font-bold truncate ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{formData.whatsapp || 'WhatsApp não definido'}</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-zinc-50'}`}>
                <Instagram size={14} className="text-[#C58A4A] shrink-0" />
                <span className={`text-xs font-bold truncate ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{formData.instagram || 'Instagram não definido'}</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-zinc-50'}`}>
                <MapPin size={14} className="text-[#C58A4A] shrink-0" />
                <span className={`text-xs font-bold truncate ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{formData.address || 'Endereço não definido'}</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-zinc-50'}`}>
                <Clock size={14} className="text-[#C58A4A] shrink-0" />
                <span className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{formData.openingTime || '08:00'} – {formData.closingTime || '20:00'}</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-zinc-50'}`}>
                <Image size={14} className="text-[#C58A4A] shrink-0" />
                <span className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{(formData.gallery || []).length} foto(s) na galeria</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-zinc-50'}`}>
                <Crown size={14} className="text-[#C58A4A] shrink-0" />
                <span className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{(formData.vipPlans || []).filter(p => p.status === 'ATIVO').length} plano(s) VIP ativo(s)</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-zinc-50'}`}>
                <Star size={14} className="text-[#C58A4A] shrink-0" />
                <span className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{(formData as any).stampsForFreeCut ?? 10} selos · {(formData as any).cashbackPercent ?? 5}% cashback</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full gradiente-ouro text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-all mt-2"
            >
              {loading ? '⏳ Salvando...' : '💾 Salvar Agora'}
            </button>
          </div>




        </aside>
      </div>

      )} {/* fim aba geral */}

      {/* ══ ABA PLANOS VIP ══ */}
      {activeTab === 'planos' && (
        <div className="space-y-6">
          <div className={card}>
            <h3 className={h3}>👑 Planos VIP</h3>
            <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Gerencie os planos de assinatura da barbearia.</p>
            <div className="space-y-4 mt-6">
              {(formData.vipPlans || []).map((plan: any) => (
                <div key={plan.id} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-white/3 border-white/5' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${plan.featured ? 'gradiente-ouro' : isDark ? 'bg-white/10' : 'bg-zinc-200'}`}>
                      <Crown size={14} className={plan.featured ? 'text-black' : 'text-[#C58A4A]'}/>
                    </div>
                    <div className="min-w-0">
                      <p className={`font-black text-sm truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{plan.name}</p>
                      <p className={`text-[9px] font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>R$ {plan.price?.toFixed(2)} / {plan.period === 'MENSAL' ? 'mês' : plan.period} {plan.maxCuts ? `· ${plan.maxCuts} cortes` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[8px] font-black px-2 py-1 rounded-full ${plan.status === 'ATIVO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{plan.status}</span>
                    <button type="button" onClick={() => handleEditPlan(plan)} className="p-2 rounded-xl bg-[#C58A4A]/10 text-[#C58A4A] hover:bg-[#C58A4A]/20 transition-all"><Edit3 size={13}/></button>
                    <button type="button" onClick={() => handleDeletePlan(plan.id)} className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"><Trash2 size={13}/></button>
                  </div>
                </div>
              ))}
              {(formData.vipPlans || []).length === 0 && (
                <div className={`text-center py-10 rounded-2xl border-2 border-dashed ${isDark ? 'border-white/10 text-zinc-600' : 'border-zinc-200 text-zinc-400'}`}>
                  <p className="font-black text-[10px] uppercase tracking-widest">Nenhum plano criado</p>
                </div>
              )}
              <button type="button" onClick={() => { setEditingPlan(null); setNewPlan({ name: '', price: 0, period: 'MENSAL', benefits: [''], status: 'ATIVO', maxCuts: 4, vipCommissionPct: 50, members: [] }); setShowVipPlanModal(true); }}
                className="w-full py-4 rounded-2xl gradiente-ouro text-black font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2">
                <Plus size={14}/> Novo Plano VIP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ABA FIDELIDADE ══ */}
      {activeTab === 'fidelidade' && (
        <div className="space-y-6">
          {/* Configurações de fidelidade */}
          <div className={card}>
            <h3 className={h3}>🏅 Programa de Fidelidade</h3>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label className={lbl}>Selos para Corte Grátis</label>
                <input type="number" min="1" max="50" value={(formData as any).stampsForFreeCut || 10}
                  onChange={e => setFormData({...formData, stampsForFreeCut: parseInt(e.target.value)||10} as any)}
                  className={inp}/>
              </div>
              <div className="space-y-2">
                <label className={lbl}>% Cashback por Visita</label>
                <input type="number" min="0" max="50" value={(formData as any).cashbackPercent || 5}
                  onChange={e => setFormData({...formData, cashbackPercent: parseInt(e.target.value)||0} as any)}
                  className={inp}/>
              </div>
            </div>
            <button type="button" onClick={handleSave} disabled={loading}
              className="w-full mt-4 gradiente-ouro text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all">
              {loading ? '⏳ Salvando...' : '💾 Salvar Configurações'}
            </button>
          </div>

          {/* Gestão de cartões */}
          <div className={card}>
            <h3 className={h3}>🃏 Cartões dos Clientes</h3>
            <div className="mt-4 space-y-4">
              <input type="text" placeholder="🔍 Buscar cliente..." value={loyaltySearch}
                onChange={e => setLoyaltySearch(e.target.value)}
                className={inp}/>
              {/* Carregar cartões */}
              <button type="button" disabled={loyaltyLoading}
                onClick={async () => {
                  setLoyaltyLoading(true);
                  try {
                    const { getFirestore, collection: col, getDocs } = await import('firebase/firestore');
                    const { getApp } = await import('firebase/app');
                    const db = getFirestore(getApp());
                    const snap = await getDocs(col(db, 'loyaltyCards'));
                    setLoyaltyCards(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                  } catch {}
                  setLoyaltyLoading(false);
                }}
                className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase border transition-all ${isDark ? 'bg-white/5 border-white/10 text-zinc-400 hover:border-[#C58A4A]' : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-[#C58A4A]'}`}>
                {loyaltyLoading ? '⏳ Carregando...' : '🔄 Carregar Cartões'}
              </button>

              {loyaltyCards.filter(c => !loyaltySearch || c.clientName?.toLowerCase().includes(loyaltySearch.toLowerCase()) || c.clientPhone?.includes(loyaltySearch)).map(card => (
                <div key={card.id} className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'bg-white/3 border-white/5' : 'bg-zinc-50 border-zinc-100'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>{card.clientName}</p>
                      <p className={`text-[9px] font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{card.clientPhone}</p>
                    </div>
                    <button type="button" onClick={() => { setEditingCard(card); setEditStamps(String(card.stamps||0)); setEditCredits(String(card.credits||0)); setEditFreeCuts(String(card.freeCutsPending||0)); setLoyaltySaveMsg(null); }}
                      className="p-2 rounded-xl bg-[#C58A4A]/10 text-[#C58A4A] hover:bg-[#C58A4A]/20 transition-all"><Edit3 size={13}/></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5' : 'bg-white border border-zinc-100'}`}>
                      <p className="text-[#C58A4A] font-black text-lg">{card.stamps||0}</p>
                      <p className={`text-[8px] font-black uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Selos</p>
                    </div>
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5' : 'bg-white border border-zinc-100'}`}>
                      <p className="text-emerald-400 font-black text-lg">R${(card.credits||0).toFixed(0)}</p>
                      <p className={`text-[8px] font-black uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Créditos</p>
                    </div>
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5' : 'bg-white border border-zinc-100'}`}>
                      <p className="text-amber-400 font-black text-lg">{card.freeCutsPending||0}</p>
                      <p className={`text-[8px] font-black uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Grátis</p>
                    </div>
                  </div>
                  <p className={`text-[8px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Total histórico: {card.totalStamps||0} cortes</p>

                  {/* Editor inline */}
                  {editingCard?.id === card.id && (
                    <div className="space-y-3 pt-3 border-t border-white/10 animate-in slide-in-from-top-2">
                      {loyaltySaveMsg && <p className={`text-[9px] font-black uppercase ${loyaltySaveMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{loyaltySaveMsg.txt}</p>}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className={`text-[8px] font-black uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Selos</label>
                          <input type="number" min="0" value={editStamps} onChange={e => setEditStamps(e.target.value)}
                            className={`w-full border p-2 rounded-xl text-sm font-bold text-center outline-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}/>
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[8px] font-black uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Créditos R$</label>
                          <input type="number" min="0" step="0.01" value={editCredits} onChange={e => setEditCredits(e.target.value)}
                            className={`w-full border p-2 rounded-xl text-sm font-bold text-center outline-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}/>
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[8px] font-black uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Grátis</label>
                          <input type="number" min="0" value={editFreeCuts} onChange={e => setEditFreeCuts(e.target.value)}
                            className={`w-full border p-2 rounded-xl text-sm font-bold text-center outline-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}/>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditingCard(null)}
                          className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase border ${isDark ? 'bg-white/5 border-white/10 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-500'}`}>
                          Cancelar
                        </button>
                        <button type="button"
                          onClick={async () => {
                            try {
                              const { getFirestore, doc: docFn, updateDoc } = await import('firebase/firestore');
                              const { getApp } = await import('firebase/app');
                              const db = getFirestore(getApp());
                              await updateDoc(docFn(db, 'loyaltyCards', card.id), {
                                stamps: parseInt(editStamps)||0,
                                credits: parseFloat(editCredits)||0,
                                freeCutsPending: parseInt(editFreeCuts)||0,
                                updatedAt: new Date().toISOString(),
                              });
                              setLoyaltyCards(prev => prev.map(c => c.id === card.id ? { ...c, stamps: parseInt(editStamps)||0, credits: parseFloat(editCredits)||0, freeCutsPending: parseInt(editFreeCuts)||0 } : c));
                              setLoyaltySaveMsg({ ok: true, txt: '✅ Salvo!' });
                              setTimeout(() => { setEditingCard(null); setLoyaltySaveMsg(null); }, 1500);
                            } catch { setLoyaltySaveMsg({ ok: false, txt: 'Erro ao salvar.' }); }
                          }}
                          className="flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase gradiente-ouro text-black hover:scale-105 transition-all">
                          💾 Salvar
                        </button>
                        <button type="button"
                          onClick={async () => {
                            if (!confirm(`Resetar cartão de ${card.clientName}?`)) return;
                            try {
                              const { getFirestore, doc: docFn, updateDoc } = await import('firebase/firestore');
                              const { getApp } = await import('firebase/app');
                              const db = getFirestore(getApp());
                              await updateDoc(docFn(db, 'loyaltyCards', card.id), { stamps: 0, credits: 0, freeCutsPending: 0, updatedAt: new Date().toISOString() });
                              setLoyaltyCards(prev => prev.map(c => c.id === card.id ? { ...c, stamps: 0, credits: 0, freeCutsPending: 0 } : c));
                              setEditingCard(null);
                            } catch {}
                          }}
                          className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loyaltyCards.length === 0 && !loyaltyLoading && (
                <p className={`text-center py-8 text-[10px] font-black uppercase ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Clique em "Carregar Cartões" para visualizar</p>
              )}
            </div>
          </div>

          {/* Reprocessar */}
          <div className={card}>
            <h3 className={h3}>🔧 Manutenção de Selos</h3>
            <p className={`text-[10px] mt-1 mb-5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Reprocessa todos os cartões com base nos agendamentos finalizados. Use uma vez para corrigir histórico.</p>
            {reprocessMsg && <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${reprocessMsg.ok ? 'text-emerald-500' : 'text-red-400'}`}>{reprocessMsg.txt}</p>}
            <button type="button" disabled={reprocessing}
              onClick={async () => {
                if (!confirm('Confirma o reprocessamento de selos?')) return;
                setReprocessing(true); setReprocessMsg(null);
                try {
                  const { getFirestore, collection: col, getDocs, doc: docFn, updateDoc, addDoc } = await import('firebase/firestore');
                  const { getApp } = await import('firebase/app');
                  const db = getFirestore(getApp());
                  const apptSnap = await getDocs(col(db, 'appointments'));
                  const finalized = apptSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(a => a.status === 'CONCLUIDO_PAGO' && a.clientId);
                  const byClient: Record<string, any[]> = {};
                  for (const a of finalized) { if (!byClient[a.clientId]) byClient[a.clientId] = []; byClient[a.clientId].push(a); }
                  const stampsLimit = (config as any).stampsForFreeCut ?? 10;
                  const cashbackPct = (config as any).cashbackPercent ?? 5;
                  const cardSnap = await getDocs(col(db, 'loyaltyCards'));
                  const existing: Record<string, any> = {};
                  cardSnap.docs.forEach(d => { existing[d.data().clientId] = { id: d.id, ...d.data() }; });
                  let updated = 0, created = 0;
                  for (const [clientId, appts] of Object.entries(byClient)) {
                    const total = appts.length;
                    const stamps = total % stampsLimit;
                    const freeCuts = Math.floor(total / stampsLimit);
                    const credits = parseFloat(((appts.reduce((s: number, a: any) => s + (a.price||0), 0) * cashbackPct) / 100).toFixed(2));
                    const data = { clientId, clientName: appts[0].clientName||'', clientPhone: appts[0].clientPhone||'', stamps, totalStamps: total, credits, freeCutsPending: freeCuts, freeCutsEarned: freeCuts, updatedAt: new Date().toISOString() };
                    if (existing[clientId]) { await updateDoc(docFn(db, 'loyaltyCards', existing[clientId].id), data); updated++; }
                    else { await addDoc(col(db, 'loyaltyCards'), { ...data, createdAt: new Date().toISOString() }); created++; }
                  }
                  setReprocessMsg({ ok: true, txt: `✅ ${created} criados, ${updated} atualizados.` });
                } catch (e: any) { setReprocessMsg({ ok: false, txt: `Erro: ${e.message}` }); }
                setReprocessing(false);
              }}
              className="w-full py-4 rounded-2xl font-black text-[10px] uppercase border transition-all bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50">
              {reprocessing ? '⏳ Processando...' : '🔄 Reprocessar Selos Agora'}
            </button>
          </div>
        </div>
      )}

      {/* ══ ABA SEGURANÇA ══ */}
      {activeTab === 'seguranca' && (
        <div className="max-w-lg space-y-6">
          <div className={card}>
            <h3 className={h3}>🔐 Senha Admin</h3>
            <p className={`text-[10px] mt-1 mb-5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Troque a senha de acesso ao painel administrativo.</p>
            <div className="space-y-3">
              <input type="password" placeholder="Nova senha" value={newAdminPass} onChange={e => { setNewAdminPass(e.target.value); setPassMsg(null); }} className={inp}/>
              <input type="password" placeholder="Confirmar nova senha" value={confirmAdminPass} onChange={e => { setConfirmAdminPass(e.target.value); setPassMsg(null); }} className={inp}/>
              {passMsg && <p className={`text-[10px] font-black uppercase tracking-widest ${passMsg.ok ? 'text-emerald-500' : 'text-red-400'}`}>{passMsg.txt}</p>}
              <button type="button" onClick={async () => {
                if (!newAdminPass || newAdminPass.length < 4) { setPassMsg({ ok: false, txt: 'Senha precisa ter pelo menos 4 caracteres.' }); return; }
                if (newAdminPass !== confirmAdminPass) { setPassMsg({ ok: false, txt: 'As senhas não coincidem.' }); return; }
                try { await updateConfig({ adminPassword: newAdminPass } as any); setPassMsg({ ok: true, txt: '✅ Senha alterada com sucesso!' }); setNewAdminPass(''); setConfirmAdminPass(''); }
                catch { setPassMsg({ ok: false, txt: 'Erro ao salvar. Tente novamente.' }); }
              }} className="w-full gradiente-ouro text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all">
                🔒 Alterar Senha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Plano VIP ── */}
      {showVipPlanModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in zoom-in-95">
          <div className={`w-full max-w-2xl rounded-[3rem] p-10 space-y-8 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide border ${isDark ? 'bg-[#111] border-[#C58A4A]/30' : 'bg-white border-zinc-200'}`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-2xl font-black font-display italic ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {editingPlan ? 'Editar Plano' : 'Novo Plano VIP'}
              </h2>
              <button onClick={() => setShowVipPlanModal(false)} className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white"><X size={22} /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={lbl}>Nome do Plano</label>
                  <input type="text" value={newPlan.name || ''} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })}
                    className={inp} placeholder="Ex: Plano Premium" />
                </div>
                <div className="space-y-2">
                  <label className={lbl}>Período</label>
                  <select
                    value={newPlan.period || 'MENSAL'}
                    onChange={e => setNewPlan({ ...newPlan, period: e.target.value as any })}
                    className={inp}
                    style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  >
                    <option value="SEMANAL" style={{ backgroundColor: isDark ? '#18181b' : '#fff', color: isDark ? '#fff' : '#18181b' }}>Semanal (7 dias)</option>
                    <option value="MENSAL"  style={{ backgroundColor: isDark ? '#18181b' : '#fff', color: isDark ? '#fff' : '#18181b' }}>Mensal (30 dias)</option>
                    <option value="ANUAL"   style={{ backgroundColor: isDark ? '#18181b' : '#fff', color: isDark ? '#fff' : '#18181b' }}>Anual (365 dias)</option>
                    <option value="DIAS"    style={{ backgroundColor: isDark ? '#18181b' : '#fff', color: isDark ? '#fff' : '#18181b' }}>Personalizado (qtd. de dias)</option>
                  </select>
                  {newPlan.period === 'DIAS' && (
                    <div className="mt-3">
                      <label className={lbl}>Quantidade de Dias</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={newPlan.customDays || 30}
                        onChange={e => setNewPlan({ ...newPlan, customDays: parseInt(e.target.value) || 30 })}
                        className={`${inp} mt-2`}
                        placeholder="Ex: 15"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={lbl}>Preço (R$)</label>
                  <input type="number" min="0" step="0.01" value={newPlan.price || 0}
                    onChange={e => setNewPlan({ ...newPlan, price: parseFloat(e.target.value) || 0 })} className={inp} />
                </div>
                <div className="space-y-2">
                  <label className={lbl}>Desconto (%)</label>
                  <input type="number" min="0" max="100" value={newPlan.discount || 0}
                    onChange={e => setNewPlan({ ...newPlan, discount: parseInt(e.target.value) || 0 })} className={inp} />
                </div>
              </div>
              {/* ── Membros do Plano ──────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={lbl}>👥 Membros do Plano</label>
                  <button type="button"
                    onClick={() => setNewPlan({ ...newPlan, members: [...((newPlan as any).members || []), { label: '', cuts: 4 }] } as any)}
                    className="text-[9px] font-black text-[#C58A4A] hover:underline uppercase tracking-widest"
                  >+ Adicionar Membro</button>
                </div>
                {((newPlan as any).members || []).length === 0 ? (
                  <div className={`p-4 rounded-xl border-2 border-dashed text-center ${isDark ? 'border-white/10 text-zinc-600' : 'border-zinc-200 text-zinc-400'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest">Plano individual</p>
                    <p className="text-[9px] mt-1">Clique em "+ Adicionar Membro" para criar plano com múltiplos beneficiários (ex: Pai + Filho)</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {((newPlan as any).members || []).map((member: any, i: number) => (
                      <div key={i} className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? 'bg-white/3 border-white/10' : 'bg-zinc-50 border-zinc-200'}`}>
                        <input
                          type="text" placeholder="Nome (ex: Pai, Filho)"
                          value={member.label}
                          onChange={e => {
                            const mems = [...(newPlan as any).members];
                            mems[i] = { ...mems[i], label: e.target.value };
                            setNewPlan({ ...newPlan, members: mems } as any);
                          }}
                          className={`flex-1 border p-2 rounded-lg text-xs font-bold outline-none ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600' : 'bg-white border-zinc-300 text-zinc-900'}`}
                        />
                        <input
                          type="number" min="1" max="20" value={member.cuts}
                          onChange={e => {
                            const mems = [...(newPlan as any).members];
                            mems[i] = { ...mems[i], cuts: parseInt(e.target.value) || 1 };
                            setNewPlan({ ...newPlan, members: mems } as any);
                          }}
                          className={`w-14 border p-2 rounded-lg text-xs font-bold outline-none text-center ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                        />
                        <span className={`text-[9px] font-bold whitespace-nowrap ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>cortes</span>
                        <button type="button"
                          onClick={() => setNewPlan({ ...newPlan, members: (newPlan as any).members.filter((_: any, idx: number) => idx !== i) } as any)}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-all">✕</button>
                      </div>
                    ))}
                    <p className="text-[10px] font-black text-[#C58A4A] text-right">
                      Total: {((newPlan as any).members || []).reduce((s: number, m: any) => s + (m.cuts || 0), 0)} cortes incluídos no plano
                    </p>
                  </div>
                )}
              </div>

              {/* Cortes por período + Comissão VIP */}
              <div className="grid grid-cols-2 gap-4">
                {((newPlan as any).members || []).length === 0 && (
                  <div className="space-y-2">
                    <label className={lbl}>Cortes por Período</label>
                    <input type="number" min="1" max="100" value={newPlan.maxCuts || 4}
                      onChange={e => setNewPlan({ ...newPlan, maxCuts: parseInt(e.target.value) || 4 })} className={inp}
                      placeholder="Ex: 4" />
                    <p className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Máximo de cortes incluídos</p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className={lbl}>Comissão Barbeiro (%)</label>
                  <input type="number" min="0" max="100" value={newPlan.vipCommissionPct || 50}
                    onChange={e => setNewPlan({ ...newPlan, vipCommissionPct: parseInt(e.target.value) || 0 })} className={inp}
                    placeholder="Ex: 50" />
                  <p className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>% sobre valor por corte</p>
                </div>
              </div>
              {/* Preview do cálculo */}
              {(newPlan.price || 0) > 0 && (newPlan.maxCuts || 0) > 0 && (
                <div className={`p-4 rounded-2xl border text-[11px] space-y-1 ${isDark ? 'bg-[#C58A4A]/5 border-[#C58A4A]/20' : 'bg-amber-50 border-amber-200'}`}>
                  <p className="font-black text-[#C58A4A]">💡 Preview do cálculo</p>
                  <p className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                    Valor por corte: <strong>R$ {((newPlan.price || 0) / (newPlan.maxCuts || 1)).toFixed(2)}</strong>
                  </p>
                  <p className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                    Comissão por corte ({newPlan.vipCommissionPct || 0}%): <strong>R$ {(((newPlan.price || 0) / (newPlan.maxCuts || 1)) * ((newPlan.vipCommissionPct || 0) / 100)).toFixed(2)}</strong>
                  </p>
                  <p className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                    Total comissão por plano: <strong>R$ {(((newPlan.price || 0) / (newPlan.maxCuts || 1)) * ((newPlan.vipCommissionPct || 0) / 100) * (newPlan.maxCuts || 1)).toFixed(2)}</strong>
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setNewPlan({ ...newPlan, featured: !newPlan.featured })}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${newPlan.featured ? 'border-[#C58A4A] bg-[#C58A4A]/10' : isDark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-50'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">⭐</span>
                  <div className="text-left">
                    <p className={`font-black text-[11px] uppercase tracking-widest ${newPlan.featured ? 'text-[#C58A4A]' : isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Plano em Destaque</p>
                    <p className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Aparece com borda dourada no portal do cliente</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-all relative ${newPlan.featured ? 'bg-[#C58A4A]' : isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${newPlan.featured ? 'left-5' : 'left-1'}`} />
                </div>
              </button>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={lbl}>Benefícios</label>
                  <button type="button" onClick={addBenefit} className="text-[#C58A4A] text-xs font-black flex items-center gap-1 hover:opacity-80">
                    <Plus size={13} /> Adicionar
                  </button>
                </div>
                <div className="space-y-3">
                  {(newPlan.benefits || ['']).map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" value={b} onChange={e => updateBenefit(i, e.target.value)}
                        className={`flex-1 border-2 p-3 rounded-xl outline-none text-sm ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'}`}
                        placeholder={`Benefício ${i + 1}`} />
                      {(newPlan.benefits || []).length > 1 && (
                        <button type="button" onClick={() => removeBenefit(i)} className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"><Trash2 size={15} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setShowVipPlanModal(false)}
                className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase ${isDark ? 'bg-white/5 text-zinc-500' : 'bg-zinc-100 text-zinc-600'}`}>
                Cancelar
              </button>
              <button type="button" onClick={handleSaveVipPlan}
                className="flex-1 gradiente-ouro text-black py-4 rounded-2xl text-xs font-black uppercase shadow-xl">
                {editingPlan ? 'Atualizar' : 'Salvar'} Plano
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
