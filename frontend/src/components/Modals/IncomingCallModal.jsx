import React, { useEffect, useRef } from 'react';
import { FaPhone, FaPhoneSlash } from 'react-icons/fa';

const IncomingCallModal = ({ caller, onAccept, onDecline }) => {
    const audioRef = useRef(null);

    useEffect(() => {
        // 1. Ses dosyasını tanımla (Public klasöründen okur)
        audioRef.current = new Audio('/sounds/ringtone.mp3');
        
        // 2. Ayarlar
        audioRef.current.loop = true;   // Sürekli çalsın
        audioRef.current.volume = 0.5;  // Ses seviyesi (%50)

        // 3. Oynat (Tarayıcı politikaları bazen ilk tıklama olmadan sesi engeller, catch ile yakaladık)
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Otomatik oynatma tarayıcı tarafından engellendi:", error);
            });
        }

        // 4. Temizlik (Modal kapanınca sesi sustur)
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, []);

    if (!caller) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#121214] p-8 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col items-center border border-white/10 relative overflow-hidden">
                
                {/* Arka Plan Efekti */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-gradient-x"></div>

                {/* Avatar & Pulse Efekti */}
                <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping"></div>
                    <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse delay-75"></div>
                    <img 
                        src={caller.avatar} 
                        alt={caller.nickname} 
                        className="w-24 h-24 rounded-full border-4 border-[#2b2d31] shadow-lg relative z-10 object-cover"
                    />
                </div>

                {/* İsim ve Durum */}
                <h3 className="text-xl font-bold text-white mb-1">{caller.nickname}</h3>
                <p className="text-gray-400 text-sm mb-8 animate-pulse">Seni arıyor...</p>

                {/* Butonlar */}
                <div className="flex items-center gap-6 w-full justify-center">
                    
                    {/* Reddet */}
                    <button 
                        onClick={onDecline}
                        className="group flex flex-col items-center gap-2 transition-transform hover:scale-105"
                    >
                        <div className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30 transition-all">
                            <FaPhoneSlash size={20} />
                        </div>
                        <span className="text-xs text-gray-400 group-hover:text-red-400">Reddet</span>
                    </button>

                    {/* Kabul Et */}
                    <button 
                        onClick={onAccept}
                        className="group flex flex-col items-center gap-2 transition-transform hover:scale-105"
                    >
                        <div className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg shadow-green-500/30 transition-all animate-bounce-slight">
                            <FaPhone size={20} />
                        </div>
                        <span className="text-xs text-gray-400 group-hover:text-green-400">Cevapla</span>
                    </button>

                </div>
            </div>
        </div>
    );
};

export default IncomingCallModal;