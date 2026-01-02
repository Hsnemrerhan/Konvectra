import React from 'react';
import { useState, useEffect } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaPhoneSlash } from 'react-icons/fa';
import { TbHeadphones, TbHeadphonesOff } from "react-icons/tb";
import AnimatedNickname from '../Chat/AnimatedNickname';

const VoiceCallPanel = ({ 
    friend, 
    onEndCall, 
    isMicMuted, 
    toggleMic, 
    isDeafened, 
    toggleDeafen,
    connectionStatus // 'connecting', 'connected', 'disconnected'
}) => {

  // Süre sayacı için state
    const [duration, setDuration] = useState(0);

    // Sadece "Connected" olduğunda süreyi başlat
    useEffect(() => {
        let interval;
        if (connectionStatus === 'connected') {
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else {
            setDuration(0); // Bağlantı koparsa süreyi sıfırla (veya durdur)
        }
        return () => clearInterval(interval);
    }, [connectionStatus]);

    // Saniyeyi Dakika:Saniye formatına çevir (05:30 gibi)
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Duruma göre Başlık ve Alt Metin belirle
    let statusTitle = "";
    let statusColor = "";

    switch (connectionStatus) {
        case 'connected':
            statusTitle = "Sesli Görüşme Bağlandı";
            statusColor = "text-green-400";
            break;
        case 'waiting':
            statusTitle = `${friend?.nickname || friend?.username} Bekleniyor...`;
            statusColor = "text-yellow-400"; // Beklerken sarı
            break;
        case 'connecting':
        default:
            statusTitle = "Bağlanılıyor...";
            statusColor = "text-gray-400";
            break;
    }
    
  return (
    <div className="bg-[#121214] border-b border-[#1e1f22] p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-lg animate-slide-down transition-all duration-300">
      
      {/* ARKA PLAN EFEKTİ */}
      <div className="absolute inset-0 z-0">
        {/* Kullanıcının avatarını buraya da koyuyoruz */}
        <img 
          src={friend.avatar}
          className="w-full h-full object-cover blur-3xl opacity-30 scale-125" 
          alt="" 
        />
        {/* Üstüne bir karartma atalım ki yazılar okunsun */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Arkadaş Bilgisi & Avatar */}
      <div className="flex flex-col items-center z-10 mb-4">
          <div className="relative mb-2">
              <div className="w-[120px] h-[120px] rounded-full p-1 border-2 border-[#5865F2] shadow-[0_0_15px_rgba(88,101,242,0.5)]">
                  <img src={friend.avatar} className="w-full h-full rounded-full object-cover" />
              </div>
          </div>
          <AnimatedNickname 
              text={friend.nickname} 
              className="text-white font-bold text-lg"
          />
          <p className={`text-sm font-medium tracking-wide mb-8 z-10 ${statusColor}`}>
                {connectionStatus === 'connected' ? formatTime(duration) : statusTitle}
            </p>
      </div>

      {/* Kontrol Butonları */}
      <div className="flex items-center gap-4 z-10 bg-[#121214] p-2 rounded-full shadow-xl border border-[#2b2d31]">
          {/* MİKROFON */}
          <button 
            onClick={toggleMic}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200
            ${isMicMuted ? 'bg-white text-red-500' : 'bg-[#2b2d31] text-white hover:bg-[#40444b]'}`}
          >
             {isMicMuted ? <FaMicrophoneSlash size={18}/> : <FaMicrophone size={18}/>}
          </button>

          {/* TELEFONU KAPAT (Büyük Buton) */}
          <button 
            onClick={onEndCall}
            className="w-[50px] h-[50px] rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          >
             <FaPhoneSlash size={24}/>
          </button>

          {/* SAĞIRLAŞTIRMA */}
          <button 
            onClick={toggleDeafen}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200
            ${isDeafened ? 'bg-white text-red-500' : 'bg-[#2b2d31] text-white hover:bg-[#40444b]'}`}
          >
             {isDeafened ? <TbHeadphonesOff size={20}/> : <TbHeadphones size={20}/>}
          </button>
      </div>
    </div>
  );
};

export default VoiceCallPanel;