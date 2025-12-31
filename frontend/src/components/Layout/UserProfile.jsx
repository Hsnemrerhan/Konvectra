import React, { useState } from 'react'; // 1. useState eklendi
import { FaMicrophone, FaMicrophoneSlash, FaHeadphones, FaHeadphonesAlt, FaCog } from 'react-icons/fa';
import { TbHeadphonesOff } from "react-icons/tb";

const UserProfile = ({ 
    currentUser, 
    onOpenSettings,
    isMicMuted,
    toggleMic,
    isDeafened,
    toggleDeafen
}) => {
  // 2. Kopyalandı bilgisini tutacak state
  const [isCopied, setIsCopied] = useState(false);

  if (!currentUser) return null;

  // 3. Kopyalama Fonksiyonu
  const handleCopyCode = (e) => {
    e.stopPropagation(); // Eğer üst div'de tıklama özelliği varsa tetiklenmesin diye
    if (currentUser.friendCode) {
        navigator.clipboard.writeText(currentUser.friendCode); // Panoya kopyala
        setIsCopied(true); // "Kopyalandı" yazısını göster
        
        // 2 saniye sonra tekrar kodu göster
        setTimeout(() => {
            setIsCopied(false);
        }, 2000);
    }
  };

  return ( 
    <div className="h-[70px] bg-gradient-to-r from-[#1A1A1E] to-[#1A1A1E] border-b border-[#2b2d31] flex items-center px-2 justify-between flex-shrink-0 m-2 rounded-md">
      
      {/* Profil Bilgisi */}
      <div className="flex items-center gap-2 pl-1 mr-2 overflow-hidden hover:bg-[#393d42] p-1 rounded transition flex-1">
        <div className="relative w-[45px] h-[45px] rounded-full bg-gray-600 flex-shrink-0">
            <img src={currentUser.avatar} className="w-full h-full rounded-full object-cover" alt="avatar"/>
            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#232428] 
                ${currentUser.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}>
            </div>
        </div>
        
        <div className="text-m overflow-hidden flex flex-col justify-center">
            <div className="font-bold text-white truncate max-w-[140px]">
                {currentUser.nickname || currentUser.username}
            </div>
            
            {/* 👇 BURASI GÜNCELLENDİ 👇 */}
            <div 
                onClick={handleCopyCode}
                title="Kodu kopyalamak için tıkla"
                className={`text-xs truncate max-w-[140px] cursor-pointer transition-colors select-none
                    ${isCopied ? 'text-green-400 font-bold' : 'text-gray-400 hover:text-white'}`}
            >
                {isCopied ? "Kopyalandı!" : `#${currentUser.friendCode}`}
            </div>
            {/* 👆 ------------------ 👆 */}

        </div>
      </div>

      {/* Kontrol Butonları */}
      <div className="flex items-center">
        
        {/* MİKROFON */}
        <button 
            onClick={toggleMic}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#393d42] text-gray-200 transition relative"
        >
            {isMicMuted ? (
                <FaMicrophoneSlash size={20} className="text-red-500"/>
            ) : (
                <FaMicrophone size={20} />
            )}
            {isDeafened && <div className="absolute inset-0 bg-black/50 rounded cursor-not-allowed"></div>}
        </button>

        {/* KULAKLIK (DEAFEN) */}
        <button 
            onClick={toggleDeafen}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#393d42] text-gray-200 transition"
        >
            {isDeafened ? (
                <TbHeadphonesOff size={20} className="text-red-500"/>
            ) : (
                <FaHeadphones size={20} />
            )}
        </button>

        {/* AYARLAR */}
        <button 
            onClick={onOpenSettings}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#393d42] text-gray-200 transition"
        >
            <FaCog size={20} />
        </button>
      </div>

    </div>
  );
};

export default UserProfile;