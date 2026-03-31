// pages/GaleriaCortes.tsx — Galeria de Cortes com pastas e multi-upload
import React, { useState, useRef } from 'react';
import { Camera, Trash2, X, FolderPlus, Folder, ChevronLeft, ImageIcon, Edit2, Check } from 'lucide-react';
import { useBarberStore } from '../store';

const IMGBB_KEY = 'da736db48f154b9108b23a36d4393848';

export interface CutPhoto { url: string; desc: string; }
export interface CutAlbum { id: string; name: string; photos: CutPhoto[]; }

const GaleriaCortes: React.FC = () => {
  const { config, updateConfig, theme } = useBarberStore() as any;
  const isDark = theme !== 'light';

  const albums: CutAlbum[] = (config as any).cutAlbums || [];

  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [editingAlbumName, setEditingAlbumName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const card = isDark ? 'bg-[#0f0f0f] border border-white/5' : 'bg-white border border-zinc-200 shadow-sm';
  const inp  = `w-full border p-4 rounded-xl text-sm font-bold outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#C58A4A]' : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500'}`;

  const activeAlbum = albums.find(a => a.id === activeAlbumId) || null;
  const photos = activeAlbum?.photos || [];

  const saveAlbums = async (updated: CutAlbum[]) => {
    await updateConfig({ cutAlbums: updated });
  };

  const compressAndUpload = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const blobUrl = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1400;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio; canvas.height = img.height * ratio;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobUrl);
        canvas.toBlob(async (blob) => {
          if (!blob) { reject(new Error('Erro')); return; }
          const fd = new FormData();
          fd.append('image', blob, 'foto.jpg');
          const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
          const json = await res.json();
          if (!json.success) { reject(new Error('ImgBB falhou')); return; }
          resolve(json.data.url);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('Leitura falhou'));
      img.src = blobUrl;
    });
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) return;
    const newAlbum: CutAlbum = { id: Date.now().toString(), name: newAlbumName.trim(), photos: [] };
    await saveAlbums([...albums, newAlbum]);
    setNewAlbumName(''); setShowNewAlbum(false); setActiveAlbumId(newAlbum.id);
  };

  const handleRenameAlbum = async (id: string) => {
    if (!editingAlbumName.trim()) return;
    await saveAlbums(albums.map(a => a.id === id ? { ...a, name: editingAlbumName.trim() } : a));
    setEditingAlbumId(null);
  };

  const handleDeleteAlbum = async (id: string) => {
    if (!window.confirm('Excluir esta pasta e todas as fotos?')) return;
    await saveAlbums(albums.filter(a => a.id !== id));
    if (activeAlbumId === id) setActiveAlbumId(null);
  };

  const handleMultiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeAlbumId) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setUploadProgress(0);
    const uploaded: CutPhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const url = await compressAndUpload(files[i]);
        uploaded.push({ url, desc: '' });
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      } catch { /* pula falhas individuais */ }
    }
    const updated = albums.map(a =>
      a.id === activeAlbumId ? { ...a, photos: [...a.photos, ...uploaded] } : a
    );
    await saveAlbums(updated);
    setUploading(false); setUploadProgress(0);
    e.target.value = '';
  };

  const handleUpdateDesc = async (photoIdx: number, desc: string) => {
    if (!activeAlbumId) return;
    const updated = albums.map(a =>
      a.id === activeAlbumId
        ? { ...a, photos: a.photos.map((p, i) => i === photoIdx ? { ...p, desc } : p) }
        : a
    );
    await saveAlbums(updated);
  };

  const handleDeletePhoto = async (photoIdx: number) => {
    if (!activeAlbumId || !window.confirm('Excluir esta foto?')) return;
    const updated = albums.map(a =>
      a.id === activeAlbumId ? { ...a, photos: a.photos.filter((_, i) => i !== photoIdx) } : a
    );
    await saveAlbums(updated); setLightboxIdx(null);
  };

  const goNext = () => lightboxIdx !== null && lightboxIdx < photos.length - 1 && setLightboxIdx(lightboxIdx + 1);
  const goPrev = () => lightboxIdx !== null && lightboxIdx > 0 && setLightboxIdx(lightboxIdx - 1);
  const onDragStart = (x: number) => setDragStartX(x);
  const onDragEnd = (x: number) => {
    if (dragStartX === null) return;
    const diff = dragStartX - x;
    if (diff > 50) goNext(); else if (diff < -50) goPrev();
    setDragStartX(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-20 h-full overflow-y-auto scrollbar-hide">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {activeAlbum ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveAlbumId(null)} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'} transition-all`}>
                <ChevronLeft size={20}/>
              </button>
              <div>
                <h1 className={`text-2xl font-black font-display italic ${isDark ? 'text-white' : 'text-zinc-900'}`}>{activeAlbum.name}</h1>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{activeAlbum.photos.length} foto{activeAlbum.photos.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className={`text-3xl font-black font-display italic tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>Galeria de Cortes</h1>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Organize em pastas exibidas na página pública.</p>
            </div>
          )}
        </div>

        {!activeAlbum && (
          <button onClick={() => setShowNewAlbum(true)} className="flex items-center gap-2 gradiente-ouro text-black px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all">
            <FolderPlus size={16}/> Nova Pasta
          </button>
        )}
        {activeAlbum && (
          <label className={`flex items-center gap-2 gradiente-ouro text-black px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg cursor-pointer hover:scale-105 transition-all ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Camera size={14}/> {uploading ? `Enviando ${uploadProgress}%` : 'Adicionar Fotos'}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleMultiUpload} disabled={uploading}/>
          </label>
        )}
      </div>

      {/* Nova pasta form */}
      {showNewAlbum && !activeAlbum && (
        <div className={`rounded-2xl p-6 border animate-in slide-in-from-top-2 space-y-4 ${isDark ? 'bg-[#C58A4A]/5 border-[#C58A4A]/20' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#C58A4A]">📁 Nome da Nova Pasta</p>
          <div className="flex gap-3">
            <input type="text" placeholder="Ex: Degradês, Cortes Clássicos, Barba..." value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateAlbum()} autoFocus className={inp}/>
            <button onClick={handleCreateAlbum} className="px-5 py-3 gradiente-ouro text-black rounded-xl font-black text-[10px] uppercase whitespace-nowrap">Criar</button>
            <button onClick={() => { setShowNewAlbum(false); setNewAlbumName(''); }} className={`px-4 py-3 rounded-xl font-black text-[10px] uppercase border ${isDark ? 'bg-white/5 border-white/10 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-500'}`}>✕</button>
          </div>
        </div>
      )}

      {/* Grid de pastas */}
      {!activeAlbum && (
        albums.length === 0 ? (
          <div className={`text-center py-20 rounded-3xl border-2 border-dashed ${isDark ? 'border-white/10 text-zinc-600' : 'border-zinc-200 text-zinc-400'}`}>
            <Folder size={48} className="mx-auto mb-4 opacity-30"/>
            <p className="font-black uppercase text-[10px] tracking-widest">Nenhuma pasta criada</p>
            <p className="text-[9px] mt-2 opacity-50">Crie pastas para organizar os cortes por estilo</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {albums.map(album => (
              <div key={album.id} className={`rounded-[2rem] border overflow-hidden group cursor-pointer transition-all hover:scale-[1.02] hover:border-[#C58A4A]/40 ${card}`} onClick={() => setActiveAlbumId(album.id)}>
                <div className="aspect-square relative bg-zinc-900">
                  {album.photos.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center"><Folder size={40} className="text-zinc-700"/></div>
                  ) : album.photos.length === 1 ? (
                    <img src={album.photos[0].url} className="w-full h-full object-cover" alt=""/>
                  ) : (
                    <div className="grid grid-cols-2 h-full">
                      {album.photos.slice(0,4).map((p,i) => <img key={i} src={p.url} className="w-full h-full object-cover" alt=""/>)}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingAlbumId(album.id); setEditingAlbumName(album.name); }} className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80 transition-all"><Edit2 size={12}/></button>
                    <button onClick={() => handleDeleteAlbum(album.id)} className="p-1.5 bg-red-600/80 text-white rounded-lg hover:bg-red-600 transition-all"><Trash2 size={12}/></button>
                  </div>
                </div>
                <div className="p-4">
                  {editingAlbumId === album.id ? (
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <input autoFocus value={editingAlbumName} onChange={e => setEditingAlbumName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRenameAlbum(album.id)} className={`flex-1 border p-2 rounded-lg text-xs font-bold outline-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-900'}`}/>
                      <button onClick={() => handleRenameAlbum(album.id)} className="p-2 bg-[#C58A4A] text-black rounded-lg"><Check size={12}/></button>
                    </div>
                  ) : (
                    <>
                      <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>{album.name}</p>
                      <p className={`text-[9px] font-bold mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{album.photos.length} foto{album.photos.length !== 1 ? 's' : ''}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Fotos da pasta ativa */}
      {activeAlbum && (
        <>
          {uploading && (
            <div className={`rounded-2xl p-4 border ${isDark ? 'bg-[#C58A4A]/5 border-[#C58A4A]/20' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#C58A4A]">Enviando fotos ao ImgBB...</p>
                <p className="text-[10px] font-black text-[#C58A4A]">{uploadProgress}%</p>
              </div>
              <div className={`h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-zinc-200'}`}>
                <div className="h-full gradiente-ouro rounded-full transition-all duration-300" style={{width:`${uploadProgress}%`}}/>
              </div>
            </div>
          )}

          {activeAlbum.photos.length === 0 ? (
            <div className={`text-center py-20 rounded-3xl border-2 border-dashed ${isDark ? 'border-white/10 text-zinc-600' : 'border-zinc-200 text-zinc-400'}`}>
              <ImageIcon size={48} className="mx-auto mb-4 opacity-30"/>
              <p className="font-black uppercase text-[10px] tracking-widest">Nenhuma foto nesta pasta</p>
              <p className="text-[9px] mt-2 opacity-50">Clique em "Adicionar Fotos" — pode selecionar várias de uma vez</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeAlbum.photos.map((photo, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="relative group aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-lg" onClick={() => setLightboxIdx(idx)}>
                    <img src={photo.url} alt={photo.desc || `Foto ${idx+1}`} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500"/>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all"/>
                    <button onClick={e => { e.stopPropagation(); handleDeletePhoto(idx); }} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                      <Trash2 size={12}/>
                    </button>
                  </div>
                  <input type="text" placeholder="Descrição (opcional)" value={photo.desc} onChange={e => handleUpdateDesc(idx, e.target.value)} className={`w-full border p-2 rounded-xl text-[10px] font-bold outline-none transition-all ${isDark ? 'bg-white/5 border-white/5 text-white placeholder:text-zinc-700 focus:border-[#C58A4A]/50' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400'}`}/>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox com swipe/arrastar */}
      {lightboxIdx !== null && activeAlbum && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/98 backdrop-blur-xl animate-in fade-in select-none"
          onClick={() => setLightboxIdx(null)}
          onTouchStart={e => onDragStart(e.touches[0].clientX)}
          onTouchEnd={e => onDragEnd(e.changedTouches[0].clientX)}
          onMouseDown={e => onDragStart(e.clientX)}
          onMouseUp={e => onDragEnd(e.clientX)}
        >
          <div className="relative w-full max-w-lg px-4" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-3">
              <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{lightboxIdx + 1} / {photos.length}</span>
            </div>
            <img src={photos[lightboxIdx].url} alt={photos[lightboxIdx].desc} className="w-full rounded-3xl object-contain max-h-[65vh] shadow-2xl" draggable={false}/>
            {photos[lightboxIdx].desc && (
              <p className="text-white font-black text-base font-display italic text-center mt-3 px-2">{photos[lightboxIdx].desc}</p>
            )}
            {/* Setas */}
            {lightboxIdx > 0 && (
              <button onClick={e => { e.stopPropagation(); goPrev(); }} className="absolute left-0 top-[40%] p-3 bg-black/50 text-white rounded-xl hover:bg-black/70 transition-all">
                <ChevronLeft size={24}/>
              </button>
            )}
            {lightboxIdx < photos.length - 1 && (
              <button onClick={e => { e.stopPropagation(); goNext(); }} className="absolute right-0 top-[40%] p-3 bg-black/50 text-white rounded-xl hover:bg-black/70 transition-all rotate-180">
                <ChevronLeft size={24}/>
              </button>
            )}
            {/* Dots */}
            {photos.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-4">
                {photos.map((_, i) => (
                  <button key={i} onClick={e => { e.stopPropagation(); setLightboxIdx(i); }} className={`rounded-full transition-all ${i === lightboxIdx ? 'w-4 h-2 bg-[#C58A4A]' : 'w-2 h-2 bg-white/30'}`}/>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={e => { e.stopPropagation(); handleDeletePhoto(lightboxIdx); }} className="flex-1 py-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-black text-[10px] uppercase tracking-widest hover:bg-red-500/30 transition-all">🗑 Excluir</button>
              <button onClick={() => setLightboxIdx(null)} className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GaleriaCortes;
