import { useState } from 'react';
import { FaHashtag, FaVolumeUp, FaCheck, FaMusic } from 'react-icons/fa';

const CreateChannelModal = ({ onClose, onCreate, initialType = 'text' }) => {
  const [channelType, setChannelType] = useState(initialType);
  const [channelName, setChannelName] = useState('');
  const [isMusicChannel, setIsMusicChannel] = useState('');

  const handleCreate = () => {
    if (channelName.trim()) {
      // Boşlukları tireye çevir (Discord standardı: genel sohbet -> genel-sohbet)
      // Sadece metin kanalları için küçük harf ve tire zorlaması yapalım
      const finalName = channelName;

      onCreate(finalName, channelType);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-[#1A1A1E] text-gray-100 w-[460px] rounded-lg overflow-hidden shadow-2xl transform transition-all" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Başlık */}
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2 text-white">Kanal Oluştur</h2>
          <p className="text-xs text-gray-400 mb-6 uppercase font-bold">KANAL TİPİ</p>

          {/* KANAL TİPİ SEÇİMİ (Radyo Butonlar) */}
          <div className="space-y-2 mb-6">
            
            {/* Metin Kanalı Seçeneği */}
            <div 
              onClick={() => setChannelType('text')}
              className={`flex items-center p-4 rounded cursor-pointer border transition-all
                ${channelType === 'text' 
                  ? 'bg-[#121214] border-transparent' 
                  : 'bg-[#1A1A1E] border-transparent hover:bg-[#121214]'}`}
            >
              <FaHashtag size={24} className="text-gray-400 mr-3" />
              <div className="flex-1">
                <div className="font-bold text-gray-200">Metin Kanalı</div>
                <div className="text-xs text-gray-400">Mesaj, resim, GIF ve emoji gönder.</div>
              </div>
              {/* Radyo Daire */}
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                 ${channelType === 'text' ? 'border-[#5865F2]' : 'border-gray-500'}`}>
                 {channelType === 'text' && <div className="w-2.5 h-2.5 bg-[#5865F2] rounded-full"></div>}
              </div>
            </div>

            {/* Ses Kanalı Seçeneği */}
            <div 
              onClick={() => setChannelType('voice')}
              className={`flex items-center p-4 rounded cursor-pointer border transition-all
                ${channelType === 'voice' 
                  ? 'bg-[#121214] border-transparent' 
                  : 'bg-[#1A1A1E] border-transparent hover:bg-[#121214]'}`}
            >
              <FaVolumeUp size={24} className="text-gray-400 mr-3" />
              <div className="flex-1">
                <div className="font-bold text-gray-200">Ses Kanalı</div>
                <div className="text-xs text-gray-400">Sesli sohbet, görüntü ve ekran paylaşımı.</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                 ${channelType === 'voice' ? 'border-[#5865F2]' : 'border-gray-500'}`}>
                 {channelType === 'voice' && <div className="w-2.5 h-2.5 bg-[#5865F2] rounded-full"></div>}
              </div>
            </div>
          </div>

          {channelType === 'text' && (
              <div className="mb-4 flex items-center gap-3 p-3 rounded cursor-pointer" onClick={() => setIsMusicChannel(!isMusicChannel)}>
                  <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${isMusicChannel ? 'bg-[#5865F2] border-[#5865F2]' : 'border-gray-500'}`}>
                      {isMusicChannel && <FaCheck size={12} className="text-white" />}
                  </div>
                  <div>
                      <div className="text-white font-bold text-sm">Müzik Kanalı</div>
                      <div className="text-gray-400 text-xs">Bu kanalda müzik botu komutları çalışır (!play).</div>
                  </div>
              </div>
          )}

          {/* İsim Girme Alanı */}
          <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">KANAL ADI</label>
          <div className="bg-[#121214] p-2 rounded flex items-center">
            {channelType === 'text' && isMusicChannel ? <FaMusic className="text-gray-400 mr-2" /> : <FaHashtag className="text-gray-400 mr-2" />}
            {channelType === 'voice' && <FaVolumeUp className="text-gray-400 mr-2" />}
            <input 
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Yeni Kanal"
              className="bg-transparent w-full text-white outline-none font-medium placeholder-gray-400"
              autoFocus
            />
          </div>

        </div>

        {/* Alt Butonlar */}
        <div className="bg-[#121214] p-4 flex justify-end items-center gap-3">
            <button 
              onClick={onClose} 
              className="text-gray-300 hover:underline text-sm font-medium"
            >
              İptal
            </button>
            <button 
              onClick={handleCreate} 
              disabled={!channelName.trim()}
              className="bg-[#5865F2] hover:bg-[#4752c4] text-white px-6 py-2 rounded text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Kanal Oluştur
            </button>
        </div>

      </div>
    </div>
  );
};

export default CreateChannelModal;