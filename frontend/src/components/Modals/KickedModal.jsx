import { FaHeartBroken } from 'react-icons/fa';

const KickedModal = ({ data, onClose }) => {
  if (!data) return null;

  return (//color: #141212ff
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] animate-fade-in backdrop-blur-sm">
      <div className="bg-[#141212ff] w-[440px] rounded-lg shadow-2xl p-8 flex flex-col items-center text-center border border-red-500/30">
        
        {/* İkon */}
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <FaHeartBroken size={40} className="text-red-500" />
        </div>

        {/* Başlık */}
        <h2 className="text-2xl font-bold text-white mb-2">Sunucudan Atıldın</h2>

        {/* Açıklama */}
        <p className="text-gray-300 mb-8 leading-relaxed">
           Üzgünüz, <span className="font-bold text-white">{data.serverName}</span> sunucusuyla bağlantın kesildi.
           <br/>
           İşlemi yapan yetkili: <span className="text-red-400 font-bold">{data.kickerName}</span>
        </p>

        {/* Buton */}
        <button 
          onClick={onClose}
          className="bg-red-600 hover:bg-red-700 text-white px-10 py-2.5 rounded transition w-full font-medium"
        >
          Tamam, Anladım
        </button>

      </div>
    </div>
  );
};

export default KickedModal;