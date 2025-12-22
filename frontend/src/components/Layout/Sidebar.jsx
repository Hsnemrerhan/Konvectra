import { FaCompass, FaPlus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ 
  myServers, 
  activeServer, 
  setShowCreateModal, 
  setShowJoinModal 
}) => {
  const navigate = useNavigate();

  // YARDIMCI FONKSİYON: İsim Kısaltma Mantığı 🧠
  const getInitials = (name) => {
    if (!name) return "?";
    
    // Kelimelere ayır (Boşluklara göre)
    const words = name.trim().split(/\s+/);
    
    // Eğer 2 veya daha fazla kelime varsa -> İlk 2 kelimenin baş harfleri (Örn: "Oyun Sunucusu" -> "OS")
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    
    // Eğer tek kelimeyse -> Kelimenin ilk 2 harfi (Örn: "Discord" -> "DI")
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="w-[72px] bg-[#08080bff] flex flex-col items-center py-3 gap-2 overflow-y-auto no-scrollbar z-20 flex-shrink-0">
      
      {/* ANA SAYFA BUTONU (@me) */}
      <div 
        onClick={() => navigate('/servers/@me')} 
        className={`w-12 h-12 flex items-center justify-center cursor-pointer transition-all overflow-hidden
        ${!activeServer ? 'bg-[#5865F2] rounded-[16px]' : 'bg-[#1A1A1E] hover:bg-[#5865F2] rounded-[24px] hover:rounded-[16px]'}`}
      >
        <FaCompass size={28} className="text-white" />
      </div>
      
      <hr className="w-8 border-[#35363c] rounded-full mx-auto" />
      
      {/* SUNUCULAR */}
      {myServers.map(server => (
        <div 
          key={server._id}
          onClick={() => navigate(`/servers/${server._id}`)} 
          className="group relative flex items-center justify-center w-full"
        >
            {/* Sol Taraftaki Beyaz Çentik (Aktiflik Göstergesi) */}
            <div className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200
                ${activeServer?._id === server._id ? 'h-10' : 'h-2 scale-0 group-hover:scale-100'}`} 
            />

            {/* Sunucu İkonu Kutusu */}
            <div 
              className={`w-12 h-12 flex items-center justify-center font-bold text-sm text-white cursor-pointer transition-all overflow-hidden
              ${activeServer?._id === server._id ? 'bg-[#5865F2] rounded-[16px]' : 'bg-[#313338] hover:bg-[#5865F2] rounded-[24px] hover:rounded-[16px]'}`}
              title={server.name}
            >
              {server.icon ? (
                  // RESİM VARSA
                  <img 
                    src={server.icon} 
                    alt={server.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display='none'; }} // Resim yüklenemezse gizle (arkadaki yazı görünür olsun diyeceğiz ama burada parent bg var, o yüzden fallback mantığı karışık olabilir. Basitçe kırık resim yerine hiçbir şey göstermesin)
                  />
              ) : (
                  // RESİM YOKSA -> HARFLER
                  <span>{getInitials(server.name)}</span>
              )}
            </div>
        </div>
      ))}

      {/* EKLEME BUTONLARI */}
      <div onClick={() => setShowCreateModal(true)} className="w-12 h-12 bg-[#1A1A1E] hover:bg-[#23a559] rounded-[24px] hover:rounded-[16px] flex items-center justify-center text-[#23a559] hover:text-white cursor-pointer transition-all group overflow-hidden">
        <FaPlus size={20} className="group-hover:rotate-90 transition-transform" />
      </div>
      
      <div onClick={() => setShowJoinModal(true)} className="w-12 h-12 bg-[#1A1A1E] hover:bg-[#23a559] rounded-[24px] hover:rounded-[16px] flex items-center justify-center text-[#23a559] hover:text-white cursor-pointer transition-all mt-1 overflow-hidden" title="Sunucuya Katıl">
        <FaCompass size={20} />
      </div>
    </div>
  );
};

export default Sidebar;