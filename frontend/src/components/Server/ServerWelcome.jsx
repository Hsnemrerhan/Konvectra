import React from 'react';
import { FaPlus, FaRocket } from 'react-icons/fa';

const ServerWelcome = ({ server, onOpenCreateChannel }) => {
  if (!server) return null;

  return (
    <div className="flex-1 bg-[#1A1A1E] flex flex-col items-center justify-center text-center p-8 animate-fade-in">
      
      {/* İkon */}
      <div className="w-24 h-24 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
          <FaRocket size={40} className="text-[#1A1A1E]" />
      </div>

      {/* Başlık */}
      <h1 className="text-3xl font-bold text-white mb-2">
        {server.name} Sunucusuna Hoş Geldin!
      </h1>
      
      <p className="text-gray-400 max-w-md mb-8 text-lg">
        Burası senin yeni alanın. Henüz hiç kanal yok, ama büyük maceralar küçük adımlarla başlar.
      </p>

      {/* Aksiyon Kartları */}
      <div className="grid grid-cols-1 gap-4 w-full max-w-lg">
          
          {/* Kanal Oluştur Kartı */}
          <div 
            onClick={() => onOpenCreateChannel('text')}
            className="bg-[#121214] p-4 rounded-lg cursor-pointer transition group border border-transparent hover:border-[#5865F2] flex items-center gap-4"
          >
              <div className="w-10 h-10 bg-[#5865F2] rounded-full flex items-center justify-center flex-shrink-0">
                  <FaPlus className="text-white" />
              </div>
              <div className="text-left">
                  <h3 className="text-white font-bold group-hover:text-[#5865F2] transition">İlk Kanalını Oluştur</h3>
                  <p className="text-xs text-gray-400">Sohbetin başlaması için bir metin kanalı ekle.</p>
              </div>
          </div>

          {/* Davet Kartı (Görsel - Fonksiyonu sonra eklersin) */}
          <div className="bg-[#121214] p-4 rounded-lg flex items-center gap-4 opacity-50 cursor-not-allowed">
              <div className="w-10 h-10 bg-[#23a559] rounded-full flex items-center justify-center flex-shrink-0">
                  <FaPlus className="text-white" />
              </div>
              <div className="text-left">
                  <h3 className="text-white font-bold">Arkadaşlarını Davet Et</h3>
                  <p className="text-xs text-gray-400">Yakında eklenecek...</p>
              </div>
          </div>

      </div>
    </div>
  );
};

export default ServerWelcome;