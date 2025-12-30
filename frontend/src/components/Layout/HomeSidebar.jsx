// frontend/src/components/Layout/HomeSidebar.jsx
import UserProfile from './UserProfile'; 
import AnimatedNickname from '../Chat/AnimatedNickname';

const HomeSidebar = ({ 
  activeTab, 
  setActiveTab, 
  incomingRequestsCount, 
  currentUser, 
  friends = [], 
  onSelectFriend, 
  activeFriendId, 
  userPanelContent,
  handleLogout,
  onOpenSettings,
  voicePanelContent
}) => {
  return (
    <div className="w-60 bg-[#121214] flex flex-col flex-shrink-0">
      
      {/* Başlık */}
      <div className="h-12 flex items-center px-4 font-bold shadow-sm text-white border-b border-[#202225]">
        Arkadaşlar
      </div>
      
      {/* Menü Öğeleri ve DM Listesi */}
      <div className="flex-1 p-2 space-y-0.5 overflow-y-auto custom-scrollbar">
        
        {/* --- STATİK MENÜLER --- */}
        <div 
          onClick={() => { setActiveTab('online'); onSelectFriend(null); }} 
          className={`px-2 py-2 rounded cursor-pointer font-medium text-sm ${activeTab==='online' && !activeFriendId ? 'bg-[#393d42] text-white' : 'text-gray-400 hover:bg-[#34373c] hover:text-gray-200'}`}
        >
          Çevrimiçi
        </div>
        <div 
          onClick={() => { setActiveTab('all'); onSelectFriend(null); }} 
          className={`px-2 py-2 rounded cursor-pointer font-medium text-sm ${activeTab==='all' && !activeFriendId ? 'bg-[#393d42] text-white' : 'text-gray-400 hover:bg-[#34373c] hover:text-gray-200'}`}
        >
          Tümü
        </div>
        <div 
          onClick={() => { setActiveTab('pending'); onSelectFriend(null); }} 
          className={`px-2 py-2 rounded cursor-pointer font-medium text-sm flex justify-between items-center ${activeTab==='pending' && !activeFriendId ? 'bg-[#393d42] text-white' : 'text-gray-400 hover:bg-[#34373c] hover:text-gray-200'}`}
        >
          <span>Bekleyenler</span>
          {incomingRequestsCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">
              {incomingRequestsCount}
            </span>
          )}
        </div>
        <div 
          onClick={() => { setActiveTab('add'); onSelectFriend(null); }} 
          className={`px-2 py-2 rounded cursor-pointer font-medium text-sm ${activeTab==='add' && !activeFriendId ? 'bg-transparent text-green-500' : 'text-green-500 hover:bg-[#34373c]'}`}
        >
          Arkadaş Ekle
        </div>

        {/* --- DİREKT MESAJLAR BAŞLIĞI (YENİ EKLENDİ) --- */}
        <div className="pt-4 pb-2 mt-2 flex items-center justify-between group px-2">
             <span className="text-xs font-bold text-gray-400 uppercase group-hover:text-gray-300">DİREKT MESAJLAR</span>
        </div>

        {/* --- ARKADAŞ LİSTESİ (DM) (YENİ EKLENDİ) --- */}
        <div className="space-y-1">
            {friends.map(friend => (
                <div 
                    key={friend._id}
                    onClick={() => onSelectFriend(friend)}
                    className={`group flex items-center gap-3 px-2 py-2 rounded cursor-pointer transition-colors
                    ${activeFriendId === friend._id 
                        ? 'bg-[#393d42] text-white' 
                        : 'text-gray-400 hover:bg-[#34373c] hover:text-gray-200'}`}
                >
                    {/* Avatar + Status Dot */}
                    <div className="relative w-8 h-8 flex-shrink-0">
                        <img 
                            src={friend.avatar || "https://i.pravatar.cc/150"} 
                            className="w-full h-full rounded-full object-cover" 
                            alt={friend.nickname}
                        />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#2b2d31] 
                            ${friend.status === 'online' ? 'bg-green-500' : 
                              friend.status === 'dnd' ? 'bg-red-500' : 
                              friend.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-500'}`}>
                        </div>
                    </div>
                    <AnimatedNickname 
                        text={friend.nickname} 
                        className="font-medium truncate flex-1 text-sm"
                    />
                </div>
            ))}
        </div>

      </div>

      {voicePanelContent}

      {userPanelContent}
      
    </div>
  );
};

export default HomeSidebar;