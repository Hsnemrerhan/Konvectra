import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { FaHashtag, FaVolumeUp, FaPlus, FaCog, FaAngleDown, FaMusic, FaMicrophoneSlash } from 'react-icons/fa';

// --- BİLEŞENLER ---
import Sidebar from './components/Layout/Sidebar';
import ChannelList from './components/Layout/ChannelList'; 
import UserProfile from './components/Layout/UserProfile';
import ChatArea from './components/Chat/ChatArea';
import AuthForm from './components/AuthForm';
import CreateServerModal from './components/Modals/CreateServerModal';
import JoinServerModal from './components/Modals/JoinServerModal';
import UserList from './components/Layout/UserList';
import UserSettingsModal from './components/Modals/UserSettingsModal';
import ChannelDeletedModal from './components/Modals/ChannelDeletedModal';
import WelcomeModal from './components/Modals/WelcomeModal';
import FeedbackModal from './components/Modals/FeedbackModal';
import ServerSettingsModal from './components/Modals/ServerSettingsModal';
import KickedModal from './components/Modals/KickedModal';
import IncomingCallModal from './components/Modals/IncomingCallModal';
import ServerWelcome from './components/Server/ServerWelcome';
import CreateChannelModal from './components/Modals/CreateChannelModal';
import HomeView from './components/Home/HomeView';
import VoiceConnectionPanel from './components/Voice/VoiceConnectionPanel';

// 👇 YENİ: LiveKit Bileşeni (Eski VoiceRoom yerine)
import VoiceChannel from './components/Voice/VoiceChannel';

// Localhost mu yoksa Canlı Sunucu mu olduğunu anla
const isProduction = window.location.hostname !== 'localhost';

// Eğer canlıdaysak direkt domaini kullan (Port YOK, https VAR)
// Eğer localdeysek port 5000 kullan
const API_URL = isProduction
    ? "https://konvectra.com"
    : "http://localhost:5000";

const socket = io(API_URL, {
    transports: ["websocket"],
    reconnectionAttempts: 5
});

function App() {
  // --- STATE YÖNETİMİ ---
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || {});
  const navigate = useNavigate();
  const location = useLocation();
  
  // UI States
  const [activeServer, setActiveServer] = useState(null); 
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeVoiceUsers, setActiveVoiceUsers] = useState({}); // { kanalId: [user1, user2] }
  const [activeTab, setActiveTab] = useState('online'); 
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [createModal, setCreateModal] = useState({ isOpen: false, type: 'text' });
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState(null);
  
  // Data States
  const [myServers, setMyServers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true); 
  const [isMessagesLoading, setIsMessagesLoading] = useState(false); 
  const [deletedChannelData, setDeletedChannelData] = useState(null);
  const [welcomeData, setWelcomeData] = useState(null);
  const [kickedData, setKickedData] = useState(null); 
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [allVoiceStates, setAllVoiceStates] = useState({});
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  
  // 🎤 YENİ SES STATE'İ
  // Sadece hangi kanalda olduğumuzu tutuyoruz. Katılımcıları LiveKit hallediyor.
  const [activeVoiceChannel, setActiveVoiceChannel] = useState(null); 

  // Form Inputs
  const [friendInput, setFriendInput] = useState(''); 

  // 👇 MODAL STATE'İ
const [feedback, setFeedback] = useState({
    isOpen: false,
    type: 'success', // success, error, warning
    title: '',
    message: ''
});

// 🎵 SES REFERANSLARI (App.jsx içinde kalıcı olacak)
const dialToneRef = useRef(null);
const hangUpRef = useRef(null);

// Modal Kapatma Yardımcısı
const closeFeedback = () => {
    setFeedback(prev => ({ ...prev, isOpen: false }));
};

  const openCreateModal = (type) => { 
      setCreateModal({ isOpen: true, type }); 
  };

  // Arama Başlatma (HomeView'dan tetiklenecek)
const handleStartDmCall = (friend, roomId) => {
    // Mevcut VoiceChannel bileşeninin beklediği formatta veriyi hazırlıyoruz
    const channelData ={
        _id: roomId,          // 👈 VoiceChannel bunu 'channelId' olarak alacak
        name: friend.nickname || friend.username, // Kanal adı olarak arkadaşın adı
        type: 'dm',           // Bunu UI'da (Panelde) ayrım yapmak için ekliyoruz
        friendId: friend._id,  // Doğru arkadaşın sayfasında mıyız kontrolü için
        avatar: friend.avatar
    };
    console.log("aloooo");
    setActiveVoiceChannel(channelData);
    
    sessionStorage.setItem('activeVoiceSession', JSON.stringify(channelData));
    
    // Bağlantı başladığı için katılımcı listesini sıfırla
    setVoiceParticipants([]);
};

// Ses dosyalarını bir kere yükle
    useEffect(() => {
        dialToneRef.current = new Audio('/sounds/calling.mp3');
        dialToneRef.current.loop = true; // Döngü
        dialToneRef.current.volume = 0.5;

        hangUpRef.current = new Audio('/sounds/hangup.mp3');
        hangUpRef.current.volume = 0.6;
    }, []);

// 🧮 ANLIK BAĞLANTI DURUMUNU HESAPLA
    // Bu mantığı aşağıda hem ses için hem de View'a prop geçmek için kullanacağız
    const connectionStatus = callStatus ? callStatus : 
        (!voiceParticipants ? 'connecting' : 
         voiceParticipants.length <= 1 ? 'waiting' : 'connected');

// 🔊 GLOBAL SES YÖNETİMİ (Sayfa değişse de çalışır)
    useEffect(() => {
        const handleGlobalSound = async () => {
            // Eğer aktif bir ses kanalı yoksa sesleri sustur (Garanti olsun)
            if (!activeVoiceChannel) {
                dialToneRef.current?.pause();
                return;
            }

            // Sadece DM görüşmelerinde çalma sesi olur
            if (activeVoiceChannel.type === 'dm') {
                try {
                    // A) ARIYORSAK (Waiting / Connecting)
                    if (connectionStatus === 'waiting' || connectionStatus === 'connecting') {
                        if (dialToneRef.current.paused) {
                            await dialToneRef.current.play();
                        }
                    } 
                    
                    // B) BAĞLANDIYSAK (Connected)
                    else if (connectionStatus === 'connected') {
                        dialToneRef.current.pause();
                        dialToneRef.current.currentTime = 0;
                    }

                    // C) REDDEDİLDİ / KAPANDI / CEVAP YOK
                    else if (['rejected', 'missed', 'ended', 'busy'].includes(connectionStatus)) {
                        // Çalıyor sesini durdur
                        dialToneRef.current.pause();
                        dialToneRef.current.currentTime = 0;

                        // Kapanma sesini çal (Sadece 1 kere)
                        // Çakışmayı önlemek için basit bir kontrol
                        if (hangUpRef.current.paused) {
                            await hangUpRef.current.play();
                        }
                    }
                } catch (error) {
                    console.warn("Ses oynatma hatası:", error);
                }
            }
        };

        handleGlobalSound();

    }, [connectionStatus, activeVoiceChannel]);

  useEffect(() => {
    // Sunucudan gelen ses durumu güncellemesini dinle
    socket.on('voice-state-update', (currentVoiceState) => {
        setActiveVoiceUsers(currentVoiceState);
    });

    return () => {
        socket.off('voice-state-update');
    };
}, []);
  
  // --- AKILLI YÖNLENDİRME (ROUTING) ---
  // --- AKILLI YÖNLENDİRME VE STATE SENKRONİZASYONU ---
useEffect(() => {
    // 1. Veriler yüklenmeden işlem yapma (Hata almamak için)
    if (!friends || !myServers) return; 

    const path = location.pathname;
    const parts = path.split('/'); // Örn: ["", "servers", "123", ...]

    // --- SENARYO 1: DM SAYFASI (/dm/Kod) ---
    if (path.startsWith('/dm/')) {
        const urlCode = parts[2];
        const targetFriend = friends.find(f => f.friendCode === urlCode);
        
        if (targetFriend) {
            // Eğer o an başka bir yerdeysek (Sunucu veya başka arkadaş), buraya geç
            if (activeServer || selectedFriend?._id !== targetFriend._id) {
                setActiveServer(null);           // Sunucudan çık
                setSelectedFriend(targetFriend); // Arkadaşı seç
            }
        }
    } 
    
    // ... SENARYO 2: SUNUCU KISMI (GÜNCELLENMİŞ) ...
    // ... SENARYO 2: SUNUCU KISMI (GÜNCELLENMİŞ OTOMATİK KANAL SEÇİMİ) ...
    else if (path.startsWith('/servers/') && !path.includes('@me')) {
        const urlServerId = parts[2];
        const urlChannelId = parts[4]; // URL'deki kanal ID'si (varsa)

        const targetServer = myServers.find(s => s._id === urlServerId);

        if (targetServer) {
            // 1. Sunucuyu Aktif Et
            if (activeServer?._id !== targetServer._id) {
                setSelectedFriend(null);       // DM'i kapat
                setActiveServer(targetServer); // Sunucuyu aç
            }

            // 2. Hangi Kanalı Açacağız?
            let targetChannel = null;

            if (urlChannelId) {
                // A) URL'de kanal ID'si varsa onu bul
                if (targetServer.channels) {
                    targetChannel = targetServer.channels.find(c => c._id === urlChannelId);
                }
            } else {
                // B) URL'de kanal yoksa, LİSTENİN İLK KANALINI seç (Default Channel)
                const firstTextChannel = targetServer.channels?.find(c => c.type === 'text');

                if (firstTextChannel) {
                    // Metin kanalı varsa ONA git
                    navigate(`/servers/${targetServer._id}/channels/${firstTextChannel._id}`, { replace: true });
                } else {
                    // 🚨 Metin kanalı YOKSA -> WELCOME sayfasına git
                    console.log("Metin kanalı bulunamadı, Welcome sayfasına yönlendiriliyor.");
                    
                    // Kanal seçimini temizle (Chat ekranı açılmasın)
                    // setActiveChannel(null); 
                    
                    navigate(`/servers/${targetServer._id}/welcome`, { replace: true });
                }
            }

            // 3. Kanalı State'e Yaz (Eğer App.jsx'te böyle bir state varsa)
            if (targetChannel) {
                // Eğer kodunda setActiveChannel veya setActiveTextChannel varsa burayı ona göre düzenle:
                setActiveChannel(targetChannel); 
                
                // Opsiyonel: URL'i de kanallı hale getir ki tam olsun (/servers/ID/channels/KANAL_ID)
                if (!urlChannelId) {
                    navigate(`/servers/${targetServer._id}/channels/${targetChannel._id}`, { replace: true });
                }
            }
        } 
    }

    // --- SENARYO 3: DASHBOARD SEKMELERİ (/servers/@me/...) ---
    else if (path.startsWith('/servers/@me')) {
        // DM ve Sunucu seçimini temizle (Dashboard açılsın)
        if (selectedFriend || activeServer) {
            setSelectedFriend(null);
            setActiveServer(null);
        }

        // Sekmeyi ayarla
        if (path.includes('/online-friends')) setActiveTab('online');
        else if (path.includes('/friends')) setActiveTab('all');
        else if (path.includes('/friend-requests')) setActiveTab('pending');
        else if (path.includes('/add-friend')) setActiveTab('add');
        else {
             setActiveTab('online');
        }
    }
    
    // --- SENARYO 4: Ana Kök (/) ---
    else if (path === '/') {
         navigate('/servers/@me/online-friends', { replace: true });
    }

}, [location.pathname, friends, myServers]); // 👈 myServers EKLENDİ!

  useEffect(() => {
      if (activeChannel && activeChannel._id) {
          setMessages([]); 
          setHasMoreMessages(true);
          fetchMessages(activeChannel._id);
      }
  }, [activeChannel?._id]); 

  useEffect(() => {
    socket.on('dm_channel_loaded', (channel) => {
        // 3. Backend kanalı buldu ve gönderdi.
        // ARTIK BU KANALI AKTİF KANAL YAPIYORUZ! 🚀
        setActiveChannel(channel);
        
        // Önemli: Sunucu modundan çıkıp DM moduna geçtiğimizi belirtelim
        setActiveServer(null); 
    });

    return () => socket.off('dm_channel_loaded');
}, []);

  // --- DATA FETCHING & SOCKET ---
  useEffect(() => {
    if (token && currentUser.id) {
      fetchUserData();
      
      // Socket'e kim olduğunu bildir (Online status için)
      socket.emit('register_socket', currentUser.id);

      socket.on('chat_message', (msg) => {setMessages(prev => [...prev, msg]);});

      socket.on('new_friend_request', (senderUser) => {
          setIncomingRequests(prev => {
              if (prev.find(req => req._id === senderUser._id)) return prev;
              return [...prev, senderUser];
          });
      });

      socket.on('friend_request_accepted', (newFriend) => {
          setFriends(prev => [...prev, newFriend]);
          setIncomingRequests(prev => prev.filter(req => req._id !== newFriend._id));
      });

      socket.on('user_updated', (updatedUser) => {
          const currentUserId = JSON.parse(localStorage.getItem('user'))?._id; 
          if (updatedUser._id === currentUserId) {
              const freshMe = { ...updatedUser, id: updatedUser._id };
              setCurrentUser(freshMe);
              localStorage.setItem('user', JSON.stringify(freshMe));
          }
          setFriends(prev => prev.map(f => f._id === updatedUser._id ? updatedUser : f));
          setIncomingRequests(prev => prev.map(req => req._id === updatedUser._id ? updatedUser : req));

          setActiveServer(prevServer => {
              if (!prevServer) return null;
              const isMember = prevServer.members.some(m => m.user._id === updatedUser._id);
              if (!isMember) return prevServer;
              return {
                  ...prevServer,
                  members: prevServer.members.map(member => {
                      if (member.user._id === updatedUser._id) {
                          return { ...member, user: updatedUser };
                      }
                      return member;
                  })
              };
          });

        setMessages(prevMessages => prevMessages.map(msg => {
            const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
            if (senderId === updatedUser._id) {
                if (typeof msg.sender === 'object') {
                    return { ...msg, sender: { ...msg.sender, avatar: updatedUser.avatar, nickname: updatedUser.nickname } };
                }
                return msg;
            }
            return msg;
        }));
      });

      socket.on('channel_deleted', ({ channelId, serverId, channelName, deleterName }) => {
          setMyServers(prevServers => prevServers.map(server => {
              if (server._id === serverId) {
                  return { ...server, channels: server.channels.filter(c => c._id !== channelId) };
              }
              return server;
          }));

          setActiveServer(prevServer => {
              if (prevServer && prevServer._id === serverId) {
                  return { ...prevServer, channels: prevServer.channels.filter(c => c._id !== channelId) };
              }
              return prevServer;
          });

          const currentPath = window.location.pathname; 
          if (currentPath.includes(channelId)) {
             setDeletedChannelData({ channelName, deleterName, serverId });
          }
      });

      socket.on('channel_created', (newChannel) => {
          setMyServers(prevServers => prevServers.map(server => {
              if (server._id === newChannel.serverId) {
                  return { ...server, channels: [...(server.channels || []), newChannel] };
              }
              return server;
          }));

          setActiveServer(prevServer => {
              if (prevServer && prevServer._id === newChannel.serverId) {
                  return { ...prevServer, channels: [...(prevServer.channels || []), newChannel] };
              }
              return prevServer;
          });
      });

      socket.on('member_kicked', ({ serverId, serverName, kickerName }) => {
          setMyServers(prev => prev.filter(s => s._id !== serverId));
          if (window.location.pathname.includes(serverId)) {
              setActiveServer(null); 
              navigate('/servers/@me'); 
          }
          setKickedData({ serverName, kickerName });
          fetch(`${API_URL}/api/users/${currentUser.id}/notifications`, { method: 'DELETE' });
      });

      socket.on('server_updated', (updatedServer) => {
          setMyServers(prev => prev.map(s => s._id === updatedServer._id ? updatedServer : s));
          setActiveServer(prev => {
              if (prev && prev._id === updatedServer._id) {
                  return updatedServer;
              }
              return prev;
          });
      });

      socket.on('voice_state_update', (data) => {
            console.log("Ses kanalları güncellendi:", data);
            setAllVoiceStates(data);
        });

        // 📞 Biri seni aradığında
        socket.on("incoming_call", (data) => {
            console.log("📞 Arama Geliyor:", data.caller.nickname);
            setIncomingCall(data);
        });

        // ❌ Arayan kişi vazgeçerse (Opsiyonel: Modal kapansın)
        socket.on("call_cancelled", () => {
            setIncomingCall(null);
        });

        // ❌ 1. KARŞI TARAF REDDEDERSE
        socket.on("call_rejected", () => {
            console.log("❌ Arama reddedildi.");
            setCallStatus('rejected'); // Ekrana "Reddedildi" yazdıracağız

            // 2 saniye mesajı göster, sonra kapat
            setTimeout(() => {
                handleManualDisconnect(); // Kapatma fonksiyonun
                setCallStatus(null);      // State'i temizle
            }, 3000);
        });

        // ⏳ 2. ZAMAN AŞIMI / CEVAP VERİLMEDİ
        socket.on("call_missed", () => {
            console.log("⏳ Cevap verilmedi.");
            setCallStatus('missed'); // Ekrana "Cevap Verilmedi" yazdıracağız

            setTimeout(() => {
                handleManualDisconnect();
                setCallStatus(null);
            }, 3000);
        });

        socket.on("call_ended", () => {
        console.log("🏁 Karşı taraf aramayı sonlandırdı.");
        setCallStatus('ended'); // Ekrana "Sonlandırıldı" yazacağız

        // 2 Saniye mesajı göster sonra at
        setTimeout(() => {
            handleManualDisconnect(); // Bizim tarafı da kapat
            setCallStatus(null);
        }, 3000);
    });

      // 🗑️ TEMİZLENEN SOCKET EVENTLERİ: 
      // 'user_speaking_change', 'all_voice_states', 'voice_channel_state', 'music_command'
      // Bunlar artık LiveKit veya backend'in yeni yapısı tarafından yönetilecek.
    }

    return () => {
        socket.off('chat_message');
        socket.off('new_friend_request');      
        socket.off('friend_request_accepted'); 
        socket.off('user_updated');
        socket.off('channel_deleted');
        socket.off('channel_created');
        socket.off('server_updated');
        socket.off('member_kicked');
        socket.off('voice_state_update');
        socket.off("incoming_call");
        socket.off("call_cancelled");
        socket.off("call_rejected");
        socket.off("call_missed");
        socket.off("call_ended");
    };
  }, [token, currentUser.id]);

  // ⏳ ARAMA ZAMAN AŞIMI YÖNETİMİ
    useEffect(() => {
        let timer;
        if (incomingCall) {
            timer = setTimeout(() => {
                // Süre doldu
                console.log("⏳ Arama zaman aşımına uğradı.");
                socket.emit("call_timeout", { toUserId: incomingCall.caller._id });
                setIncomingCall(null); // Modalı kapat
            }, 30000); // 30 Saniye
        }
        return () => clearTimeout(timer); // Kullanıcı cevap verirse sayacı iptal et
    }, [incomingCall]);

    // ✅ ARAMAYI KABUL ET
    const handleAcceptCall = () => {
        if (!incomingCall) return;

        const { caller, roomId, friendCode } = incomingCall;

        // 1. Modalı kapat
        setIncomingCall(null);

        // 2. Sayfayı yönlendir (Router yapına göre)
        // Eğer zaten o sayfadaysan sorun yok, değilsen git
        navigate(`/dm/${friendCode}`); 
        
        // 3. UI Ayarları (Arkadaşı seç, sunucudan çık)
        const friend = friends.find(f => f._id === caller._id);
        if (friend) setSelectedFriend(friend);
        setActiveServer(null);

        // 4. Ses kanalına bağlan (Mevcut mantığın)
        handleStartDmCall(friend || caller, roomId); 
    };

    // ❌ ARAMAYI REDDET
    const handleDeclineCall = () => {
        if (!incomingCall) return;

        // Arayana "Reddedildi" bilgisini gönder
        socket.emit("reject_call", { toUserId: incomingCall.caller._id });
        setIncomingCall(null);
    };

  // 🔄 URL -> STATE EŞLEŞTİRMESİ (F5 atınca çalışır)
    useEffect(() => {
        // 1. Arkadaşlar yüklenmeden işlem yapma
        if (!friends || friends.length === 0) return;

        const path = location.pathname;

        // SENARYO 1: URL "/dm/X92K1" formatındaysa
        if (path.startsWith('/dm/')) {
            const urlCode = path.split('/')[2]; // "X92K1" kısmını al

            const targetFriend = friends.find(f => f.friendCode === urlCode);

            if (targetFriend) {
                // Eğer farklı bir yerdeysek veya arkadaş seçili değilse güncelle
                if (activeServer || selectedFriend?._id !== targetFriend._id) {
                    console.log("🔗 URL'den arkadaşa gidiliyor:", targetFriend.nickname);
                    
                    setActiveServer(null); // Sunucudan çık (Home'a geç)
                    setSelectedFriend(targetFriend); // Arkadaşı seç
                }
            } 
        }
        
        // SENARYO 2: URL sadece "/" ise (Dashboard)
        else if (path === '/') {
            if (selectedFriend || activeServerId) {
                setActiveServer(null);
                setSelectedFriend(null);
            }
        }

    }, [location.pathname, friends]); // URL veya Liste değişince çalışır

// 🔄 F5 SONRASI OTOMATİK BAĞLANMA (GÜNCELLENMİŞ)
useEffect(() => {
    // 1. Hafızadaki veriyi JSON olarak oku
    const savedSessionStr = sessionStorage.getItem('activeVoiceSession');

    if (savedSessionStr && !activeVoiceChannel) {
        try {
            const savedChannel = JSON.parse(savedSessionStr);

            // === SENARYO A: DM ARAMASIYSA ===
            // Sunucu listesinin yüklenmesini beklemeye gerek yok, direkt bağlan.
            if (savedChannel.type === 'dm') {
                console.log(`🔄 DM'ye tekrar bağlanılıyor: ${savedChannel.name}`);
                setActiveVoiceChannel(savedChannel);
            } 
            
            // === SENARYO B: SUNUCU KANALIYSA ===
            // Senin mevcut güvenlik kontrolünü (MyServers) burada yapıyoruz
            else {
                // Sunucular yüklenmediyse bekle
                if (!myServers || myServers.length === 0) return;

                let foundChannel = null;
                // Senin yazdığın döngü mantığı aynen kalıyor
                for (const server of myServers) {
                    if (server.channels) {
                        const channel = server.channels.find(c => c._id === savedChannel._id);
                        if (channel) {
                            foundChannel = { ...channel, type: 'server' }; // Type eklemeyi unutma
                            break;
                        }
                    }
                }

                if (foundChannel) {
                    console.log(`🔄 Sunucu kanalına tekrar bağlanılıyor: ${foundChannel.name}`);
                    setActiveVoiceChannel(foundChannel);
                } else {
                    // Kanal artık yoksa veya yetki gittiyse temizle
                    sessionStorage.removeItem('activeVoiceSession');
                }
            }

        } catch (e) {
            console.error("Session parse hatası:", e);
            sessionStorage.removeItem('activeVoiceSession');
        }
    }
}, [myServers]); // myServers değişince tekrar dener (Sadece sunucular için önemlidir)

useEffect(() => {
   if(activeServer != null){
    document.title = `Konvectra | ${activeServer.name}`;
   }
   else document.title = "Konvectra";
}, [activeServer]);

useEffect(() => {
    if (!token && location.pathname !== '/') {
      // "Geçmişe bir şey eklemeden sadece şu anki URL'i '/' olarak değiştir"
      window.history.replaceState(null, '', '/');
    }
  }, [token, location.pathname]);

useEffect(() => {
    // 1. Dinleyiciyi tanımla
    const handleVoiceUpdate = (data) => {
        console.log("Ses odaları güncellendi:", data); // Debug için log
        setAllVoiceStates(data);
    };

    // 2. Event'e abone ol
    socket.on('voice-state-update', handleVoiceUpdate);

    // 3. Cleanup (Temizlik)
    return () => {
        socket.off('voice-state-update', handleVoiceUpdate);
    };
}, []);

  const fetchUserData = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      const userId = storedUser?.id || storedUser?._id;
      if (!userId) return;

      const res = await fetch(`${API_URL}/api/users/me?userId=${userId}`);

      // Eğer sunucu "404 (Bulunamadı)" veya "401 (Yetkisiz)" derse:
      if (res.status === 404 || res.status === 401) {
          console.warn("⚠️ Kullanıcı veritabanında bulunamadı. Oturum kapatılıyor...");
          
          // Temizlik yap
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('lastServer'); // Varsa bunu da sil
          
          setCurrentUser(null);
          
          // Sayfayı zorla yenileyerek ana sayfaya (Login'e) at
          window.location.href = '/'; 
          return;
      }
      // Diğer hatalar için kontrol
      if (!res.ok) throw new Error('Veri çekme hatası');
      const data = await res.json();
      
      setMyServers(data.servers);
      setFriends(data.user.friends || []);
      setIncomingRequests(data.user.incomingRequests || []);

      const freshUser = { ...data.user, id: data.user._id };
      setCurrentUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));

      if (activeServer) {
          const updatedActiveServer = data.servers.find(s => s._id === activeServer._id);
          if (updatedActiveServer) {
              setActiveServer(updatedActiveServer);
          } else {
              setActiveServer(null);
          }
      }

      if (data.user.notifications && data.user.notifications.length > 0) {
          const kickNotif = data.user.notifications.find(n => n.type === 'kick');
          if (kickNotif) {
              setKickedData({ serverName: kickNotif.serverName, kickerName: kickNotif.kickerName });
              await fetch(`${API_URL}/api/users/${userId}/notifications`, { method: 'DELETE' });
          }
      }
    } catch (err) { console.error(err); }
  };

  const fetchMessages = async (channelId, beforeDate = null) => {
    if (!channelId) return;
    setIsMessagesLoading(true);
    try {
        let url = `${API_URL}/api/messages/${channelId}`;
        if (beforeDate) url += `?before=${beforeDate}`;
        const res = await fetch(url);
        const newMessages = await res.json();

        if (beforeDate) setMessages(prev => [...newMessages, ...prev]);
        else setMessages(newMessages);

        if (newMessages.length < 30) setHasMoreMessages(false);
        else setHasMoreMessages(true);
    } catch (err) { console.error(err); } 
    finally { setIsMessagesLoading(false); }
 };

  // --- HANDLERS ---

  // 👇 GİRİŞ YAPMA FONKSİYONU
const handleLogin = async (username, password) => {
    setIsAuthLoading(true); // Yükleniyor başlat
    try {
        const res = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (res.ok) {
            // ✅ BAŞARILI
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setCurrentUser(data.user);
            setToken(data.token);
            
            // Başarılı Modalı (Opsiyonel, direkt geçiş de yapabilirsin ama şık durur)
            setFeedback({
                isOpen: true,
                type: 'success',
                title: 'Giriş Başarılı!',
                message: (
                    <span>
                        Tekrar hoş geldin, <span className="font-bold text-white">{data.user.nickname}</span>.
                    </span>
                    )
            });

        } else {
            // ❌ HATA (Kullanıcı yok, şifre yanlış vb.)
            setFeedback({
                isOpen: true,
                type: 'error',
                title: 'Giriş Başarısız',
                message: data.message || 'Kullanıcı adı veya şifre hatalı.'
            });
        }
    } catch (error) {
        setFeedback({
            isOpen: true,
            type: 'error',
            title: 'Sunucu Hatası',
            message: 'Sunucuya bağlanılamadı. Lütfen daha sonra tekrar dene.'
        });
    } finally {
        setIsAuthLoading(false); // Yükleniyor durdur
    }
};

// 👇 KAYIT OLMA FONKSİYONU
const handleRegister = async (username, password, nickname) => {
    setIsAuthLoading(true);
    try {
        const res = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, nickname }),
        });
        const data = await res.json();

        if (res.ok) {
            // ✅ BAŞARILI
            setFeedback({
                isOpen: true,
                type: 'success',
                title: 'Hesap Oluşturuldu!',
                message: (
                    <span>
                        Hesabın başarıyla açıldı. Arkadaş kodun: <span className="font-bold text-white">#{data.friendCode}</span>. Şimdi giriş yapabilirsin.
                    </span>
                )
            });
            return true; // ✅ BAŞARILI OLDUĞUNU DÖNDÜR
        } else {
            // ❌ HATA (Kullanıcı adı dolu vb.)
            setFeedback({
                isOpen: true,
                type: 'warning',
                title: 'Kayıt Yapılamadı',
                message: data.message || 'Bu kullanıcı adı zaten alınmış.'
            });
        }
    } catch (error) {
        setFeedback({
            isOpen: true,
            type: 'error',
            title: 'Bağlantı Hatası',
            message: 'Kayıt işlemi sırasında bir sorun oluştu.'
        });
    } finally {
        setIsAuthLoading(false);
    }
};

  const handleLogout = () => {
      localStorage.clear();
      window.location.href = '/';
  };

  const handleSendMessage = (messageData) => {
    if (!activeChannel) return;

    // messageData şunları içeriyor: { content: "...", attachmentUrl: "...", attachmentType: "..." }
    
    socket.emit('chat_message', { 
        username: currentUser.username, 
        channelId: activeChannel._id,
        voiceChannelId: activeVoiceChannel ? activeVoiceChannel._id : null,
        
        // 👇 ESKİSİ: content,
        // 👇 YENİSİ: Gelen tüm veriyi (yazı, dosya url, dosya tipi) buraya yayıyoruz:
        ...messageData 
    });
    };

  // --- LIVEKIT SES HANDLERS ---

  // Ses kanalından ayrılma
  const handleLeaveVoice = () => {
        setActiveVoiceChannel(null);
        setVoiceParticipants([]);
        socket.emit('leave-voice-channel', currentUser._id);
    };

  const handleManualDisconnect = () => {
    console.log("👋 Kullanıcı kendi isteğiyle ayrıldı.");
    
    // Sadece DM ise kontrol et (Sunucu kanallarında herkes özgürce girip çıkabilir)
    if (activeVoiceChannel?.type === 'dm' && activeVoiceChannel.friendId) {
        
        // SENARYO 1: Henüz kimse açmadıysa (İPTAL ET)
        if (!voiceParticipants || voiceParticipants.length <= 1) {
            
            socket.emit("cancel_call", { toUserId: activeVoiceChannel.friendId });
        } 
        
        // SENARYO 2: Zaten konuşuyorsak (GÖRÜŞMEYİ SONLANDIR) 🛑 YENİ KISIM
        else {
            console.log("ended");
            
            socket.emit("end_call", { toUserId: activeVoiceChannel.friendId });
        }
    }
    // Önce hafızadan sil, sonra state'i temizle
    sessionStorage.removeItem('activeVoiceSession');
    handleLeaveVoice();
  };

  // Ses kanalına katılma
  // App.jsx içinde

const handleJoinVoice = (channel) => {
    // 1. Eğer zaten tıkladığımız kanaldaysak hiçbir şey yapma
    if (activeVoiceChannel && activeVoiceChannel._id === channel._id) {
        return;
    }

    // Kanal değiştirme veya yeni girme mantığı
    if (activeVoiceChannel) {
        handleLeaveVoice(); // Önce eskiden çık
        setTimeout(() => {
            setActiveVoiceChannel(channel);
            // 👇 YENİ: Hafızaya kaydet
            sessionStorage.setItem('activeVoiceSession', JSON.stringify(channel));
        }, 150);
    } else {
        setActiveVoiceChannel(channel);
        // 👇 YENİ: Hafızaya kaydet
        sessionStorage.setItem('activeVoiceSession', JSON.stringify(channel));
    }
    socket.emit('join-voice-channel', {
        channelId: channel._id,
        user: {
            _id: currentUser._id,
            username: currentUser.username,
            nickname: currentUser.nickname,
            avatar: currentUser.avatar
        }
    });
};

  // --- DİĞER HANDLERS ---
  
  const handleCreateServer = async (name) => {
    const res = await fetch(`${API_URL}/api/servers/create`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, ownerId: currentUser.id })
    });
    const newServer = await res.json();
    setMyServers([...myServers, newServer]); 
    setShowCreateModal(false);
    navigate(`/servers/${newServer._id}/welcome`);
  };

  const handleJoinServer = async (serverId) => {
    try {
        const res = await fetch(`${API_URL}/api/servers/join`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ serverId, userId: currentUser.id })
        });
        const data = await res.json();
        if(res.ok) {
            await fetchUserData(); 
            setShowJoinModal(false);
            navigate(`/servers/${serverId}`);
            setWelcomeData({ serverName: data.server.name });
        } else { alert("Hata: " + data.message); }
    } catch (err) { console.error(err); alert("Hata oluştu."); }
  };

  const handleUpdateServer = async (serverId, updates) => {
      const res = await fetch(`${API_URL}/api/servers/${serverId}`, {
          method: 'PUT', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ ...updates, userId: currentUser.id })
      });
      if(res.ok) { fetchUserData();}
  };

  const handleCreateRole = async (serverId, name, color) => {
      const res = await fetch(`${API_URL}/api/servers/${serverId}/roles`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ name, color, userId: currentUser.id })
      });
      if(res.ok) fetchUserData();
  };

  const handleKickMember = async (serverId, memberId) => {
      const res = await fetch(`${API_URL}/api/servers/${serverId}/members/${memberId}`, {
          method: 'DELETE', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ userId: currentUser.id })
      });
      if(res.ok) fetchUserData();
  };

  const handleServerDeleted = (deletedServerId) => {
    // Listeden çıkar
    setMyServers(prev => prev.filter(s => s._id !== deletedServerId));
    // Aktif sunucuyu sıfırla
    setActiveServer(null);
};

  const handleAssignRole = async (serverId, memberId, roleId) => {
      const res = await fetch(`${API_URL}/api/servers/${serverId}/members/${memberId}/roles`, {
          method: 'PUT', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ roleId, userId: currentUser.id })
      });
      if(res.ok) fetchUserData();
  };

  const handleDeleteRole = async (serverId, roleId) => {
      if(!confirm("Emin misin?")) return;
      const res = await fetch(`${API_URL}/api/servers/${serverId}/roles/${roleId}`, {
          method: 'DELETE', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ userId: currentUser.id })
      });
      if(res.ok) fetchUserData();
  };

  const handleCreateChannel = async (serverId, name, type) => {
    const res = await fetch(`${API_URL}/api/channels/create`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ serverId, name, type })
    });
    if(res.ok) fetchUserData();
  };

  const handleDeleteChannel = async (channelId) => {
      const res = await fetch(`${API_URL}/api/channels/${channelId}`, { 
          method: 'DELETE',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ userId: currentUser.id }) 
      });
      if(res.ok) fetchUserData(); 
  };

  const handleRenameChannel = async (channelId, newName) => {
    const res = await fetch(`${API_URL}/api/channels/${channelId}`, {
        method: 'PUT', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name: newName })
    });
    if(res.ok) fetchUserData(); 
  };

  const handleCloseDeletedModal = () => {
      if (deletedChannelData) {
          navigate(`/servers/${deletedChannelData.serverId}`);
          setDeletedChannelData(null); 
      }
  };

  const handleSendFriendRequest = async () => {
    const res = await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ senderId: currentUser.id, targetCode: friendInput })
    });
    const data = await res.json();
    if (res.ok) {
        // ✅ BAŞARILI DURUMU
        setFeedback({
            isOpen: true,
            type: 'success',
            title: 'İstek Gönderildi!',
            message: (
                <span>
                    <span className="font-bold text-white">{data.nickname}</span> kullanıcısına arkadaşlık isteği başarıyla iletildi.
                </span>
            )
        });
        setFriendInput(''); // Inputu temizle
    } else {
        // ❌ API'DEN GELEN HATALAR
        let errorTitle = 'Hata Oluştu';
        let errorType = 'error';

        // Backend mesajına göre özelleştirme
        if (data.message.includes('not found')) {
            errorTitle = 'Kullanıcı Bulunamadı 🔍';
        } else if (data.message.includes('already')) {
            errorTitle = 'Zaten Arkadaşsınız 🤝';
            errorType = 'warning';
        } else if (data.message.includes('self')) {
            errorTitle = 'Kendini Ekleyemezsin. Başka Birini Dene 😅';
        }

        setFeedback({
            isOpen: true,
            type: errorType,
            title: errorTitle,
            message: data.message || 'Bir şeyler ters gitti.'
        });
    }
    setFriendInput('');
 };

 const handleAcceptFriend = async (requesterId) => {
     await fetch(`${API_URL}/api/friends/accept`, {
         method: 'POST', headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ userId: currentUser.id, requesterId })
     });
     fetchUserData();
 };

 const handleUpdateUser = async (updates) => {
    try {
        const res = await fetch(`${API_URL}/api/users/${currentUser.id}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(updates)
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.message);

        const updatedUser = { ...currentUser, ...data, id: data._id };
        setCurrentUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setShowSettingsModal(false); 
    } catch (err) { alert(err.message); }
  };

  // 👇 Mikrofon Aç/Kapa Mantığı
const toggleMic = () => {
    // Eğer sağırlaştırılmışsak mikrofonu açamayız
    if (isDeafened) return; 
    setIsMicMuted(!isMicMuted);
};

// 👇 Sağırlaştır Aç/Kapa Mantığı
const toggleDeafen = () => {
    const newDeafenState = !isDeafened;
    setIsDeafened(newDeafenState);

    // Eğer sağırlaştırıldıysa, mikrofonu da zorla kapat
    if (newDeafenState) {
        setIsMicMuted(true);
    }
    // Not: Sağırlaştırma kapanınca mikrofon kapalı kalsın (Discord mantığı)
};


const userPanelContent = (
    <UserProfile 
        currentUser={currentUser}
        onOpenSettings={() => setShowSettingsModal(true)} 
        isMicMuted={isMicMuted}
        toggleMic={toggleMic}
        isDeafened={isDeafened}
        toggleDeafen={toggleDeafen}
    />
);

// 1. KONTROL: Şu an aktif konuştuğumuz kişinin sayfasında mıyız?
// ID'leri String'e çevirerek karşılaştırıyoruz ki hata olmasın.
const isViewingActiveDm = 
    activeVoiceChannel?.type === 'dm' && 
    !activeServer && 
    String(selectedFriend?._id) === String(activeVoiceChannel.friendId);

// 2. PANEL İÇERİĞİ
const voicePanelContent = (activeVoiceChannel && !isViewingActiveDm) ? (
    <VoiceConnectionPanel 
        // Kanal İsmi (Arkadaşın Adı)
        channelName={activeVoiceChannel.name}
        
        // Sunucu İsmi (DM ise "Direkt Görüşme", değilse Sunucu Adı)
        serverName={activeVoiceChannel.type === 'dm' ? "Direkt Görüşme" : "Sunucu Kanalı"}
        
        onDisconnect={handleManualDisconnect}
    />
) : null;

  // --- RENDER ---

  if (!token) {
    return (
      <>
        <AuthForm 
            onLogin={handleLogin} 
            onRegister={handleRegister} 
            isLoading={isAuthLoading} // Loading prop'unu gönderdik
        />
        {/* Auth ekranındayken de modalın çalışması için buraya ekliyoruz */}
        <FeedbackModal 
            isOpen={feedback.isOpen}
            onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
            type={feedback.type}
            title={feedback.title}
            message={feedback.message}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen font-sans text-gray-100 overflow-hidden bg-[#313338]">
      
      {/* SOL MENÜ (Server List) */}
      <Sidebar 
        myServers={myServers}
        activeServer={activeServer}
        setShowCreateModal={setShowCreateModal}
        setShowJoinModal={setShowJoinModal}
      />

      {/* İÇERİK ALANI */}
      <div className="flex flex-1 min-w-0">
        
        {activeServer ? (
            // === SERVER GÖRÜNÜMÜ ===
            <>
                <div className="w-[18%] min-w-[192px] bg-[#121214] flex flex-col flex-shrink-0 relative h-full">
                    {/* 1. SUNUCU BAŞLIĞI */}
                    <div className="h-12 flex items-center justify-between px-4 font-bold shadow-sm text-white cursor-pointer transition border-b border-[#1f2023] group flex-shrink-0">
                        <span className="truncate">{activeServer.name}</span>
                        <FaCog 
                            className="text-gray-400 hover:text-white transition cursor-pointer" 
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowServerSettings(true);
                            }}
                            title="Sunucu Ayarları"
                        />
                    </div>
                    {
                    /* Orta Sol: Kanal Listesi + Profil */}
                    <ChannelList 
                        serverName={activeServer.name}
                        channels={activeServer.channels || []} 
                        currentUser={currentUser}
                        handleLogout={handleLogout}
                        isMicMuted={isMicMuted}
                        toggleMic={toggleMic}
                        isDeafened={isDeafened}
                        toggleDeafen={toggleDeafen}
                        onCreateChannel={handleCreateChannel}
                        onDeleteChannel={handleDeleteChannel}
                        onRenameChannel={handleRenameChannel}
                        activeChannelId={activeChannel?._id}
                        serverId={activeServer._id}
                        onOpenSettings={() => setShowSettingsModal(true)}
                        onOpenServerSettings={() => setShowServerSettings(true)}
                        voiceParticipants={voiceParticipants}
                        
                        // LiveKit Ses Mantığı 👇
                        onJoinVoice={handleJoinVoice}
                        activeVoiceChannel={activeVoiceChannel} 
                        onLeaveVoice={handleManualDisconnect}
                        allVoiceStates={activeVoiceUsers}
                        
                        
                        
                        onOpenCreateChannel={openCreateModal}
                    />
                    {/* 4. YEŞİL SES PANELİ (Bağlantı Kurulunca Çıkar) */}
                    {activeVoiceChannel && (
                        voicePanelContent
                    )}
                    {/* 5. KULLANICI PROFİLİ */}
                    {userPanelContent}
                </div>
                
                
                {location.pathname.includes('/welcome') ? (
                    <ServerWelcome server={activeServer} onOpenCreateChannel={openCreateModal} />
                ) : (
                    <ChatArea 
                        messages={messages} 
                        currentUser={currentUser} 
                        onSendMessage={handleSendMessage} 
                        activeChannelName={activeChannel ? activeChannel.name : 'Seçim Yok'}
                        activeChannelId={activeChannel ? activeChannel._id : null}
                        onLoadMore={() => fetchMessages(activeChannel._id, messages[0]?.timestamp)}
                        hasMore={hasMoreMessages}
                        isLoading={isMessagesLoading}
                    />
                )}

                <UserList 
                    users={activeServer.members || []} 
                    roles={activeServer.roles || []}
                    ownerId={activeServer.owner}
                    type="server"
                />
            </>
        ) : (
            // === HOME GÖRÜNÜMÜ ===
            <HomeView 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                incomingRequests={incomingRequests}
                friends={friends}
                currentUser={currentUser}
                userPanelContent={userPanelContent}
                handleLogout={handleLogout}
                onOpenSettings={() => setShowSettingsModal(true)}
                friendInput={friendInput}
                setFriendInput={setFriendInput}
                voicePanelContent={voicePanelContent}
                handleSendFriendRequest={handleSendFriendRequest}
                handleAcceptFriend={handleAcceptFriend}
                socket={socket}
                onSendMessage={(content, channelId) => {
                    socket.emit('chat_message', { username: currentUser.username, content, channelId });
                }}
                messages={messages}
                fetchMessages={fetchMessages}
                handleSendMessage={handleSendMessage}
                selectedFriend={selectedFriend}
                setSelectedFriend={setSelectedFriend}
                onStartDmCall={handleStartDmCall} 
                onEndCall={handleManualDisconnect}
                activeVoiceChannel={activeVoiceChannel}
                isMicMuted={isMicMuted}
                toggleMic={toggleMic}       // Fonksiyonu direkt veriyoruz
                isDeafened={isDeafened}
                toggleDeafen={toggleDeafen}
                connectionStatus={connectionStatus}
            />
        )}
      </div>

      {/* 🔥 3. GLOBAL SES YÖNETİCİSİ (Hepsinden Bağımsız) 🔥 */}
      {/* Bu bileşen, sen sunucu değiştirsen de Chat'e girsen de SABİT kalır. */}
      <div className="hidden"> 
            {activeVoiceChannel && (
                <VoiceChannel 
                    channelId={activeVoiceChannel._id}
                    channelName={activeVoiceChannel.name}
                    user={currentUser}
                    onLeave={handleLeaveVoice} // F5 durumunda state temizler
                    setVoiceParticipants={setVoiceParticipants}
                    isMicMuted={isMicMuted}
                    isDeafened={isDeafened}
                />
            )}
      </div>

      {/* MODALLAR */}
      {showCreateModal && <CreateServerModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateServer} />}
      {showJoinModal && <JoinServerModal onClose={() => setShowJoinModal(false)} onJoin={handleJoinServer} />}
      {showSettingsModal && (
        <UserSettingsModal 
            currentUser={currentUser}
            onClose={() => setShowSettingsModal(false)}
            onUpdate={handleUpdateUser}
            onLogout={handleLogout}
        />
      )}
      {deletedChannelData && <ChannelDeletedModal data={deletedChannelData} onClose={handleCloseDeletedModal} />}
      {welcomeData && <WelcomeModal serverName={welcomeData.serverName} onClose={() => setWelcomeData(null)} />}
      {createModal.isOpen && (
           <CreateChannelModal 
               initialType={createModal.type} 
               onClose={() => setCreateModal({ ...createModal, isOpen: false })} 
               onCreate={(name, type) => handleCreateChannel(activeServer._id, name, type)} 
           />
       )}
      {showServerSettings && activeServer && (
          <ServerSettingsModal 
              server={activeServer}
              currentUser={currentUser}
              onClose={() => setShowServerSettings(false)}
              onUpdateServer={handleUpdateServer}
              onDeleteServer={handleServerDeleted}
              onCreateRole={handleCreateRole}
              onKickMember={handleKickMember}
              onAssignRole={handleAssignRole}
              onDeleteRole={handleDeleteRole}
          />
      )}
      {kickedData && <KickedModal data={kickedData} onClose={() => setKickedData(null)} />}
       <FeedbackModal 
            isOpen={feedback.isOpen}
            onClose={closeFeedback}
            type={feedback.type}
            title={feedback.title}
            message={feedback.message}
        />

        {/* 👇 ARAMA MODALI */}
        {incomingCall && (
            <IncomingCallModal 
                caller={incomingCall.caller}
                onAccept={handleAcceptCall}
                onDecline={handleDeclineCall}
            />
        )}
    </div>
  );
}

export default App;