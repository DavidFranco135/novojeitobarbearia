import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, 
  ArrowUpCircle, ArrowDownCircle,
  BarChart3, Download, PieChart as PieChartIcon,
  Activity, TrendingDown as TrendingDownIcon,
  Trash2, Eye, X, Calendar, User, MapPin, Clock, CreditCard
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { Rental, FinancialTransaction, User } from '../types';

interface FinancialProps {
  rentals: Rental[];
  transactions: FinancialTransaction[];
  setTransactions: (action: any) => void;
}

const Financial: React.FC<FinancialProps> = ({ rentals = [], transactions = [], setTransactions }) => {
  const [viewTab, setViewTab] = useState<'Mês' | 'Ano'>('Mês');
  const [currentDate] = useState(new Date());
  const [activeFilter, setActiveFilter] = useState<'Receitas' | 'Despesas' | 'Lucro' | 'AReceber'>('Lucro');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Rental | FinancialTransaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const userStr = localStorage.getItem('susu_user');
  const user: User | null = userStr ? JSON.parse(userStr) : null;

  // Cores para os gráficos
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Filtragem e Cálculos com proteção contra valores undefined
  const stats = useMemo(() => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();

    const filteredRentals = (rentals || []).filter(r => {
      const d = new Date(r.date + 'T00:00:00');
      return viewTab === 'Mês' ? (d.getMonth() === month && d.getFullYear() === year) : (d.getFullYear() === year);
    });

    const filteredTrans = (transactions || []).filter(t => {
      const d = new Date(t.date);
      return viewTab === 'Mês' ? (d.getMonth() === month && d.getFullYear() === year) : (d.getFullYear() === year);
    });

    const receitas = filteredRentals.reduce((acc, r) => acc + (Number(r.entryValue) || 0), 0);
    const despesas = filteredTrans.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + (Number(t.value) || 0), 0);
    const aReceber = filteredRentals.reduce((acc, r) => acc + ((Number(r.totalValue) || 0) - (Number(r.entryValue) || 0)), 0);
    const lucro = receitas - despesas;

    return { receitas, despesas, aReceber, lucro, filteredRentals, filteredTrans };
  }, [rentals, transactions, currentDate, viewTab]);

  // Dados do gráfico de área
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months.map((m, i) => {
      const r = stats.filteredRentals.filter(rent => new Date(rent.date + 'T00:00:00').getMonth() === i).reduce((acc, rent) => acc + (Number(rent.entryValue) || 0), 0);
      const d = stats.filteredTrans.filter(t => t.type === 'EXPENSE' && new Date(t.date).getMonth() === i).reduce((acc, t) => acc + (Number(t.value) || 0), 0);
      const lucro = r - d;
      return { name: m, Entradas: r, Saídas: d, Lucro: lucro };
    });
  }, [stats, viewTab]);

  // Dados para gráfico de pizza (Receitas vs Despesas)
  const pieData = useMemo(() => [
    { name: 'Receitas', value: stats.receitas, color: '#10b981' },
    { name: 'Despesas', value: stats.despesas, color: '#ef4444' },
    { name: 'A Receber', value: stats.aReceber, color: '#f59e0b' }
  ], [stats]);

  // Dados para gráfico de barras (Por categoria de despesa)
  const expensesByCategory = useMemo(() => {
    const categories: {[key: string]: number} = {};
    stats.filteredTrans.filter(t => t.type === 'EXPENSE').forEach(t => {
      const cat = t.category || 'Outros';
      categories[cat] = (categories[cat] || 0) + (Number(t.value) || 0);
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [stats]);

  // Dados para gráfico de linha (Evolução do lucro)
  const profitTrendData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months.map((m, i) => {
      const r = stats.filteredRentals.filter(rent => new Date(rent.date + 'T00:00:00').getMonth() === i).reduce((acc, rent) => acc + (Number(rent.entryValue) || 0), 0);
      const d = stats.filteredTrans.filter(t => t.type === 'EXPENSE' && new Date(t.date).getMonth() === i).reduce((acc, t) => acc + (Number(t.value) || 0), 0);
      return { name: m, Lucro: r - d };
    });
  }, [stats]);

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    
    try {
      const element = document.getElementById('financial-report-print');
      if (!element) {
        alert('Erro: Elemento não encontrado');
        return;
      }
      
      element.style.display = 'block';
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.top = '0';
      element.style.width = '1200px';
      
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await (window as any).html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 1200,
        height: element.scrollHeight
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const { jsPDF } = (window as any).jspdf;
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      if (imgHeight <= pageHeight - (margin * 2)) {
        pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let position = margin;
        
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin);
        
        while (heightLeft > 0) {
          position = heightLeft - imgHeight + margin;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      }

      const periodName = viewTab === 'Mês' 
        ? currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : currentDate.getFullYear().toString();
      
      pdf.save(`Relatorio-Financeiro-${periodName}.pdf`);
      
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert("Erro ao gerar o PDF. Tente novamente.");
    } finally {
      const element = document.getElementById('financial-report-print');
      if (element) {
        element.style.display = 'none';
        element.style.position = '';
        element.style.left = '';
        element.style.top = '';
        element.style.width = '';
      }
      setIsGeneratingPDF(false);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;
    setTransactions((prev: FinancialTransaction[]) => prev.filter(t => t.id !== id));
  };

  const handleViewDetails = (item: Rental | FinancialTransaction) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Relatório oculto para PDF */}
      <div id="financial-report-print" style={{ display: 'none' }} className="bg-white p-16 text-slate-900">
        <div className="border-b-4 border-slate-900 pb-10 mb-12 flex justify-between items-end">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-[32px] overflow-hidden border-2 border-slate-900">
              {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} className="w-full h-full object-cover" alt="Logo" /> : <div className="w-full h-full bg-slate-100"/>}
            </div>
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tight">Relatório Financeiro</h1>
              <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-2">
                {viewTab === 'Mês' 
                  ? currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                  : `Ano ${currentDate.getFullYear()}`}
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-black opacity-40">GERADO EM</p>
            <p className="font-black text-xl">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-8 mb-12">
          <div className="bg-emerald-50 p-6 rounded-3xl border-2 border-emerald-200">
            <p className="text-[10px] font-black uppercase mb-2 text-emerald-600">Receitas</p>
            <p className="text-3xl font-black text-emerald-700">R$ {stats.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-red-50 p-6 rounded-3xl border-2 border-red-200">
            <p className="text-[10px] font-black uppercase mb-2 text-red-600">Despesas</p>
            <p className="text-3xl font-black text-red-700">R$ {stats.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-200">
            <p className="text-[10px] font-black uppercase mb-2 text-blue-600">Lucro Líquido</p>
            <p className="text-3xl font-black text-blue-700">R$ {stats.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-amber-50 p-6 rounded-3xl border-2 border-amber-200">
            <p className="text-[10px] font-black uppercase mb-2 text-amber-600">A Receber</p>
            <p className="text-3xl font-black text-amber-700">R$ {stats.aReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="space-y-10">
          <div>
            <h2 className="text-2xl font-black uppercase mb-6 pb-3 border-b-2 border-slate-900">Receitas Detalhadas</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 uppercase font-black">
                  <th className="py-3 text-left">Data</th>
                  <th className="py-3 text-left">Cliente</th>
                  <th className="py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.filteredRentals.slice(0, 15).map(r => (
                  <tr key={r.id}>
                    <td className="py-3 font-bold opacity-60">{new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 font-black">{r.customerName}</td>
                    <td className="py-3 text-right font-black text-emerald-700">R$ {(Number(r.entryValue) || 0).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-2xl font-black uppercase mb-6 pb-3 border-b-2 border-slate-900">Despesas Detalhadas</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 uppercase font-black">
                  <th className="py-3 text-left">Data</th>
                  <th className="py-3 text-left">Descrição</th>
                  <th className="py-3 text-left">Categoria</th>
                  <th className="py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.filteredTrans.filter(t => t.type === 'EXPENSE').slice(0, 15).map(t => (
                  <tr key={t.id}>
                    <td className="py-3 font-bold opacity-60">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 font-black">{t.description}</td>
                    <td className="py-3 uppercase text-[10px] opacity-60">{t.category}</td>
                    <td className="py-3 text-right font-black text-red-700">R$ {(Number(t.value) || 0).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 border-t-4 border-slate-900 pt-8 text-center">
          <div className="bg-slate-900 text-white p-8 rounded-3xl">
            <p className="text-sm font-black uppercase mb-3 opacity-60">Resultado Final do Período</p>
            <p className="text-5xl font-black">R$ {stats.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-sm font-bold mt-3 uppercase">
              Margem: {stats.receitas > 0 ? ((stats.lucro / stats.receitas) * 100).toFixed(1) : '0'}%
            </p>
          </div>
        </div>

        <div className="mt-10 border-t pt-4 text-[9px] font-black uppercase opacity-40 text-center">
          Gerado por {user?.name} em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
        </div>
      </div>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
        <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">Fluxo de Caixa</h1>
        <div className="grid grid-cols-2 md:flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setActiveFilter('Receitas')}
            className="flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 md:px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg"
          >
            <ArrowUpCircle size={18} /> Receitas
          </button>
          <button 
            onClick={() => setActiveFilter('Despesas')}
            className="flex items-center justify-center gap-2 bg-rose-500 text-white px-4 md:px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg"
          >
            <ArrowDownCircle size={18} /> Despesas
          </button>
          <button 
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 md:px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed col-span-2 md:col-span-1"
          >
            <Download size={18} /> {isGeneratingPDF ? 'Gerando...' : 'Relatório PDF'}
          </button>
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border col-span-2 md:col-span-1">
            <button onClick={() => setViewTab('Mês')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase ${viewTab === 'Mês' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>Mês</button>
            <button onClick={() => setViewTab('Ano')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase ${viewTab === 'Ano' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>Ano</button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Card Receitas */}
        <button onClick={() => setActiveFilter('Receitas')} className={`p-6 rounded-[35px] border-2 transition-all text-left ${activeFilter === 'Receitas' ? 'bg-emerald-500 border-emerald-200 text-white shadow-xl' : 'bg-white border-transparent'}`}>
          <ArrowUpCircle size={32} className={activeFilter === 'Receitas' ? 'text-white' : 'text-emerald-500'} />
          <p className="mt-4 text-[10px] font-black uppercase opacity-70">Receitas</p>
          <h3 className="text-2xl font-black">R$ {(stats.receitas || 0).toLocaleString('pt-BR')}</h3>
        </button>

        {/* Card Despesas */}
        <button onClick={() => setActiveFilter('Despesas')} className={`p-6 rounded-[35px] border-2 transition-all text-left ${activeFilter === 'Despesas' ? 'bg-rose-500 border-rose-200 text-white shadow-xl' : 'bg-white border-transparent'}`}>
          <ArrowDownCircle size={32} className={activeFilter === 'Despesas' ? 'text-white' : 'text-rose-500'} />
          <p className="mt-4 text-[10px] font-black uppercase opacity-70">Despesas</p>
          <h3 className="text-2xl font-black">R$ {(stats.despesas || 0).toLocaleString('pt-BR')}</h3>
        </button>

        {/* Card Lucro */}
        <button onClick={() => setActiveFilter('Lucro')} className={`p-6 rounded-[35px] border-2 transition-all text-left ${activeFilter === 'Lucro' ? 'bg-blue-600 border-blue-200 text-white shadow-xl' : 'bg-white border-transparent'}`}>
          <TrendingUp size={32} className={activeFilter === 'Lucro' ? 'text-white' : 'text-blue-600'} />
          <p className="mt-4 text-[10px] font-black uppercase opacity-70">Lucro</p>
          <h3 className="text-2xl font-black">R$ {(stats.lucro || 0).toLocaleString('pt-BR')}</h3>
        </button>

        {/* Card A Receber */}
        <button onClick={() => setActiveFilter('AReceber')} className={`p-6 rounded-[35px] border-2 transition-all text-left ${activeFilter === 'AReceber' ? 'bg-amber-500 border-amber-200 text-white shadow-xl' : 'bg-white border-transparent'}`}>
          <Wallet size={32} className={activeFilter === 'AReceber' ? 'text-white' : 'text-amber-500'} />
          <p className="mt-4 text-[10px] font-black uppercase opacity-70">A Receber</p>
          <h3 className="text-2xl font-black">R$ {(stats.aReceber || 0).toLocaleString('pt-BR')}</h3>
        </button>
      </div>

      {/* Gráficos - Grade 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Área - Comparativo Financeiro */}
        <div className="bg-white p-8 rounded-[40px] border shadow-sm h-[400px]">
          <h3 className="text-sm font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
            <BarChart3 size={18} /> Comparativo Mensal
          </h3>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} tickFormatter={(v) => `R$${v}`} />
              <Tooltip contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} />
              <Area type="monotone" dataKey="Entradas" stroke="#10b981" fillOpacity={0.1} fill="#10b981" strokeWidth={3} />
              <Area type="monotone" dataKey="Saídas" stroke="#f43f5e" fillOpacity={0.1} fill="#f43f5e" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico 2: Pizza - Distribuição */}
        <div className="bg-white p-8 rounded-[40px] border shadow-sm h-[400px]">
          <h3 className="text-sm font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
            <PieChartIcon size={18} /> Distribuição Financeira
          </h3>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `R$ ${value.toLocaleString('pt-BR')}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico 3: Barras - Despesas por Categoria */}
        <div className="bg-white p-8 rounded-[40px] border shadow-sm h-[400px]">
          <h3 className="text-sm font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
            <BarChart3 size={18} /> Despesas por Categoria
          </h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={expensesByCategory}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(value: any) => `R$ ${value.toLocaleString('pt-BR')}`} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} />
              <Bar dataKey="value" fill="#ef4444" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico 4: Linha - Evolução do Lucro */}
        <div className="bg-white p-8 rounded-[40px] border shadow-sm h-[400px]">
          <h3 className="text-sm font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
            <Activity size={18} /> Evolução do Lucro
          </h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={profitTrendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(value: any) => `R$ ${value.toLocaleString('pt-BR')}`} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} />
              <Line type="monotone" dataKey="Lucro" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Listagem com proteção toLocaleString */}
      <div className="bg-white rounded-[30px] border overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
            <tr>
              <th className="px-8 py-4">Descrição</th>
              <th className="px-8 py-4">Data</th>
              <th className="px-8 py-4">Valor</th>
              <th className="px-8 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm font-bold">
            {(activeFilter === 'Receitas' || activeFilter === 'Lucro') && stats.filteredRentals.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleViewDetails(r)}>
                <td className="px-8 py-4">Entrada: {r.customerName}</td>
                <td className="px-8 py-4 text-slate-400">{new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="px-8 py-4 text-emerald-600">+ R$ {(Number(r.entryValue) || 0).toLocaleString('pt-BR')}</td>
                <td className="px-8 py-4 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleViewDetails(r); }}
                    className="p-2 text-blue-500 hover:text-white hover:bg-blue-500 rounded-xl transition-all"
                    title="Ver detalhes"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {(activeFilter === 'Despesas' || activeFilter === 'Lucro') && stats.filteredTrans.map(t => (
              <tr key={t.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleViewDetails(t)}>
                <td className="px-8 py-4">{t.description}</td>
                <td className="px-8 py-4 text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td className="px-8 py-4 text-rose-500">- R$ {(Number(t.value) || 0).toLocaleString('pt-BR')}</td>
                <td className="px-8 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleViewDetails(t); }}
                      className="p-2 text-blue-500 hover:text-white hover:bg-blue-500 rounded-xl transition-all"
                      title="Ver detalhes"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(t.id); }}
                      className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-xl transition-all"
                      title="Excluir despesa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {activeFilter === 'AReceber' && stats.filteredRentals.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleViewDetails(r)}>
                <td className="px-8 py-4">Pendente: {r.customerName}</td>
                <td className="px-8 py-4 text-slate-400">{new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="px-8 py-4 text-amber-500">R$ {((Number(r.totalValue) || 0) - (Number(r.entryValue) || 0)).toLocaleString('pt-BR')}</td>
                <td className="px-8 py-4 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleViewDetails(r); }}
                    className="p-2 text-blue-500 hover:text-white hover:bg-blue-500 rounded-xl transition-all"
                    title="Ver detalhes"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] max-w-2xl w-full shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-black text-white">Detalhes da Transação</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-all"
              >
                <X size={24} className="text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              {/* Verifica se é uma Reserva (Rental) */}
              {('customerName' in selectedItem) && (
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase">
                        <User size={14} />
                        Cliente
                      </div>
                      <p className="text-lg font-black text-slate-800">{selectedItem.customerName}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase">
                        <Calendar size={14} />
                        Data do Evento
                      </div>
                      <p className="text-lg font-bold text-slate-700">
                        {new Date(selectedItem.date + 'T00:00:00').toLocaleDateString('pt-BR', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase">
                        <Clock size={14} />
                        Horário
                      </div>
                      <p className="text-lg font-bold text-slate-700">{selectedItem.startTime} - {selectedItem.endTime}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase">
                        <CreditCard size={14} />
                        Forma de Pagamento
                      </div>
                      <p className="text-lg font-bold text-slate-700">{selectedItem.paymentMethod}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase">
                      <MapPin size={14} />
                      Local do Evento
                    </div>
                    <p className="text-base font-bold text-slate-700">{selectedItem.eventAddress || 'Não informado'}</p>
                  </div>

                  {selectedItem.additionalService && (
                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                      <p className="text-xs font-black text-purple-400 uppercase mb-2">Serviço Adicional</p>
                      <p className="font-bold text-purple-700 mb-1">{selectedItem.additionalService}</p>
                      <p className="text-lg font-black text-purple-600">R$ {(selectedItem.additionalServiceValue || 0).toLocaleString('pt-BR')}</p>
                    </div>
                  )}

                  <div className="border-t pt-6 mt-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl">
                        <p className="text-xs font-black text-slate-400 uppercase mb-1">Valor Total</p>
                        <p className="text-2xl font-black text-slate-800">R$ {(selectedItem.totalValue || 0).toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="bg-emerald-50 p-4 rounded-2xl">
                        <p className="text-xs font-black text-emerald-600 uppercase mb-1">Sinal Pago</p>
                        <p className="text-2xl font-black text-emerald-700">R$ {(selectedItem.entryValue || 0).toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-2xl">
                        <p className="text-xs font-black text-amber-600 uppercase mb-1">Saldo Restante</p>
                        <p className="text-2xl font-black text-amber-700">
                          R$ {((selectedItem.totalValue || 0) - (selectedItem.entryValue || 0)).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Verifica se é uma Despesa (FinancialTransaction) */}
              {('type' in selectedItem) && (
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase">
                        Descrição
                      </div>
                      <p className="text-lg font-black text-slate-800">{selectedItem.description}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase">
                        <Calendar size={14} />
                        Data
                      </div>
                      <p className="text-lg font-bold text-slate-700">
                        {new Date(selectedItem.date).toLocaleDateString('pt-BR', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase">
                        Categoria
                      </div>
                      <p className="text-lg font-bold text-slate-700">{selectedItem.category || 'Não categorizado'}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase">
                        Tipo
                      </div>
                      <span className={`inline-block px-4 py-2 rounded-full text-sm font-black ${
                        selectedItem.type === 'EXPENSE' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {selectedItem.type === 'EXPENSE' ? 'Despesa' : 'Receita'}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-6 mt-6">
                    <div className="bg-slate-900 p-6 rounded-2xl">
                      <p className="text-xs font-black text-slate-400 uppercase mb-2">Valor</p>
                      <p className="text-4xl font-black text-white">
                        {selectedItem.type === 'EXPENSE' ? '- ' : '+ '}
                        R$ {(Number(selectedItem.value) || 0).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 pb-8">
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
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

export default Financial;
