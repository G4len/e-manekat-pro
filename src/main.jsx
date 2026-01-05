import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Settings, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  Printer, 
  Download,
  Image as ImageIcon,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  UserCircle,
  ShieldCheck,
  LogOut,
  Upload,
  Eye,
  X,
  Plus,
  Share2,
  Users,
  Tag,
  Lock,
  AlertCircle,
  Info,
  Filter,
  Calendar,
  FileDown,
  Coins,
  BookOpen
} from 'lucide-react';

/**
 * Penanganan konfigurasi Firebase yang kompatibel dengan berbagai environment.
 */
const getFirebaseConfig = () => {
  let config = {};
  if (typeof __firebase_config !== 'undefined') {
    try {
      config = JSON.parse(__firebase_config);
    } catch (e) {
      console.error("Gagal parse __firebase_config:", e);
    }
  } 
  try {
    const env = (import.meta && import.meta.env) ? import.meta.env : {};
    if (env.VITE_FIREBASE_CONFIG) {
      config = JSON.parse(env.VITE_FIREBASE_CONFIG);
    }
  } catch (e) {}
  return config;
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let safeAppId = 'e-manekat-v1';
try {
  const env = (import.meta && import.meta.env) ? import.meta.env : {};
  if (env.VITE_APP_ID) safeAppId = env.VITE_APP_ID;
  else if (typeof __app_id !== 'undefined') safeAppId = __app_id;
} catch (e) {}

const appId = safeAppId;

const App = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [masterData, setMasterData] = useState({
    categories: ['Umum', 'Pendidikan', 'Kesehatan', 'Rumah Tangga'],
    familyMembers: ['Ayah', 'Ibu'],
    minTransfer: 50000
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });

  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    member: '',
    type: ''
  });

  const [formData, setFormData] = useState({
    type: 'simpanan',
    amount: '',
    description: '',
    category: '',
    member: '',
    date: new Date().toISOString().split('T')[0],
    proofImage: null
  });

  const fileInputRef = useRef(null);

  const notify = (message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !role) return;

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'));
    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setIsLoading(false);
    }, (error) => console.error("Firestore error:", error));

    const masterDoc = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    const unsubscribeMaster = onSnapshot(masterDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMasterData(data);
        if (!formData.category && data.categories) setFormData(prev => ({ ...prev, category: data.categories[0] || '' }));
        if (!formData.member && data.familyMembers) setFormData(prev => ({ ...prev, member: data.familyMembers[0] || '' }));
      } else {
        setDoc(masterDoc, masterData);
      }
    });

    return () => {
      unsubscribeTrans();
      unsubscribeMaster();
    };
  }, [user, role]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isApproved = t.status === 'approved';
      const matchStart = !reportFilters.startDate || t.date >= reportFilters.startDate;
      const matchEnd = !reportFilters.endDate || t.date <= reportFilters.endDate;
      const matchMember = !reportFilters.member || t.userName === reportFilters.member;
      const matchType = !reportFilters.type || t.type === reportFilters.type;
      return isApproved && matchStart && matchEnd && matchMember && matchType;
    });
  }, [transactions, reportFilters]);

  const stats = useMemo(() => {
    const approvedOnly = transactions.filter(t => t.status === 'approved');
    const totalSimpanan = approvedOnly.filter(t => t.type === 'simpanan').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalPengeluaran = approvedOnly.filter(t => t.type === 'pengeluaran').reduce((sum, t) => sum + Number(t.amount), 0);
    return { total: totalSimpanan - totalPengeluaran, simpanan: totalSimpanan, pengeluaran: totalPengeluaran };
  }, [transactions]);

  const filteredStats = useMemo(() => {
    const sim = filteredTransactions.filter(t => t.type === 'simpanan').reduce((sum, t) => sum + Number(t.amount), 0);
    const peng = filteredTransactions.filter(t => t.type === 'pengeluaran').reduce((sum, t) => sum + Number(t.amount), 0);
    return { sim, peng, diff: sim - peng };
  }, [filteredTransactions]);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (loginCreds.username === 'admin' && loginCreds.password === '@Angker2026') {
      setRole('admin');
      setShowLoginModal(false);
      setLoginCreds({ username: '', password: '' });
      notify("Berhasil masuk sebagai Admin", "success");
    } else {
      notify("Username atau Password salah!");
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) { 
        notify("Ukuran gambar terlalu besar. Maksimal 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, proofImage: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    if (!formData.member) return notify("Wajib memilih Nama Anggota!");
    if (!formData.amount || Number(formData.amount) <= 0) return notify("Nominal harus lebih dari 0!");
    if (!formData.category) return notify("Wajib memilih Kategori!");
    if (!formData.description || formData.description.length < 5) return notify("Keterangan terlalu singkat (min. 5 karakter)!");
    if (!formData.proofImage) return notify("Wajib melampirkan Bukti Foto/Screenshot!");

    if (formData.type === 'simpanan' && Number(formData.amount) < masterData.minTransfer) {
      return notify(`Batas minimal simpanan adalah Rp ${masterData.minTransfer.toLocaleString()}`);
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
        ...formData,
        amount: Number(formData.amount),
        createdAt: new Date().toISOString(),
        userId: user.uid,
        userName: formData.member,
        status: 'waiting' 
      });
      setFormData(prev => ({ 
        ...prev, 
        amount: '', 
        description: '', 
        proofImage: null,
        type: 'simpanan' 
      }));
      notify("Pengajuan berhasil dikirim!", "success");
      setActiveTab('dashboard');
    } catch (err) {
      notify("Gagal menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateMaster = async (field, value, action = 'add') => {
    const masterDoc = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    try {
      if (action === 'add') {
        await updateDoc(masterDoc, { [field]: arrayUnion(value) });
      } else if (action === 'remove') {
        await updateDoc(masterDoc, { [field]: arrayRemove(value) });
      } else {
        await updateDoc(masterDoc, { [field]: value });
      }
      notify("Data master diperbarui", "success");
    } catch (err) {
      notify("Gagal memperbarui data master");
    }
  };

  const shareToWhatsApp = () => {
    const text = `*LAPORAN KAS E-MANEKAT*\nFilter: ${reportFilters.member || 'Semua'} (${reportFilters.startDate || 'Awal'} s/d ${reportFilters.endDate || 'Sekarang'})\n\n💰 *Total Saldo Filter:* Rp ${filteredStats.diff.toLocaleString()}\n\n_Dibuat via Sistem E-Manekat Pro_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans">
        {notification && <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] p-4 px-6 rounded-2xl shadow-2xl flex items-center gap-3 bg-rose-600 text-white`}>
          {notification.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="font-bold text-sm">{notification.message}</span>
        </div>}

        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
            <ShieldCheck className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">E-MANEKAT</h1>
          <p className="text-slate-500 mb-8 font-medium">Dana Kas Keluarga Terintegrasi</p>
          
          <div className="space-y-4">
            <button onClick={() => setShowLoginModal(true)} className="w-full flex items-center justify-between p-5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg">
              <div className="flex items-center gap-4 text-left">
                <ShieldCheck size={24} />
                <div><p className="font-bold">Login Admin</p><p className="text-[10px] opacity-70 uppercase font-bold tracking-widest">Full Control</p></div>
              </div>
            </button>
            <button onClick={() => setRole('user')} className="w-full flex items-center justify-between p-5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl hover:bg-emerald-100 transition-all text-emerald-900">
              <div className="flex items-center gap-4 text-left">
                <UserCircle size={24} />
                <div><p className="font-bold">Login Keluarga</p><p className="text-[10px] opacity-70 uppercase font-bold tracking-widest">Input Kas & Pengeluaran</p></div>
              </div>
            </button>
          </div>
        </div>

        {showLoginModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form onSubmit={handleAdminLogin} className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl relative">
              <button type="button" onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400"><X size={20}/></button>
              <Lock className="text-blue-600 mx-auto mb-4" size={40} />
              <h2 className="text-xl font-black text-center mb-6 uppercase">Admin Portal</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Username" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={loginCreds.username} onChange={e => setLoginCreds({...loginCreds, username: e.target.value})} />
                <input type="password" placeholder="Password" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={loginCreds.password} onChange={e => setLoginCreds({...loginCreds, password: e.target.value})} />
                <button className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">VERIFIKASI</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-0 md:pl-64 text-slate-900 flex flex-col font-sans">
      <nav className="print:hidden fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:flex-col md:border-r z-40 flex md:p-6 justify-around p-2">
        <div className="hidden md:block mb-10 text-center">
          <h1 className="text-2xl font-black text-blue-700">E-MANEKAT</h1>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Family Finance</p>
        </div>
        <div className="flex md:flex-col w-full md:gap-2">
          <NavItem icon={<LayoutDashboard />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<PlusCircle />} label="Input" active={activeTab === 'input'} onClick={() => setActiveTab('input')} />
          {role === 'admin' && <NavItem icon={<CheckCircle2 />} label="Konfirmasi" active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} badge={transactions.filter(t => t.status === 'waiting').length} />}
          <NavItem icon={<FileText />} label="Laporan" active={activeTab === 'report'} onClick={() => setActiveTab('report')} />
          <NavItem icon={<BookOpen />} label="Panduan" active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} />
          {role === 'admin' && <NavItem icon={<Settings />} label="Master" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
          <button onClick={() => { setRole(null); setActiveTab('dashboard'); }} className="flex flex-col md:flex-row items-center gap-1 md:gap-4 p-2 md:p-4 rounded-2xl text-rose-500 mt-auto hover:bg-rose-50">
            <LogOut size={22} /><span className="text-[10px] md:text-sm font-bold uppercase tracking-widest">Logout</span>
          </button>
        </div>
      </nav>

      <main className="p-4 md:p-8 max-w-5xl mx-auto w-full flex-grow">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Total Kas" value={stats.total} icon={<Wallet />} color="bg-blue-600" />
              <StatCard label="Total Simpanan" value={stats.simpanan} icon={<ArrowUpCircle />} color="bg-emerald-500" />
              <StatCard label="Total Pengeluaran" value={stats.pengeluaran} icon={<ArrowDownCircle />} color="bg-rose-500" />
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b bg-slate-50/50 text-center md:text-left">
                <h3 className="font-black uppercase text-xs text-slate-400 tracking-widest">Riwayat Terakhir</h3>
              </div>
              <div className="divide-y">
                {transactions.slice(0, 10).map(t => (
                  <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${t.type === 'simpanan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {t.type === 'simpanan' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-slate-700">{t.description}</p>
                          <StatusBadge status={t.status} />
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{t.date} • {t.userName}</p>
                      </div>
                    </div>
                    <p className={`font-black text-sm ${t.type === 'simpanan' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'simpanan' ? '+' : '-'} {t.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <h3 className="text-xl font-black mb-6 flex items-center gap-2"><PlusCircle className="text-blue-600" /> Tambah Transaksi</h3>
            <form onSubmit={handleSaveTransaction} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <TypeButton active={formData.type === 'simpanan'} onClick={() => setFormData({...formData, type: 'simpanan'})} label="Simpanan" color="emerald" icon={<ArrowUpCircle />} />
                <TypeButton active={formData.type === 'pengeluaran'} onClick={() => setFormData({...formData, type: 'pengeluaran'})} label="Pengeluaran" color="rose" icon={<ArrowDownCircle />} />
              </div>

              {formData.type === 'simpanan' && (
                <div className="bg-emerald-50 p-4 rounded-2xl flex items-center gap-3 border border-emerald-100">
                  <Info size={20} className="text-emerald-600" />
                  <p className="text-xs font-bold text-emerald-700">Minimal simpanan saat ini: <span className="font-black">Rp {masterData.minTransfer.toLocaleString()}</span></p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Nama Anggota *</label>
                  <select required value={formData.member} onChange={e => setFormData({...formData, member: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold">
                    <option value="">-- Pilih Nama --</option>
                    {masterData.familyMembers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Bukti Transaksi *</label>
                  <div onClick={() => fileInputRef.current.click()} className="h-[58px] border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer hover:bg-slate-50">
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                    {formData.proofImage ? <span className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-2"><CheckCircle2 size={16}/> Terlampir</span> : <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Upload size={16}/> Upload Bukti</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Nominal (Rp) *</label>
                  <input type="number" required placeholder="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-2xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Kategori *</label>
                  <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold">
                    <option value="">-- Pilih Kategori --</option>
                    {masterData.categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <textarea required placeholder="Keterangan..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl min-h-[100px]" />
              <button disabled={isSubmitting} className="w-full bg-blue-600 text-white font-black p-5 rounded-2xl shadow-xl flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "KIRIM PENGAJUAN"}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-6">
            <div className="print:hidden bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Calendar size={12}/> Dari</label>
                <input type="date" value={reportFilters.startDate} onChange={e => setReportFilters({...reportFilters, startDate: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Calendar size={12}/> Sampai</label>
                <input type="date" value={reportFilters.endDate} onChange={e => setReportFilters({...reportFilters, endDate: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Users size={12}/> Anggota</label>
                <select value={reportFilters.member} onChange={e => setReportFilters({...reportFilters, member: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs">
                  <option value="">Semua Anggota</option>
                  {masterData.familyMembers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Filter size={12}/> Tipe</label>
                <select value={reportFilters.type} onChange={e => setReportFilters({...reportFilters, type: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs">
                  <option value="">Semua Tipe</option>
                  <option value="simpanan">Simpanan</option>
                  <option value="pengeluaran">Pengeluaran</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm printable-area">
              {/* Header laporan saat dicetak */}
              <div className="hidden print:block p-8 border-b text-center">
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Laporan Kas E-Manekat</h1>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Sistem Keuangan Keluarga Terintegrasi</p>
                <div className="flex justify-center gap-4 mt-4 text-[10px] font-bold text-slate-500 uppercase">
                  <span>Periode: {reportFilters.startDate || 'Semua'} s/d {reportFilters.endDate || 'Sekarang'}</span>
                  <span>Anggota: {reportFilters.member || 'Semua'}</span>
                </div>
              </div>

              <div className="p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30 print:hidden">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">Pratinjau Laporan</h3>
                </div>
                <div className="flex gap-2">
                  <button onClick={shareToWhatsApp} className="flex items-center gap-2 bg-emerald-600 p-3 px-5 rounded-xl text-xs font-black text-white">
                    <Share2 size={16} /> WA
                  </button>
                  <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 p-3 px-5 rounded-xl text-xs font-black text-white shadow-lg shadow-blue-100">
                    <Printer size={16} /> CETAK LAPORAN
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                    <tr>
                      <th className="p-5 border-b">Tanggal</th>
                      <th className="p-5 border-b">Nama</th>
                      <th className="p-5 border-b">Keterangan</th>
                      <th className="p-5 border-b text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-600">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-10 text-center text-slate-400 font-bold italic text-sm">Tidak ada data transaksi ditemukan</td>
                      </tr>
                    ) : (
                      filteredTransactions.map(t => (
                        <tr key={t.id} className="text-sm">
                          <td className="p-5 font-bold opacity-60">{t.date}</td>
                          <td className="p-5 font-bold text-slate-800">{t.userName}</td>
                          <td className="p-5">
                            <p className="font-bold text-slate-700">{t.description}</p>
                            <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded font-black text-slate-500 uppercase">{t.category}</span>
                          </td>
                          <td className={`p-5 text-right font-black ${t.type === 'simpanan' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === 'simpanan' ? '+' : '-'} {t.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {/* Footer Tabel yang Tetap Tampil Saat Print */}
                  <tfoot className="bg-slate-50 font-black text-slate-800 print:bg-slate-50">
                    <tr>
                      <td colSpan="3" className="p-5 text-right uppercase text-[9px] tracking-widest text-slate-400">Total Filter</td>
                      <td className="p-5 text-right text-lg print:text-xl border-t border-slate-200">Rp {filteredStats.diff.toLocaleString()}</td>
                    </tr>
                    <tr className="hidden print:table-row">
                        <td colSpan="4" className="p-5 text-center text-[8px] text-slate-400 border-t">
                            Dicetak pada: {new Date().toLocaleString('id-ID')} • E-Manekat Pro
                        </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h2 className="text-3xl font-black text-slate-800 mb-6 flex items-center gap-3">
                <BookOpen size={32} className="text-blue-600" /> Panduan Penggunaan
              </h2>
              
              <div className="space-y-8">
                <GuideSection 
                  title="1. Persiapan Awal (Role Admin)"
                  items={[
                    "Login Admin: Gunakan username admin dan password khusus.",
                    "Set Nama Anggota: Tambahkan siapa saja yang akan ikut menyetor.",
                    "Set Minimal Simpanan: Atur batas bawah nominal setoran keluarga.",
                    "Set Kategori: Klasifikasikan pengeluaran keluarga (misal: Sembako)."
                  ]}
                  icon={<ShieldCheck className="text-blue-600" />}
                />

                <GuideSection 
                  title="2. Cara Input Transaksi (Anggota)"
                  items={[
                    "Pilih Tipe: Tentukan apakah menabung (Simpanan) atau belanja (Pengeluaran).",
                    "Input Data: Masukkan nominal dan pilih kategori yang sesuai.",
                    "Upload Bukti: Lampirkan foto struk/screenshot transfer (Wajib).",
                    "Kirim: Tunggu status 'Proses' diverifikasi oleh Admin."
                  ]}
                  icon={<UserCircle className="text-emerald-600" />}
                />

                <GuideSection 
                  title="3. Verifikasi & Approval (Admin)"
                  items={[
                    "Cek Notifikasi: Lihat badge merah pada menu Konfirmasi.",
                    "Review Bukti: Pastikan foto bukti sesuai dengan nominal yang diinput.",
                    "Approval: Klik 'Setujui' untuk memperbarui saldo kas keluarga secara otomatis."
                  ]}
                  icon={<CheckCircle2 className="text-blue-600" />}
                />

                <GuideSection 
                  title="4. Laporan & Keamanan"
                  items={[
                    "WhatsApp: Bagikan ringkasan saldo langsung ke grup keluarga.",
                    "Filter: Pantau pengeluaran per orang atau per kategori.",
                    "Keamanan: Jangan lupa Logout jika menggunakan perangkat bersama."
                  ]}
                  icon={<ShieldCheck className="text-slate-600" />}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'approval' && role === 'admin' && (
          <div className="space-y-4">
            <h3 className="text-xl font-black mb-6 uppercase">Konfirmasi Transaksi</h3>
            {transactions.filter(t => t.status === 'waiting').length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-dashed text-center">
                <CheckCircle2 size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="font-bold text-slate-400 uppercase text-xs tracking-widest">Tidak ada pengajuan baru</p>
              </div>
            ) : (
              transactions.filter(t => t.status === 'waiting').map(t => (
                <div key={t.id} className="bg-white p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${t.type === 'simpanan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {t.type === 'simpanan' ? <ArrowUpCircle size={32}/> : <ArrowDownCircle size={32}/>}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-700">{t.description}</h4>
                      <p className="text-xs text-slate-500 font-bold uppercase">{t.userName} • Rp {t.amount.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {t.proofImage && <button onClick={() => setViewImage(t.proofImage)} className="p-3 px-6 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 flex items-center gap-2"><Eye size={16}/> Bukti</button>}
                    <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id), { status: 'rejected' })} className="p-3 px-6 bg-slate-100 text-slate-500 font-bold rounded-xl">Tolak</button>
                    <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id), { status: 'approved' })} className="p-3 px-6 bg-emerald-600 text-white font-bold rounded-xl shadow-lg">Setujui</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'settings' && role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-xs text-slate-400 mb-6 tracking-widest uppercase flex items-center gap-2"><Coins size={14}/> Pengaturan Kas</h3>
              <div className="flex flex-col md:flex-row items-end gap-4">
                <div className="flex-1 space-y-1 w-full">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Batas Minimal Input Simpanan (Rp)</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 p-4 rounded-2xl outline-none font-black text-xl border border-slate-100" 
                    defaultValue={masterData.minTransfer}
                    onBlur={(e) => {
                      if (e.target.value && Number(e.target.value) !== masterData.minTransfer) {
                        updateMaster('minTransfer', Number(e.target.value), 'set');
                      }
                    }}
                  />
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl w-full md:w-auto">
                   <p className="text-[10px] font-bold text-blue-600 leading-tight">Perubahan akan langsung berlaku bagi semua anggota keluarga.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="font-black text-xs text-slate-400 mb-6 tracking-widest uppercase flex items-center gap-2"><Tag size={14}/> Master Kategori</h3>
                <div className="flex gap-2 mb-6">
                  <input id="cat-in" type="text" className="flex-1 bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm" placeholder="Kategori Baru..." />
                  <button onClick={() => { const el = document.getElementById('cat-in'); if (el.value) { updateMaster('categories', el.value); el.value = ''; } }} className="bg-blue-600 text-white p-4 rounded-2xl"><Plus size={20}/></button>
                </div>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar text-sm">
                  {masterData.categories.map(c => <div key={c} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl font-bold text-slate-700">{c} <button onClick={() => updateMaster('categories', c, 'remove')} className="text-slate-300 hover:text-rose-500"><Trash2 size={18}/></button></div>)}
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="font-black text-xs text-slate-400 mb-6 tracking-widest uppercase flex items-center gap-2"><Users size={14}/> Anggota Keluarga</h3>
                <div className="flex gap-2 mb-6">
                  <input id="mem-in" type="text" className="flex-1 bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm" placeholder="Nama Baru..." />
                  <button onClick={() => { const el = document.getElementById('mem-in'); if (el.value) { updateMaster('familyMembers', el.value); el.value = ''; } }} className="bg-emerald-600 text-white p-4 rounded-2xl"><Plus size={20}/></button>
                </div>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar text-sm">
                  {masterData.familyMembers.map(m => <div key={m} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl font-bold text-slate-700">{m} <button onClick={() => updateMaster('familyMembers', m, 'remove')} className="text-slate-300 hover:text-rose-500"><Trash2 size={18}/></button></div>)}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {viewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <div className="max-w-xl w-full bg-white rounded-3xl overflow-hidden relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewImage(null)} className="absolute top-4 right-4 p-3 bg-black/50 text-white rounded-full z-10"><X size={24}/></button>
            <img src={viewImage} className="w-full h-auto max-h-[75vh] object-contain p-2 rounded-2xl" alt="Proof" />
            <div className="p-4 bg-white border-t text-center font-bold text-slate-500 text-sm">Bukti Transaksi Terlampir</div>
          </div>
        </div>
      )}

      <style>{`
        @media print { 
          /* Sembunyikan semua elemen UI kecuali konten laporan */
          nav, button, footer, .print\\:hidden, .LucideIcon { display: none !important; } 
          body { background: white !important; margin: 0 !important; color: black !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; } 
          .md\\:pl-64 { padding-left: 0 !important; }
          .printable-area { border: none !important; shadow: none !important; margin: 0 !important; width: 100% !important; }
          
          /* Pastikan footer tabel tetap terlihat di setiap halaman (opsional) */
          tfoot { display: table-footer-group; }
          thead { display: table-header-group; }
          
          /* Hilangkan warna background yang tidak perlu agar hemat tinta */
          .bg-slate-50 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
          .bg-blue-600, .bg-emerald-600 { color: black !important; background: transparent !important; border: 1px solid #ddd !important; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

// NavItem Component
const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`relative flex flex-col md:flex-row items-center gap-1 md:gap-4 p-2 md:p-4 md:w-full rounded-2xl transition-all ${active ? 'text-blue-600 md:bg-blue-50 font-black' : 'text-slate-400 hover:text-slate-600'}`}>
    {React.cloneElement(icon, { size: 22 })}
    <span className="text-[10px] md:text-sm uppercase tracking-tight">{label}</span>
    {badge > 0 && <span className="absolute top-1 right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">{badge}</span>}
  </button>
);

// StatCard Component
const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-4 shadow-sm">
    <div className={`p-4 rounded-2xl ${color} text-white shadow-lg`}>{icon}</div>
    <div className="overflow-hidden">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
      <h2 className="text-xl font-black text-slate-800 tracking-tighter truncate">Rp {value.toLocaleString()}</h2>
    </div>
  </div>
);

// Guide Section Component
const GuideSection = ({ title, items, icon }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
      <h4 className="font-black text-slate-700">{title}</h4>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-12">
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white transition-colors">
          <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5">{i+1}</div>
          <p className="text-sm font-medium text-slate-600 leading-relaxed">{item}</p>
        </div>
      ))}
    </div>
  </div>
);

// StatusBadge Component
const StatusBadge = ({ status }) => {
  const configs = {
    waiting: { color: 'bg-amber-100 text-amber-700', label: 'Proses' },
    approved: { color: 'bg-emerald-100 text-emerald-700', label: 'Sah' },
    rejected: { color: 'bg-rose-100 text-rose-700', label: 'Batal' }
  };
  const config = configs[status] || configs.waiting;
  return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${config.color}`}>{config.label}</span>;
};

// TypeButton Component
const TypeButton = ({ active, onClick, label, color, icon }) => (
  <button type="button" onClick={onClick} className={`w-full p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${active ? `border-${color}-500 bg-${color}-50 text-${color}-600` : 'border-slate-100 bg-slate-50 text-slate-300'}`}>
    {icon}
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default App;
