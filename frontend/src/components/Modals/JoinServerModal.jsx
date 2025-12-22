import { useState } from 'react';

const JoinServerModal = ({ onClose, onJoin }) => {
  const [serverId, setServerId] = useState('');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#121214] text-white w-96 rounded-lg p-6 shadow-2xl">
        <h2 className="text-2xl font-bold mb-2 text-center text-green-400">Sunucuya Katıl</h2>
        <p className="text-gray-300 text-sm mb-6 text-center">
          Aşağıya Sunucu ID'sini girerek katılabilirsin.
        </p>
        
        <div className="mb-4">
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">DAVET BAĞLANTISI VEYA ID</label>
            <input 
              value={serverId} 
              onChange={e => setServerId(e.target.value)}
              className="w-full bg-[#202225] p-3 rounded text-white outline-none focus:ring-2 ring-green-500" 
              placeholder="Sunucu ID (Örn: 6512...)" 
            />
        </div>
        
        <button onClick={() => onJoin(serverId)} className="w-full bg-green-600 py-2.5 rounded font-bold hover:bg-green-700 transition text-white">
            Katıl
        </button>
        <button onClick={onClose} className="w-full mt-3 text-gray-400 text-sm hover:underline">
            İptal
        </button>
      </div>
    </div>
  );
};

export default JoinServerModal;