import { useState } from 'react';

const CreateServerModal = ({ onClose, onCreate }) => {
  const [serverName, setServerName] = useState('');

  const handleSubmit = () => {
    if (serverName.trim()) {
      onCreate(serverName);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#1A1A1E] text-gray-900 w-96 rounded-lg overflow-hidden shadow-2xl">
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold mb-2 text-[#5865F2]">Sunucunu Özelleştir</h2>
          <p className="text-gray-500 text-sm mb-6">
            Yeni sunucuna bir isim ve simge vererek ona bir kimlik kazandır.
          </p>

          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 border-2 border-dashed border-gray-500 rounded-full flex items-center justify-center text-gray-400 text-xs text-center p-2 cursor-pointer hover:border-[#5865F2] transition">
              <span className="font-bold">UPLOAD</span>
            </div>
          </div>

          <div className="text-left mb-1 text-xs font-bold text-gray-400 uppercase">Sunucu Adı</div>
          <input 
            value={serverName} 
            onChange={e => setServerName(e.target.value)}
            className="w-full bg-[#121214] p-2 rounded mb-2 text-white outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="Benim Harika Sunucum" 
          />
        </div>
        <div className="bg-[#121214] p-4 flex justify-between items-center">
          <button onClick={onClose} className="text-gray-400 font-medium hover:underline text-sm">Geri Dön</button>
          <button onClick={handleSubmit} className="bg-[#5865F2] text-white px-6 py-2 rounded font-bold hover:bg-[#4752c4] transition">
            Oluştur
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateServerModal;