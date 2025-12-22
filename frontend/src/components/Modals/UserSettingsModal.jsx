import { useState, useRef } from 'react';
import { FaTimes, FaCamera, FaKey, FaCircle, FaUpload } from 'react-icons/fa';
import ImageCropper from './ImageCropper'; // Kırpma bileşenini import ettik

const UserSettingsModal = ({ currentUser, onClose, onUpdate, onLogout }) => {
  // Form State'leri
  const [nickname, setNickname] = useState(currentUser.nickname || '');
  const [status, setStatus] = useState(currentUser.status || 'online');
  
  // AVATAR SİSTEMİ İÇİN YENİ STATE'LER
  const [previewAvatar, setPreviewAvatar] = useState(currentUser.avatar || ''); // Ekranda görünen
  const [selectedFileSrc, setSelectedFileSrc] = useState(null); // Kırpılacak ham resim
  const [showCropper, setShowCropper] = useState(false);        // Kırpma ekranı açık mı?
  const [croppedBlob, setCroppedBlob] = useState(null);         // Yüklenecek dosya

  const fileInputRef = useRef(null);

  // Şifre State'leri
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // UI State
  const [activeTab, setActiveTab] = useState('account'); 

  // --- DOSYA SEÇME VE KIRPMA İŞLEMLERİ ---

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setSelectedFileSrc(reader.result);
        setShowCropper(true); // Dosya seçilince kırpıcıyı aç
      });
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (blob) => {
    setCroppedBlob(blob);
    setShowCropper(false);
    setPreviewAvatar(URL.createObjectURL(blob)); // Anlık önizleme
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setSelectedFileSrc(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  // Rastgele avatar (Mevcut özelliği koruduk)
  const getRandomAvatar = () => {
    const randomId = Math.floor(Math.random() * 1000);
    const url = `https://i.pravatar.cc/150?img=${randomId}`;
    setPreviewAvatar(url);
    setCroppedBlob(null); // Rastgele seçtiyse dosya yüklemesini iptal et
  };

  // --- KAYDETME İŞLEMİ ---
  const handleSave = async () => {
    let finalAvatarUrl = previewAvatar;

    // 1. Eğer yeni bir dosya kırpıldıysa önce onu yükle
    if (croppedBlob) {
        const formData = new FormData();
        formData.append('avatar', croppedBlob, 'avatar.jpg');

        try {
            const API_URL = `http://${window.location.hostname}:5000`;
            const res = await fetch(`${API_URL}/api/users/${currentUser.id}/avatar`, {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error("Avatar yüklenemedi");
            const data = await res.json();
            finalAvatarUrl = data.avatar; // Bulut URL'ini al
        } catch (error) {
            alert("Hata: " + error.message);
            return;
        }
    }

    // 2. Diğer güncellemeleri hazırla
    const updates = { nickname, avatar: finalAvatarUrl, status };
    
    // Şifre alanı doluysa ekle
    if (newPassword) {
        if(!currentPassword) return alert("Şifre değiştirmek için mevcut şifreni girmelisin!");
        updates.currentPassword = currentPassword;
        updates.newPassword = newPassword;
    }

    onUpdate(updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#36393f] w-[800px] h-[600px] rounded-lg flex overflow-hidden shadow-2xl relative">
        
        {/* SOL MENÜ (AYNEN KALDI) */}
        <div className="w-60 bg-[#121214] p-4 flex flex-col gap-1">
          <div className="text-xs font-bold text-gray-400 uppercase mb-2 px-2">KULLANICI AYARLARI</div>
          
          <div onClick={() => setActiveTab('account')} className={`px-2 py-1.5 rounded cursor-pointer font-medium ${activeTab === 'account' ? 'bg-[#1A1A1E] text-white' : 'text-gray-400 hover:bg-[#1A1A1E]/50 hover:text-gray-200'}`}>
            Hesabım
          </div>
          <div onClick={() => setActiveTab('security')} className={`px-2 py-1.5 rounded cursor-pointer font-medium ${activeTab === 'security' ? 'bg-[#1A1A1E] text-white' : 'text-gray-400 hover:bg-[#1A1A1E]/50 hover:text-gray-200'}`}>
            Güvenlik
          </div>
          <div className="flex-1"></div>
          <div onClick={() => { onClose(); onLogout(); }} className="px-2 py-1.5 rounded cursor-pointer font-medium text-red-400 hover:bg-[#1A1A1E]">
            Çıkış Yap
          </div>
        </div>

        {/* SAĞ İÇERİK */}
        <div className="flex-1 p-10 overflow-y-auto bg-[#1A1A1E] relative">
            
            {/* KAPAT BUTONU */}
            <div className="absolute top-4 right-4 flex flex-col items-center cursor-pointer group" onClick={onClose}>
                <div className="w-9 h-9 border-2 border-gray-400 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-gray-400 group-hover:text-black transition">
                    <FaTimes size={18} />
                </div>
                <span className="text-xs text-gray-400 mt-1 font-bold group-hover:text-white">ESC</span>
            </div>

            {/* --- SEKME 1: HESABIM --- */}
            {activeTab === 'account' && (
                <div className="animate-fade-in">
                    <h2 className="text-xl font-bold text-white mb-6">Hesabım</h2>
                    
                    {/* Profil Kartı (Revize Edildi) */}
                    <div className="bg-[#121214] rounded-lg p-4 flex items-center gap-6 mb-8">
                        
                        {/* Avatar Kısmı (Dosya Yükleme Entegreli) */}
                        <div className="relative group cursor-pointer">
                            <div className="w-24 h-24 rounded-full border-4 border-[#121214] overflow-hidden bg-gray-600">
                                <img src={previewAvatar} className="w-full h-full object-cover" />
                            </div>
                            
                            {/* Hover Overlay: Dosya Seç */}
                            <div 
                                onClick={() => fileInputRef.current.click()} 
                                className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition z-10"
                            >
                                <FaUpload className="text-white mb-1"/>
                                <span className="text-[10px] text-white font-bold text-center uppercase">DEĞİŞTİR</span>
                            </div>

                            {/* Gizli Input */}
                            <input 
                                type="file" 
                                accept="image/*" 
                                ref={fileInputRef} 
                                onChange={handleFileSelect} 
                                className="hidden"
                            />

                            {/* Durum Göstergesi */}
                            <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-4 border-[#202225] z-20
                                ${status === 'online' ? 'bg-green-500' : status === 'dnd' ? 'bg-red-500' : status === 'idle' ? 'bg-yellow-500' : 'bg-gray-500'}`}>
                            </div>
                        </div>

                        <div className="flex-1">
                            <div className="text-xl font-bold text-white">{currentUser.username}</div>
                            <div className="text-gray-400 text-sm">#{currentUser.friendCode}</div>
                        </div>
                        
                        <button onClick={handleSave} className="bg-[#248046] hover:bg-[#1a6334] px-6 py-2 rounded text-white font-bold text-sm transition">
                            Değişiklikleri Kaydet
                        </button>
                    </div>

                    {/* Form Alanları */}
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">GÖRÜNEN AD (NICKNAME)</label>
                            <input 
                                value={nickname}
                                onChange={e => setNickname(e.target.value)}
                                className="w-full bg-[#121214] p-3 rounded text-white outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        {/* URL INPUTU KALDIRILDI, YERİNE BUTONLAR GELDİ */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">AVATAR SEÇENEKLERİ</label>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => fileInputRef.current.click()}
                                    className="bg-[#5865F2] hover:bg-[#4752c4] text-white px-4 py-2 rounded text-sm font-medium transition"
                                >
                                    Resim Yükle
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">DURUM</label>
                            <div className="flex gap-4">
                                <div onClick={()=>setStatus('online')} className={`flex items-center gap-2 cursor-pointer p-2 rounded ${status==='online' ? 'bg-[#121214]' : ''}`}>
                                    <FaCircle className="text-green-500" size={12}/> <span className="text-gray-200 text-sm">Çevrimiçi</span>
                                </div>
                                <div onClick={()=>setStatus('idle')} className={`flex items-center gap-2 cursor-pointer p-2 rounded ${status==='idle' ? 'bg-[#121214]' : ''}`}>
                                    <FaCircle className="text-yellow-500" size={12}/> <span className="text-gray-200 text-sm">Boşta</span>
                                </div>
                                <div onClick={()=>setStatus('dnd')} className={`flex items-center gap-2 cursor-pointer p-2 rounded ${status==='dnd' ? 'bg-[#121214]' : ''}`}>
                                    <FaCircle className="text-red-500" size={12}/> <span className="text-gray-200 text-sm">Rahatsız Etmeyin</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SEKME 2: GÜVENLİK (AYNEN KALDI) --- */}
            {activeTab === 'security' && (
                <div className="animate-fade-in">
                    <h2 className="text-xl font-bold text-white mb-6">Şifre Değiştir</h2>
                    <div className="space-y-4">
                        <div className="bg-[#1A1A1E] p-4 rounded border border-yellow-600/50">
                            <p className="text-yellow-500 text-sm flex items-center gap-2"><FaKey /> Şifreni değiştirdikten sonra tekrar giriş yapman gerekebilir.</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">MEVCUT ŞİFRE</label>
                            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-[#121214] p-3 rounded text-white outline-none focus:ring-1 focus:ring-yellow-600"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">YENİ ŞİFRE</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-[#121214] p-3 rounded text-white outline-none focus:ring-1 focus:ring-green-500"/>
                        </div>
                        <button onClick={handleSave} disabled={!currentPassword || !newPassword} className="bg-green-600 px-6 py-2 rounded text-white font-bold text-sm hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed">Şifreyi Güncelle</button>
                    </div>
                </div>
            )}

        </div>
      </div>

      {/* --- KIRPMA MODALI (EN ÜST KATMAN) --- */}
      {showCropper && selectedFileSrc && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[60]">
            <div className="bg-[#313338] p-6 rounded-lg w-full max-w-lg shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6 text-center">Resmi Düzenle</h3>
                <ImageCropper 
                    imageSrc={selectedFileSrc}
                    onCropComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            </div>
        </div>
      )}

    </div>
  );
};

export default UserSettingsModal;