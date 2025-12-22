import React, { useState, useEffect } from 'react';
import HomeSidebar from '../Layout/HomeSidebar';
import UserList from '../Layout/UserList';
import ChatArea from '../Chat/ChatArea';
import VoiceCallPanel from '../Voice/VoiceCallPanel';
import VoiceRoom from '../Voice/VoiceRoom'; 
import AnimatedNickname from '../Chat/AnimatedNickname';
import { FaHashtag, FaCheck, FaTimes, FaPhone, FaAt } from 'react-icons/fa';

const HomeView = ({ 
    activeTab, setActiveTab, incomingRequests, friends, currentUser, 
    handleLogout, onOpenSettings, friendInput, setFriendInput, 
    handleSendFriendRequest, handleAcceptFriend, 
    socket,
    onSendMessage,
    messages,
    fetchMessages
}) => {
  
  // DM ve Sesli Arama State'leri
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [dmRoomId, setDmRoomId] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callConnectionStatus, setCallConnectionStatus] = useState('disconnected');
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  // 1. ARKADAŞ SEÇİLİNCE (DM BAŞLAT)
  const handleSelectFriend = async (friend) => {
      if (selectedFriend?._id === friend?._id) return;

      setSelectedFriend(friend);
      
      if (friend) {
          try {
              const API_URL = `http://${window.location.hostname}:5000`;
              const res = await fetch(`${API_URL}/api/channels/dm`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ myId: currentUser.id, friendId: friend._id })
              });
              
              const data = await res.json();
              const realDmRoomId = data.channelId; 

              setDmRoomId(realDmRoomId);
              socket.emit("join_dm_room", realDmRoomId);
              fetchMessages(realDmRoomId);

          } catch (error) {
              console.error("DM başlatılamadı:", error);
          }
      } else {
          setDmRoomId(null);
      }
  };

  // 2. SESLİ ARAMA KONTROLLERİ
  const startCall = () => {
      setIsCallActive(true);
      setCallConnectionStatus('connecting');
  };

  const endCall = () => {
      setIsCallActive(false);
      setCallConnectionStatus('disconnected');
      if (dmRoomId) socket.emit("leave_voice_room", dmRoomId);
  };

  // 👇 YENİ EKLENECEK KISIM: SENKRONİZASYON 👇
  useEffect(() => {
      // Eğer şu an bir arkadaş seçiliyse
      if (selectedFriend) {
          // App.jsx'ten gelen güncel 'friends' listesinin içinde bu arkadaşı bul
          const updatedFriendData = friends.find(f => f._id === selectedFriend._id);
          
          // Eğer güncel veri varsa ve eskisiyle farklıysa (nickname, avatar, status vs.)
          if (updatedFriendData) {
              // State'i güncelle ki ekrandaki AnimatedNickname tetiklensin
              setSelectedFriend(prev => {
                  // Gereksiz render'ı önlemek için basit bir kontrol (Opsiyonel ama iyi olur)
                  if (prev.nickname !== updatedFriendData.nickname || 
                      prev.avatar !== updatedFriendData.avatar ||
                      prev.status !== updatedFriendData.status) {
                      return updatedFriendData;
                  }
                  return prev;
              });
          }
      }
  }, [friends]); // 'friends' prop'u her değiştiğinde (Socket olayında) çalışır
  // 👆 YENİ EKLENECEK KISIM BİTTİ 👆

  return (
    <div className="flex w-full h-full">
        {/* SOL: HOME SIDEBAR */}
        <HomeSidebar 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            incomingRequestsCount={incomingRequests.length}
            currentUser={currentUser}
            handleLogout={handleLogout}
            onOpenSettings={onOpenSettings}
            friends={friends}
            onSelectFriend={handleSelectFriend}
            activeFriendId={selectedFriend?._id}
        />

        {/* ORTA ALAN */}
        <div className="flex-1 bg-[#313338] flex flex-col min-w-0 relative">
            
            {selectedFriend ? (
                // === DM MODU ===
                <div className="flex flex-col h-full w-full">
                    
                    {isCallActive && (
                        <div className="flex-shrink-0 z-20">
                            <VoiceCallPanel 
                                friend={selectedFriend}
                                onEndCall={endCall}
                                isMicMuted={isMicMuted}
                                toggleMic={() => setIsMicMuted(!isMicMuted)}
                                isDeafened={isDeafened}
                                toggleDeafen={() => setIsDeafened(!isDeafened)}
                                connectionStatus={callConnectionStatus}
                            />
                            <VoiceRoom 
                                serverId="DM" 
                                channelId={dmRoomId}
                                socket={socket}
                                currentUser={currentUser}
                                setVoiceParticipants={setVoiceParticipants}
                                isMicMuted={isMicMuted}
                                isDeafened={isDeafened}
                            />
                        </div>
                    )}

                    {!isCallActive && (
                        <div className="h-12 border-b border-[#26272d] flex items-center justify-between px-4 shadow-sm bg-[#121214]">
                            <div className="flex items-center gap-3">
                                <FaAt className="text-gray-400"/>
                                <AnimatedNickname 
                                    text={selectedFriend.nickname} 
                                    className="font-bold text-white"
                                />
                                <div className={`w-2.5 h-2.5 rounded-full ${selectedFriend.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={startCall} className="text-gray-400 hover:text-green-500 transition tooltip" title="Sesli Arama Başlat">
                                    <FaPhone size={20} />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 min-h-0 relative">
                         <ChatArea 
                            messages={messages} 
                            currentUser={currentUser} 
                            onSendMessage={(content) => onSendMessage(content, dmRoomId)} 
                            activeChannelName={selectedFriend.nickname}
                            friendAvatar={selectedFriend.avatar}
                            activeChannelId={dmRoomId}
                            chatType={"dm"}
                            onLoadMore={() => {}} 
                            hasMore={false}
                            isLoading={false}
                        />
                    </div>
                </div>

            ) : (
                // === DASHBOARD MODU (Senin Eski Kodun Burada) ===
                <div className="flex-1 bg-[#1A1A1E] p-8 flex flex-col overflow-y-auto">
                    
                    {/* Sekme: Arkadaş Ekle */}
                    {activeTab === 'add' && (
                        <div>
                            <h2 className="uppercase font-bold text-white mb-2">Arkadaş Ekle</h2>
                            <div className="text-xs text-gray-400 mb-4">Görünen adı ve kodunu girerek arkadaş ekleyebilirsin.</div>
                            <div className="flex bg-[#1e1f22] p-2 rounded-lg border border-black focus-within:border-blue-500">
                                <input 
                                    value={friendInput} 
                                    onChange={e=>setFriendInput(e.target.value)}
                                    placeholder="Nickname#0000" 
                                    className="bg-transparent outline-none flex-1 text-white placeholder-gray-500"
                                />
                                <button onClick={handleSendFriendRequest} className="bg-[#5865F2] px-4 py-1 rounded text-sm font-bold disabled:opacity-50 text-white hover:bg-[#4752c4] transition">İstek Gönder</button>
                            </div>
                        </div>
                    )}

                    {/* Sekme: Bekleyen İstekler */}
                    {activeTab === 'pending' && (
                        <div>
                            <h2 className="uppercase font-bold text-gray-400 text-xs mb-4">Bekleyen İstekler — {incomingRequests.length}</h2>
                            {incomingRequests.map(req => (
                                <div key={req._id} className="flex justify-between items-center p-3 hover:bg-[#393d42] rounded border-t border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gray-600 rounded-full overflow-hidden">
                                            <img src={req.avatar} className="w-full h-full object-cover" alt={req.nickname}/>
                                        </div>
                                        <span className="font-bold text-white">{req.nickname} <span className="text-gray-400 text-xs">#{req.friendCode}</span></span>
                                    </div>
                                    <div className="flex gap-2">
                                        <div onClick={() => handleAcceptFriend(req._id)} className="w-8 h-8 rounded-full border border-green-600 flex items-center justify-center cursor-pointer text-green-500 hover:bg-green-600 hover:text-white transition"><FaCheck /></div>
                                        <div className="w-8 h-8 rounded-full border border-red-600 flex items-center justify-center cursor-pointer text-red-500 hover:bg-red-600 hover:text-white transition"><FaTimes /></div>
                                    </div>
                                </div>
                            ))}
                            {incomingRequests.length === 0 && <div className="text-gray-500 mt-10 text-center">Hiç bekleyen isteğin yok.</div>}
                        </div>
                    )}

                    {/* Sekme: Online veya Tümü */}
                    {(activeTab === 'online' || activeTab === 'all') && (
                        <div className="flex flex-col h-full">
                            <h2 className="uppercase font-bold text-gray-400 text-xs mb-4">
                                {activeTab === 'online' ? 'Çevrimiçi' : 'Tüm Arkadaşlar'} — 
                                {activeTab === 'online' 
                                    ? friends.filter(f => f.status && f.status !== 'offline').length 
                                    : friends.length
                                }
                            </h2>
                            
                            <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2">
                                {friends
                                    .filter(friend => {
                                        if (activeTab === 'online') {
                                            return friend.status && friend.status !== 'offline';
                                        }
                                        return true; 
                                    })
                                    .map(friend => (
                                        <div 
                                            key={friend._id} 
                                            // BURAYA DİKKAT: Listeden de tıklayınca DM açılsın istiyorsan buraya onClick ekleyebiliriz.
                                            // Ama sen sidebar'dan açılsın, burası sadece liste olsun istemiştin sanırım.
                                            // Eğer buradan da açılsın istersen: onClick={() => handleSelectFriend(friend)}
                                            className="flex items-center justify-between p-3 hover:bg-[#393d42] rounded border-t border-gray-700 cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full bg-gray-600 relative ${(!friend.status || friend.status === 'offline') ? 'opacity-50' : ''}`}>
                                                    <img 
                                                        src={friend.avatar || "https://i.pravatar.cc/150"} 
                                                        className={`w-full h-full rounded-full object-cover`} 
                                                        alt={friend.nickname}
                                                    />
                                                    <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#36393f] 
                                                        ${friend.status === 'dnd' ? 'bg-red-500' : 
                                                          friend.status === 'idle' ? 'bg-yellow-500' : 
                                                          (!friend.status || friend.status === 'offline') ? 'bg-gray-500' : 'bg-green-500'}`}>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className={`font-bold text-base ${(!friend.status || friend.status === 'offline') ? 'text-gray-400' : 'text-white'}`}>
                                                        {friend.nickname}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {(!friend.status || friend.status === 'offline') ? 'Çevrimdışı' : 'Çevrimiçi'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 bg-[#2f3136] p-2 rounded-full transition-opacity">
                                                {/* Buradaki butona basınca da DM açılsın */}
                                                <div 
                                                    onClick={(e) => { e.stopPropagation(); handleSelectFriend(friend); }}
                                                    className="w-8 h-8 rounded-full bg-[#313338] flex items-center justify-center text-gray-400 hover:text-white" 
                                                    title="Mesaj Gönder"
                                                >
                                                    <FaHashtag />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                }

                                {friends.filter(f => activeTab === 'online' ? (f.status && f.status !== 'offline') : true).length === 0 && (
                                    <div className="text-center mt-20 opacity-60">
                                        <div className="text-4xl mb-4 grayscale">😴</div>
                                        <div className="text-gray-400">
                                            {activeTab === 'online' ? 'Şu an kimse çevrimiçi değil.' : 'Henüz arkadaşın yok.'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* SAĞ: USER PROFILE */}
        <UserList 
            users={selectedFriend ? [selectedFriend] : friends} 
            type={selectedFriend ? "dm" : "home"}
        />
    </div>
  );
};

export default HomeView;