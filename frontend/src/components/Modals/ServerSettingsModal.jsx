import { useState, useRef } from 'react';
import { FaTimes, FaTrash, FaCrown, FaPlus, FaUpload } from 'react-icons/fa';
import ImageCropper from './ImageCropper'; // Kırpma bileşeni

const ServerSettingsModal = ({ server, currentUser, onClose, onUpdateServer, onKickMember, onAssignRole, onCreateRole, onDeleteRole }) => {
  const [activeTab, setActiveTab] = useState('overview'); 
  
  const isOwner = currentUser.id === server.owner;

  // Form States
  const [serverName, setServerName] = useState(server.name);
  
  // --- RESİM YÜKLEME STATE'LERİ ---
  const [previewIcon, setPreviewIcon] = useState(server.icon || ''); // Ekranda görünen
  const [selectedFileSrc, setSelectedFileSrc] = useState(null); // Kırpılacak ham resim
  const [showCropper, setShowCropper] = useState(false);        // Kırpma ekranı açık mı?
  const [croppedBlob, setCroppedBlob] = useState(null);         // Yüklenecek dosya

  const fileInputRef = useRef(null);
  
  // Role States
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#99aab5');

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
    setPreviewIcon(URL.createObjectURL(blob)); // Anlık önizleme
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setSelectedFileSrc(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- KAYDETME ---
  const handleSaveOverview = async () => {
    if (!isOwner) return;

    let finalIconUrl = previewIcon;

    // 1. Eğer yeni bir resim seçildiyse (Blob varsa) Yükle
    if (croppedBlob) {
        // Sunucu ikonu için özel bir endpoint veya genel upload kullanabiliriz.
        // Şimdilik "Sunucu İkonu Yükleme" mantığını simüle eden bir yapı kuralım.
        // NOT: Backend'de sunucu ikonları için ayrı bir rota olması daha temizdir ama
        // hızlı çözüm için User Avatar rotası gibi bir rota kullanacağız veya genel upload.
        
        // BACKEND'E EKLENMESİ GEREKEN ROTA: /api/servers/:serverId/icon
        // (Bunu backend tarafında halletmemiz gerekecek, şimdilik frontend mantığını kuruyorum)
        
        const formData = new FormData();
        formData.append('icon', croppedBlob, 'icon.jpg');

        try {
            const API_URL = `http://${window.location.hostname}:5000`;
            // DİKKAT: Bu rota Backend'de olmalı. (Aşağıda backend kodunu da vereceğim)
            const res = await fetch(`${API_URL}/api/servers/${server._id}/icon`, {
                method: 'POST',
                body: formData
            });
            
            if (!res.ok) throw new Error("İkon yüklenemedi");
            const data = await res.json();
            finalIconUrl = data.icon; // Bulut URL'ini al

        } catch (error) {
            alert("Resim yükleme hatası: " + error.message);
            return;
        }
    }

    // 2. Sunucu bilgilerini güncelle (İsim ve URL)
    // Eğer resim değişmediyse eski URL gider, değiştiyse yeni Cloud URL gider.
    onUpdateServer(server._id, { name: serverName, icon: finalIconUrl });
  };

  const handleCreateRole = () => {
    if (!newRoleName.trim()) return;
    onCreateRole(server._id, newRoleName, newRoleColor);
    setNewRoleName('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#313338] w-[800px] h-[600px] rounded-lg flex overflow-hidden shadow-2xl relative">
        
        {/* SOL MENÜ (AYNI) */}
        <div className="w-60 bg-[#121214] p-4 flex flex-col gap-1 text-right">
          <div className="text-xs font-bold text-gray-400 uppercase mb-2 px-2 text-left">SUNUCU AYARLARI</div>
          
          <div onClick={() => setActiveTab('overview')} className={`px-2 py-1.5 rounded cursor-pointer font-medium text-left ${activeTab === 'overview' ? 'bg-[#1A1A1E] text-white' : 'text-gray-400 hover:bg-[#1A1A1E] hover:text-gray-200'}`}>
            Genel Görünüm
          </div>
          <div onClick={() => setActiveTab('roles')} className={`px-2 py-1.5 rounded cursor-pointer font-medium text-left ${activeTab === 'roles' ? 'bg-[#1A1A1E] text-white' : 'text-gray-400 hover:bg-[#1A1A1E] hover:text-gray-200'}`}>
            Roller
          </div>
          <div onClick={() => setActiveTab('members')} className={`px-2 py-1.5 rounded cursor-pointer font-medium text-left ${activeTab === 'members' ? 'bg-[#1A1A1E] text-white' : 'text-gray-400 hover:bg-[#1A1A1E] hover:text-gray-200'}`}>
            Üyeler ({server.members.length})
          </div>

          <div className="flex-1"></div>
          <div className="text-xs text-gray-500 px-2 mt-4 text-left">
             {isOwner ? "👑 Sunucu Sahibisin" : "👀 İzleme Modu"}
          </div>
        </div>

        {/* SAĞ İÇERİK */}
        <div className="flex-1 p-10 overflow-y-auto bg-[#1A1A1E] relative custom-scrollbar">
            
            {/* KAPAT BUTONU */}
            <div className="absolute top-4 right-4 flex flex-col items-center cursor-pointer group" onClick={onClose}>
                <div className="w-8 h-8 rounded-full border-2 border-gray-400 flex items-center justify-center text-gray-400 group-hover:bg-gray-400 group-hover:text-black transition">
                    <FaTimes />
                </div>
                <span className="text-[10px] text-gray-400 font-bold mt-1 group-hover:text-white">ESC</span>
            </div>

            {/* --- SEKME 1: GENEL GÖRÜNÜM (GÜNCELLENDİ) --- */}
            {activeTab === 'overview' && (
                <div className="animate-fade-in">
                    <h2 className="text-xl font-bold text-white mb-6">Genel Görünüm</h2>
                    <div className="flex gap-8">
                        
                        {/* 1. İKON YÜKLEME ALANI */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="relative group cursor-pointer w-24 h-24">
                                <div className="w-full h-full rounded-full bg-[#1e1f22] overflow-hidden border-4 border-[#1e1f22] shadow-lg flex items-center justify-center">
                                    {previewIcon ? (
                                        <img src={previewIcon} className="w-full h-full object-cover"/>
                                    ) : (
                                        <div className="text-gray-500 text-2xl font-bold">{serverName.substring(0,2)}</div>
                                    )}
                                </div>
                                
                                {/* Hover Overlay */}
                                {isOwner && (
                                    <div 
                                        onClick={() => fileInputRef.current.click()}
                                        className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <span className="text-[10px] font-bold text-white uppercase text-center leading-3">İkonu<br/>Değiştir</span>
                                        <FaUpload className="text-white mt-1" size={12}/>
                                    </div>
                                )}

                                {/* Gizli Input */}
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    ref={fileInputRef} 
                                    onChange={handleFileSelect} 
                                    className="hidden"
                                />
                            </div>
                            <span className="text-xs text-gray-400">Sunucu İkonu</span>
                            
                            {/* İkonu Kaldır Butonu */}
                            {isOwner && previewIcon && (
                                <button 
                                    onClick={() => { setPreviewIcon(''); setCroppedBlob(null); }}
                                    className="text-xs text-red-400 hover:underline"
                                >
                                    Kaldır
                                </button>
                            )}
                        </div>

                        {/* 2. FORM */}
                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">SUNUCU ADI</label>
                                <input 
                                    value={serverName}
                                    onChange={e => setServerName(e.target.value)}
                                    disabled={!isOwner}
                                    className="w-full bg-[#121214] p-2.5 rounded text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                            
                            {/* İpucu Metni */}
                            <div className=" p-3 rounded border border-yellow-600/50">
                                <p className="text-xs text-gray-300">
                                    Sunucu adı ve ikonu, sunucunu temsil eder. Yaratıcı ve akılda kalıcı bir şeyler seçmeni öneririz!
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {isOwner && (
                        <div className="mt-8 p-4 rounded flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Değişiklikleri kaydetmeyi unutma!</span>
                            <button onClick={handleSaveOverview} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded font-medium transition shadow-lg">Değişiklikleri Kaydet</button>
                        </div>
                    )}
                </div>
            )}

            {/* --- SEKME 2: ROLLER (AYNI) --- */}
            {activeTab === 'roles' && (
                <div className="animate-fade-in">
                    <h2 className="text-xl font-bold text-white mb-2">Roller</h2>
                    <p className="text-gray-400 text-sm mb-6">Üyelerine renk ve unvan vermek için rolleri kullan.</p>
                    {isOwner && (
                        <div className="bg-[#2b2d31] p-4 rounded mb-6 flex items-end gap-3 border border-[#1e1f22]">
                             <div className="flex-1">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">YENİ ROL ADI</label>
                                <input value={newRoleName} onChange={e=>setNewRoleName(e.target.value)} className="w-full bg-[#1e1f22] p-2 rounded text-white outline-none" placeholder="Örn: Moderatör"/>
                             </div>
                             <div className='flex-row justify-end p-0 items-center h-14'>
                                <label className="text-xs font-bold text-gray-400 uppercase block">RENK</label>
                                <input type="color" value={newRoleColor} onChange={e=>setNewRoleColor(e.target.value)} className="h-10 w-12 bg-transparent cursor-pointer rounded"/>
                             </div>
                             <button onClick={handleCreateRole} className="bg-[#5865F2] hover:bg-[#4752c4] text-white px-4 h-10 rounded font-bold flex items-center gap-2"><FaPlus/> Oluştur</button>
                        </div>
                    )}
                    <div className="space-y-2">
                        {server.roles && server.roles.map(role => (
                            <div key={role._id} className="flex items-center justify-between bg-[#2b2d31] p-3 rounded hover:bg-[#35373c] group transition">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: role.color}}></div>
                                    <span className="text-gray-200 font-medium">{role.name}</span>
                                </div>
                                {isOwner && (
                                    <div onClick={() => onDeleteRole(server._id, role._id)} className="text-gray-500 hover:text-red-400 cursor-pointer p-1.5 hidden group-hover:block transition" title="Rolü Sil">
                                        <FaTrash size={14} />
                                    </div>
                                )}
                            </div>
                        ))}
                        {server.roles.length === 0 && <div className="text-gray-500 italic text-sm">Hiç rol yok.</div>}
                    </div>
                </div>
            )}

            {/* --- SEKME 3: ÜYELER (AYNI) --- */}
            {activeTab === 'members' && (
                <div className="animate-fade-in">
                    <h2 className="text-xl font-bold text-white mb-6">Üyeler</h2>
                    <div className="space-y-1">
                        {server.members.map(member => (
                            <div key={member.user._id} className="flex items-center justify-between p-2 hover:bg-[#2b2d31] rounded group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-600 overflow-hidden">
                                        <img src={member.user.avatar} className="w-full h-full object-cover"/>
                                    </div>
                                    <div>
                                        <div className="text-white font-medium flex items-center gap-2">
                                            {member.user.nickname || member.user.username}
                                            {server.owner === member.user._id && <FaCrown className="text-yellow-500" title="Sunucu Sahibi"/>}
                                        </div>
                                        <div className="text-xs text-gray-400">#{member.user.friendCode}</div>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                        {member.roles && member.roles.map(roleId => {
                                            const role = server.roles.find(r => r._id === roleId);
                                            if(!role) return null;
                                            return <span key={roleId} className="text-[10px] px-1.5 rounded text-white flex items-center" style={{backgroundColor: role.color}}>{role.name}</span>
                                        })}
                                    </div>
                                </div>
                                {isOwner && (
                                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <select className="bg-[#1e1f22] text-xs text-gray-300 p-1 rounded outline-none cursor-pointer" onChange={(e) => { if(e.target.value) { onAssignRole(server._id, member.user._id, e.target.value); e.target.value = ""; } }}>
                                            <option value="">+ Rol Ver/Al</option>
                                            {server.roles.map(r => (<option key={r._id} value={r._id}>{r.name}</option>))}
                                        </select>
                                        {server.owner !== member.user._id && (
                                            <div onClick={() => { if(confirm(`${member.user.username} kullanıcısını sunucudan atmak istediğine emin misin?`)) { onKickMember(server._id, member.user._id); } }} className="w-7 h-7 bg-red-500/10 hover:bg-red-500 rounded flex items-center justify-center text-red-500 hover:text-white cursor-pointer transition" title="Sunucudan At">
                                                <FaTrash size={12}/>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
      </div>

      {/* --- KIRPMA MODALI --- */}
      {showCropper && selectedFileSrc && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[60]">
            <div className="bg-[#313338] p-6 rounded-lg w-full max-w-lg shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6 text-center">Sunucu İkonunu Düzenle</h3>
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

export default ServerSettingsModal;