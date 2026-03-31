import React, { useState } from 'react';
import { Camera, Trash2, X, Plus, Image } from 'lucide-react';
import { useBarberStore } from '../store';

const IMGBB_KEY = 'da736db48f154b9108b23a36d4393848';

const GaleriaCortes: React.FC = () => {
  const { config, updateConfig, theme } = useBarberStore() as any;
  const isDark = theme !== 'light';

  const [desc, setDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; desc: string } | null>(null);

  const cutGallery: { url: string; desc: string }[] = (config as any).cutGallery || [];

  const cardClass = isDark
    ? 'bg-[#0f0f0f] border border-white/5'
    : 'bg-white border border-zinc-200 shadow-sm';

  const inputClass = `w-full border p-4 rounded-xl text-sm font-bold outline-none transition-all ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#C58A4A]'
      : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500'
  }`;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Comprime antes de enviar
      const img = new window.Image();
      const blobUrl = URL.createObjectURL(file);
      img.onload = async () => {
        const MAX = 1200;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobUrl);
        const blob = await new Promise<Blob>(res =>
          canvas.toBlob(b => res(b!), 'image/jpeg', 0.85)
        );
        const formData = new FormData();
        formData.append('image', blob, 'corte.jpg');
        const res = await fetch(
          `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
          { method: 'POST', body: formData }
        );
        const json = await res.json();
        if (!json.success) throw new Error('Falha no upload');
        const url = json.data.url;
        const updated = [...cutGallery, { url, desc: desc.trim() }];
        await updateConfig({ cutGallery: updated });
        setDesc('');
        setUploading(false);
      };
      img.onerror = () => { setUploading(false); alert('Erro ao processar imagem.'); };
      img.src = blobUrl;
    } catch {
      alert('Erro ao enviar foto. Tente novamente.');
      setUploading(false);
    }
    e.target.value = '';
  };

  const handleDelete = async (idx: number) => {
    if (!window.confirm('Excluir esta foto da galeria?')) return;
    const updated = cutGallery.filter((_, i) => i !== idx);
    await updateConfig({ cutGallery: updated });
    setLightbox(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-20 h-full overflow-y-auto scrollbar-hide">

      {/* Header */}
      <div>
        <h1 className={`text-3xl font-black font-display italic tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          Galeria de Cortes
        </h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">
          Fotos exibidas na página pública para os clientes.
        </p>
      </div>

      {/* Upload card */}
      <div className={`rounded-[2rem] p-8 space-y-5 ${cardClass}`}>
        <div className="flex items-center gap-3 mb-2">
          <Camera size={20} className="text-[#C58A4A]" />
          <h3 className={`font-black text-sm uppercase tracking-widest ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Adicionar Nova Foto
          </h3>
        </div>

        <input
          type="text"
          placeholder="Descrição do corte (ex: Degradê com barba delineada)"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          className={inputClass}
        />

        <label
          className={`flex items-center justify-center gap-3 w-full py-5 rounded-2xl border-2 border-dashed cursor-pointer transition-all font-black text-[10px] uppercase tracking-widest ${
            uploading
              ? 'opacity-50 pointer-events-none border-zinc-600 text-zinc-500'
              : 'border-[#C58A4A]/40 text-[#C58A4A] hover:border-[#C58A4A] hover:bg-[#C58A4A]/5'
          }`}
        >
          {uploading ? (
            <><span className="animate-spin inline-block text-base">⟳</span> Enviando ao ImgBB...</>
          ) : (
            <><Camera size={16} /> Escolher foto do dispositivo</>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>

        <p className={`text-[9px] font-bold ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
          A foto é enviada ao ImgBB e salva automaticamente. Tamanho máximo recomendado: qualquer tamanho (comprimido automaticamente).
        </p>
      </div>

      {/* Gallery grid */}
      <div className={`rounded-[2rem] p-8 ${cardClass}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={`font-black text-sm uppercase tracking-widest ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Fotos Cadastradas
          </h3>
          <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            {cutGallery.length} foto{cutGallery.length !== 1 ? 's' : ''}
          </span>
        </div>

        {cutGallery.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl border-2 border-dashed ${isDark ? 'border-white/10 text-zinc-600' : 'border-zinc-200 text-zinc-400'}`}>
            <Image size={40} className="mx-auto mb-4 opacity-30" />
            <p className="font-black uppercase text-[10px] tracking-widest">Nenhuma foto ainda</p>
            <p className="text-[9px] mt-2 opacity-50">Adicione fotos dos cortes realizados para exibir na página pública</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {cutGallery.map((photo, idx) => (
              <div
                key={idx}
                className="relative group aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-lg"
                onClick={() => setLightbox(photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.desc || `Corte ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500"
                />
                {/* Overlay com descrição */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-end p-3">
                  {photo.desc && (
                    <p className="text-white text-[10px] font-bold leading-tight line-clamp-2 mb-1">
                      {photo.desc}
                    </p>
                  )}
                  <p className="text-zinc-400 text-[8px] font-black uppercase tracking-widest">
                    Clique para ampliar
                  </p>
                </div>
                {/* Botão excluir */}
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(idx); }}
                  className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-700 shadow-lg z-10"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-12 right-0 p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <img
              src={lightbox.url}
              alt={lightbox.desc}
              className="w-full rounded-3xl object-contain max-h-[70vh] shadow-2xl"
            />
            {lightbox.desc && (
              <div className="mt-4 px-2">
                <p className="text-white font-black text-lg font-display italic">{lightbox.desc}</p>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  const idx = cutGallery.findIndex(p => p.url === lightbox.url);
                  if (idx > -1) handleDelete(idx);
                }}
                className="flex-1 py-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-black text-[10px] uppercase tracking-widest hover:bg-red-500/30 transition-all"
              >
                🗑 Excluir Foto
              </button>
              <button
                onClick={() => setLightbox(null)}
                className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GaleriaCortes;
