import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeSidebar from '../Layout/HomeSidebar';
import UserList from '../Layout/UserList';
import ChatArea from '../Chat/ChatArea';
import VoiceCallPanel from '../Voice/VoiceCallPanel';
import AnimatedNickname from '../Chat/AnimatedNickname';
import { FaHashtag, FaCheck, FaTimes, FaPhone, FaAt } from 'react-icons/fa';

const HomeView = ({ 
    activeTab, setActiveTab, incomingRequests, friends, currentUser, 
    handleLogout, onOpenSettings, friendInput, setFriendInput, 
    handleSendFriendRequest, handleAcceptFriend, 
    socket,
    onSendMessage,
    handleSendMessage,
    messages,
    fetchMessages,
    selectedFriend, 
    setSelectedFriend,
    connectionStatus,
    userPanelContent,
    voicePanelContent, // App.jsx'ten Sidebar'a gitmesi için
    onStartDmCall, // App.jsx'ten gelen fonksiyon
    onEndCall,     // App.jsx'ten gelen fonksiyon
    activeVoiceChannel, // App.jsx'ten gelen aktif kanal bilgisi
    voiceParticipants,  // App.jsx'ten gelen katılımcı listesi (Eksikti, ekledim)
    isMicMuted, toggleMic, isDeafened, toggleDeafen // App.jsx'ten gelen ses kontrolleri
}) => {
    const navigate = useNavigate();
  
  // Sadece DM Odası ID'sini tutmak için local state (Bu kalabilir)
  const [dmRoomId, setDmRoomId] = useState(null);

  // 1. ARKADAŞ SEÇİLİNCE (DM KANALI BUL)
  const handleSelectFriend = (friend) => {
    if (!friend) return;
    if (selectedFriend?._id === friend._id) return;

    // 1. Sadece seçimi yap (Data çekme işini useEffect'e devredeceğiz)
    setSelectedFriend(friend);
    
    // 2. URL'yi güncelle
    navigate(`/dm/${friend.friendCode}`);
  };

  // Sekme değiştirince (Online, Tümü vb.) DM'den çıkıp Dashboard'a dön
    const handleTabChange = (tab) => {
        setActiveTab(tab);       // 1. İstenen sekmeyi ayarla
        setSelectedFriend(null); // 2. Arkadaş seçimini temizle (Böylece Dashboard görünür)
    };

  // 2. SESLİ ARAMA KONTROLLERİ (App.jsx'e yönlendirir)
  const startCall = () => {
        if (dmRoomId && selectedFriend) {
            onStartDmCall(selectedFriend, dmRoomId);
            // 2. 👇 YENİ: Karşı tarafa sinyal gönder
            socket.emit("call_user", {
                toUserId: selectedFriend._id,
                roomId: dmRoomId,
                friendCode: currentUser.friendCode, // Karşı taraf bize dönebilsin diye
                caller: {
                    _id: currentUser.id,
                    nickname: currentUser.nickname,
                    avatar: currentUser.avatar
                }
            });
        } else {
            console.error("DM ID veya Arkadaş bulunamadı");
        }
    };

    // HomeView.jsx

// ⚡ OTOMATİK DM BAĞLANTISI (F5 ve Tıklama için Ortak Çözüm)
useEffect(() => {
    const initializeDmChannel = async () => {
        // Eğer arkadaş seçili değilse işlem yapma
        if (!selectedFriend) {
            setDmRoomId(null); // Odayı kapat
            return;
        }

        try {
            // 1. Socket'e haber ver (Backend hazırlık yapsın)
            socket.emit('get_or_create_dm', { friendId: selectedFriend._id });

            // 2. API'den Kanal ID'sini al (Bu ID mesajlaşmak için şart)
            const isProduction = window.location.hostname !== 'localhost';
            const API_URL = isProduction ? "https://konvectra.com" : "http://localhost:5000";

            const res = await fetch(`${API_URL}/api/channels/dm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ myId: currentUser.id, friendId: selectedFriend._id })
            });

            const data = await res.json();
            const realDmRoomId = data.channelId;

            // 3. State'i güncelle ve Odaya gir
            if (realDmRoomId) {
                setDmRoomId(realDmRoomId); // Artık mesaj atabilirsin ✅
                socket.emit("join_dm_room", realDmRoomId); // Odaya katıldın ✅
                fetchMessages(realDmRoomId); // Geçmiş mesajları çektin ✅
                
                console.log(`✅ DM Odasına Girildi: ${selectedFriend.nickname} (ID: ${realDmRoomId})`);
            }

        } catch (error) {
            console.error("DM Bağlantı Hatası:", error);
        }
    };

    initializeDmChannel();

}, [selectedFriend]); // 👈 DİKKAT: Bu useEffect, selectedFriend değiştiği an çalışır.

  // 3. ARKADAŞ BİLGİSİ SENKRONİZASYONU
  useEffect(() => {
      if (selectedFriend) {
          const updatedFriendData = friends.find(f => f._id === selectedFriend._id);
          if (updatedFriendData) {
              setSelectedFriend(prev => {
                  if (prev.nickname !== updatedFriendData.nickname || 
                      prev.avatar !== updatedFriendData.avatar ||
                      prev.status !== updatedFriendData.status) {
                      return updatedFriendData;
                  }
                  return prev;
              });
          }
      }
  }, [friends, selectedFriend, setSelectedFriend]);

  // 4. BÜYÜK PANELİ GÖSTERME MANTIĞI 🧠
  // "Aktif arama var mı?" VE "Bu arama DM mi?" VE "Konuştuğumuz kişi bu mu?"
  const showBigPanel = activeVoiceChannel && 
                       activeVoiceChannel.type === 'dm' && 
                       activeVoiceChannel.friendId === selectedFriend?._id;

  return (
    <div className="flex w-full h-full">
        {/* SOL: HOME SIDEBAR */}
        <HomeSidebar 
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            incomingRequestsCount={incomingRequests.length}
            currentUser={currentUser}
            handleLogout={handleLogout}
            onOpenSettings={onOpenSettings}
            friends={friends}
            onSelectFriend={handleSelectFriend}
            activeFriendId={selectedFriend?._id}
            userPanelContent={userPanelContent}
            voicePanelContent={voicePanelContent}
        />

        {/* ORTA ALAN */}
        <div className="flex-1 bg-[#313338] flex flex-col min-w-0 relative">
            
            {selectedFriend ? (
                // === DM MODU ===
                <div className="flex flex-col h-full w-full">
                    
                    {/* 👇 BÜYÜK PANEL (Sadece showBigPanel true ise görünür) */}
                    {showBigPanel && (
                        <div className="flex-shrink-0 z-20">
                            <VoiceCallPanel 
                                friend={selectedFriend}
                                onEndCall={onEndCall}
                                isMicMuted={isMicMuted}
                                toggleMic={toggleMic}
                                isDeafened={isDeafened}
                                toggleDeafen={toggleDeafen}
                                // Eğer voiceParticipants undefined ise boş dizi gönder
                                participants={voiceParticipants || []}
                                connectionStatus={connectionStatus}
                            />
                            {/* VoiceRoom BURADAN SİLİNDİ (Artık App.jsx'te) */}
                        </div>
                    )}

                    {/* Üst Bar (Sadece Arama Yokken veya Küçük Panel Modundayken Görünür İstersen) */}
                    {/* İstersen showBigPanel varsa burayı gizleyebilirsin, ama genelde kalır. */}
                    {!showBigPanel && (
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
                            onSendMessage={handleSendMessage} 
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
                // === DASHBOARD MODU ===
                <div className="flex-1 bg-[#1A1A1E] p-8 flex flex-col overflow-y-auto">
                    {/* ... Burası senin Dashboard kodların (Aynı kalıyor) ... */}
                    {/* ... (Kodun geri kalanı çok uzun olduğu için burayı kısalttım, senin kodunda zaten var) ... */}
                     
                    {/* Sekme: Arkadaş Ekle */}
                    {activeTab === 'add' && (
                        <div>
                            <h2 className="uppercase font-bold text-[20px] text-white mb-2">Arkadaş Ekle</h2>
                            <div className="text-[15px] text-gray-400 mb-4">Arkadaşının kodunu girerek onu ekleyebilirsin.</div>
                            <div className="flex items-center bg-[#1e1f22] p-2 rounded-lg border border-black focus-within:border-blue-500 transition-colors">
                                <span className="text-gray-400 font-bold text-lg px-2 select-none">#</span>
                                <input 
                                    value={friendInput} 
                                    onChange={e => setFriendInput(e.target.value.toUpperCase().trim())}
                                    maxLength={7}
                                    placeholder="ARKADAŞ KODU" 
                                    className="bg-transparent outline-none flex-1 text-white placeholder-gray-500 font-mono tracking-wider uppercase"
                                />
                                <button 
                                    onClick={handleSendFriendRequest} 
                                    disabled={!friendInput || friendInput.length < 7}
                                    className="bg-[#5865F2] px-4 py-1 rounded text-sm font-bold disabled:cursor-not-allowed text-white hover:bg-[#4752c4] transition ml-2"
                                >
                                    İstek Gönder
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* ... Diğer sekmeler (Pending, Online vb.) senin kodunda zaten var, buraya ekleyebilirsin ... */}
                    {/* Burada kod kalabalığı yapmamak için kestiğim kısımları kendi kodundan alıp yapıştırabilirsin */}
                    {/* ÖNEMLİ: Hata veren yer yukarıdaki return bloğuydu, orayı düzelttim. */}
                    
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