import React, { useState, useRef } from 'react';
import { Package, Plus, Trash2, Edit2, X, ImagePlus, Tag, DollarSign, AlignLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import { useBarberStore } from '../store';

const IMGBB_API_KEY = 'da736db48f154b9108b23a36d4393848';

const uploadToImgBB = async (file: File): Promise<string> => {
  const compressed = await new Promise<Blob>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1400;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = img.width  * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.88);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
  const fd = new FormData();
  fd.append('image', compressed, 'product.jpg');
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
  const data = await res.json();
  if (!data.success) throw new Error('Falha no upload');
  return data.data.url as string;
};

const CATEGORIES = ['Pomada', 'Shampoo', 'Condicionador', 'Óleo', 'Cera', 'Gel', 'Loção', 'Perfume', 'Acessório', 'Outro'];

const Products: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, theme } = useBarberStore() as any;
  const isDark = theme !== 'light';

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  const empty = { name: '', description: '', price: '', category: 'Pomada', image: '', active: true };
  const [form, setForm] = useState(empty);

  const cardClass = isDark ? 'cartao-vidro border-white/5' : 'bg-white border border-zinc-200 shadow-sm';
  const inputClass = `w-full border p-4 rounded-xl outline-none font-bold transition-all text-sm ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600' : 'bg-zinc-50 border-zinc-300 text-zinc-900'}`;

  const openNew = () => { setEditingId(null); setForm(empty); setShowModal(true); };
  const openEdit = (p: any) => { setEditingId(p.id); setForm({ name: p.name, description: p.description || '', price: String(p.price), category: p.category || 'Pomada', image: p.image || '', active: p.active !== false }); setShowModal(true); };

  const handleImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToImgBB(file);
      setForm(f => ({ ...f, image: url }));
    } catch { alert('Erro ao enviar imagem.'); }
    finally { setUploading(false); if (imgRef.current) imgRef.current.value = ''; }
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { alert('Preencha nome e preço.'); return; }
    setSaving(true);
    try {
      const data = { ...form, price: parseFloat(form.price) || 0 };
      if (editingId) await updateProduct(editingId, data);
      else           await addProduct(data);
      setShowModal(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full overflow-auto pb-20 scrollbar-hide">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className={`text-3xl font-black font-display italic tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Produtos
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            Vitrine de produtos — aparecem na página pública.
          </p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 gradiente-ouro text-black px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
          <Plus size={16}/> NOVO PRODUTO
        </button>
      </div>

      {/* Grid */}
      {(!products || products.length === 0) ? (
        <div className={`${cardClass} rounded-[2.5rem] p-16 text-center`}>
          <Package size={48} className="mx-auto mb-4 text-zinc-700"/>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            Nenhum produto cadastrado ainda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.map((p: any) => (
            <div key={p.id} className={`${cardClass} rounded-[2.5rem] overflow-hidden group relative transition-all hover:border-[#C58A4A]/30`}>
              {/* Badge ativo/inativo */}
              <div className={`absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border backdrop-blur-sm ${p.active !== false ? 'text-emerald-400 bg-black/60 border-emerald-500/30' : 'text-zinc-500 bg-black/60 border-zinc-700'}`}>
                {p.active !== false ? '● ATIVO' : '○ OCULTO'}
              </div>

              {/* Imagem */}
              <div className="w-full aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
                {p.image
                  ? <img src={p.image} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-all duration-700"/>
                  : <Package size={48} className="text-zinc-700"/>
                }
              </div>

              {/* Info */}
              <div className="p-6 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`font-black text-base leading-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>{p.name}</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block ${isDark ? 'bg-white/5 text-zinc-500' : 'bg-zinc-100 text-zinc-500'}`}>{p.category || 'Produto'}</span>
                  </div>
                  <p className="text-lg font-black text-[#C58A4A] whitespace-nowrap">R$ {Number(p.price).toFixed(2)}</p>
                </div>
                {p.description && (
                  <p className={`text-xs leading-relaxed line-clamp-2 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{p.description}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => openEdit(p)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${isDark ? 'bg-white/5 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}>
                    <Edit2 size={13}/> Editar
                  </button>
                  <button onClick={async () => await updateProduct(p.id, { active: p.active === false })}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${p.active !== false ? (isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-400') : (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-500')}`}>
                    {p.active !== false ? <><ToggleRight size={13}/> Ocultar</> : <><ToggleLeft size={13}/> Mostrar</>}
                  </button>
                  <button onClick={() => { if (window.confirm(`Remover "${p.name}"?`)) deleteProduct(p.id); }} className="p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className={`w-full max-w-lg rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] ${isDark ? 'cartao-vidro border-[#C58A4A]/10' : 'bg-white border border-zinc-200'}`}>

            <div className="p-8 pb-4 flex justify-between items-center shrink-0">
              <h2 className={`text-2xl font-black font-display italic tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {editingId ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button onClick={() => setShowModal(false)} className={`p-3 rounded-2xl transition-all ${isDark ? 'bg-white/5 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                <X size={20}/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-4 space-y-5 scrollbar-hide">

              {/* Foto */}
              <div className="space-y-2">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Foto do Produto</label>
                <div
                  className={`w-full aspect-video rounded-2xl overflow-hidden border-2 border-dashed flex items-center justify-center cursor-pointer relative group transition-all ${form.image ? 'border-transparent' : isDark ? 'border-white/10 hover:border-[#C58A4A]/40' : 'border-zinc-300 hover:border-[#C58A4A]'} bg-black`}
                  onClick={() => imgRef.current?.click()}
                >
                  {form.image
                    ? <>
                        <img src={form.image} alt="" className="w-full h-full object-contain"/>
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <p className="text-white font-black text-xs uppercase tracking-widest">Trocar Foto</p>
                        </div>
                      </>
                    : <div className="text-center space-y-2">
                        {uploading
                          ? <div className="w-8 h-8 border-2 border-[#C58A4A] border-t-transparent rounded-full animate-spin mx-auto"/>
                          : <ImagePlus size={32} className="mx-auto text-zinc-600"/>
                        }
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                          {uploading ? 'Enviando...' : 'Clique para adicionar foto'}
                        </p>
                      </div>
                  }
                  <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImg} disabled={uploading}/>
                </div>
              </div>

              {/* Nome */}
              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Nome do Produto</label>
                <input type="text" placeholder="Ex: Pomada Matte Black" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className={inputClass}/>
              </div>

              {/* Categoria + Preço */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Categoria</label>
                  <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className={inputClass}>
                    {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-zinc-950">{cat}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Preço (R$)</label>
                  <input type="number" step="0.01" placeholder="0,00" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} className={inputClass}/>
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Descrição</label>
                <textarea rows={3} placeholder="Descreva o produto, benefícios, como usar..." value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className={inputClass + ' resize-none leading-relaxed'}/>
              </div>

              {/* Ativo */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-50'}`}>
                <div>
                  <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>Visível na loja</p>
                  <p className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Ocultar sem precisar deletar</p>
                </div>
                <button type="button" onClick={() => setForm(f => ({...f, active: !f.active}))}>
                  {form.active
                    ? <ToggleRight size={32} className="text-emerald-500"/>
                    : <ToggleLeft  size={32} className="text-zinc-500"/>
                  }
                </button>
              </div>

            </div>

            <div className={`p-8 pt-4 flex gap-3 shrink-0 border-t ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
              <button onClick={() => setShowModal(false)} className={`flex-1 py-5 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${isDark ? 'bg-white/5 text-zinc-500 hover:text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || uploading} className="flex-1 gradiente-ouro text-black py-5 rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-xl disabled:opacity-50">
                {saving ? '⟳ Salvando...' : editingId ? '✓ Atualizar' : '+ Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
