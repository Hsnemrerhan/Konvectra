import { useState } from 'react';
import { FaTrash, FaExclamationTriangle, FaHashtag, FaVolumeUp } from 'react-icons/fa';

const ChannelSettingsModal = ({ channel, onClose, onRename, onDelete }) => {
  const [newName, setNewName] = useState(channel.name);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);

  // Kanal tipini kontrol et
  const isTextChannel = channel.type === 'text';

  const handleSave = () => {
    if (newName && newName !== channel.name) {
      onRename(channel._id, newName);
    }
    onClose();
  };

  const handleDelete = () => {
    // Metin kanalıysa ve onaylanmamışsa işlem yapma
    if (isTextChannel && !isDeleteConfirmed) return;
    
    // Ses kanalıysa veya onaylanmışsa sil
    onDelete(channel._id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-[#1A1A1E] text-gray-100 w-[450px] rounded-lg overflow-hidden shadow-2xl transform transition-all" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Başlık ve Form */}
        <div className="p-6">
          <h2 className="text-xl font-bold mb-6 text-white">Kanal Ayarları</h2>
          <div className="text-xs text-gray-400 mb-4 uppercase font-bold tracking-wide">
             {isTextChannel ? 'METİN KANALI' : 'SES KANALI'}
          </div>

          {/* İsim Değiştirme Alanı */}
          
          <div className="bg-[#121214] p-2 rounded flex items-center mb-8">
            {isTextChannel ? <FaHashtag className="text-gray-400 mr-2" /> : <FaVolumeUp className="text-gray-400 mr-2" />}
            
            <input 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Yeni Kanal"
              className="bg-transparent w-full text-white outline-none font-medium placeholder-gray-400"
              autoFocus
            />
          </div>

          {/* TEHLİKELİ BÖLGE (Sadece Metin Kanalları İçin) */}
          {isTextChannel && (
              <div>
                 <div className="flex items-center gap-2 mb-2 text-red-400">
                    <FaExclamationTriangle />
                    <span className="text-xs font-bold uppercase">Tehlikeli Bölge</span>
                 </div>
                 
                 <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                    <div className="flex items-start gap-3">
                        <input 
                            type="checkbox" 
                            id="confirmDelete"
                            className="mt-1 cursor-pointer w-4 h-4 accent-red-500"
                            checked={isDeleteConfirmed}
                            onChange={(e) => setIsDeleteConfirmed(e.target.checked)}
                        />
                        <label htmlFor="confirmDelete" className="text-sm text-gray-300 cursor-pointer select-none">
                            Bu kanalı silmek istediğimi onaylıyorum. <br/>
                            <span className="text-xs text-red-400 font-bold block mt-1">
                               Dikkat: Kanal içindeki tüm mesaj geçmişi kalıcı olarak silinir.
                            </span>
                        </label>
                    </div>
                 </div>
              </div>
          )}
        </div>

        {/* Alt Butonlar */}
        <div className="bg-[#121214] p-4 flex justify-between items-center">
          {/* Silme Butonu Logic */}
          <button 
            onClick={handleDelete}
            // Metin kanalıysa VE onay yoksa buton pasif (disabled)
            disabled={isTextChannel && !isDeleteConfirmed}
            className={`flex items-center gap-2 text-sm font-medium transition-all px-3 py-1.5 rounded
              ${(!isTextChannel || isDeleteConfirmed)
                ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer shadow-md' // Aktif Durum
                : 'bg-transparent text-gray-600 cursor-not-allowed opacity-50'      // Pasif Durum
              }`}
          >
            <FaTrash size={12} /> Kanalı Sil
          </button>

          <div className="flex gap-3">
            <button 
              onClick={onClose} 
              className="text-gray-300 hover:underline text-sm font-medium"
            >
              İptal
            </button>
            <button 
              onClick={handleSave} 
              className="bg-[#5865F2] hover:bg-[#4752c4] text-white px-5 py-2 rounded text-sm font-bold transition"
            >
              Kaydet
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ChannelSettingsModal;