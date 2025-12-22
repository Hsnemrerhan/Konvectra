import { FaExclamationTriangle } from 'react-icons/fa';

const ChannelDeletedModal = ({ data, onClose }) => {
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] animate-fade-in">
      <div className="bg-[#121214] w-[440px] rounded-lg shadow-2xl p-6 flex flex-col items-center text-center">
        
        {/* İkon */}
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <FaExclamationTriangle size={32} className="text-red-500" />
        </div>

        {/* Başlık */}
        <h2 className="text-2xl font-bold text-white mb-2">Kanal Silindi!</h2>

        {/* Açıklama */}
        <p className="text-gray-300 mb-6 leading-relaxed">
           Şu an bulunduğun <span className="font-bold text-white">#{data.channelName}</span> kanalı, 
           <br/>
           <span className="font-bold text-yellow-400">{data.deleterName}</span> tarafından silindi.
        </p>

        {/* Buton */}
        <button 
          onClick={onClose}
          className="bg-[#5865F2] hover:bg-[#4752c4] text-white px-8 py-2.5 rounded text-sm font-bold transition w-full"
        >
          Tamam, Ana Sayfaya Dön
        </button>

      </div>
    </div>
  );
};

export default ChannelDeletedModal;