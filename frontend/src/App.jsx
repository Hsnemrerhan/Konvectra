import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// --- BİLEŞENLER ---
import Sidebar from './components/Layout/Sidebar';
import ChannelList from './components/Layout/ChannelList'; // Sunucu içi menü
import ChatArea from './components/Chat/ChatArea';
import AuthForm from './components/AuthForm';
import CreateServerModal from './components/Modals/CreateServerModal';
import JoinServerModal from './components/Modals/JoinServerModal';
import UserList from './components/Layout/UserList';
import UserSettingsModal from './components/Modals/UserSettingsModal';
import ChannelDeletedModal from './components/Modals/ChannelDeletedModal';
import WelcomeModal from './components/Modals/WelcomeModal';
import ServerSettingsModal from './components/Modals/ServerSettingsModal';
import KickedModal from './components/Modals/KickedModal';
import VoiceRoom from './components/Voice/VoiceRoom';
import ServerWelcome from './components/Server/ServerWelcome';
import CreateChannelModal from './components/Modals/CreateChannelModal';
import HomeView from './components/Home/HomeView';
import { useNavigate, useLocation } from 'react-router-dom';


const API_URL = `http://${window.location.hostname}:5000`;
const socket = io(API_URL, { transports: ["websocket"], reconnectionAttempts: 5 });

function App() {
  // --- STATE YÖNETİMİ ---
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || {});
  const navigate = useNavigate();
  const location = useLocation();
  
  // UI States
  const [activeServer, setActiveServer] = useState(null); // null = Home
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeTab, setActiveTab] = useState('online'); // Home sekmeleri: online, all, pending, add
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [isMicMuted, setIsMicMuted] = useState(false); // Mikrofon Kapalı mı?
  const [isDeafened, setIsDeafened] = useState(false); // Sağırlaştırıldı mı? (Hoparlör kapalı)
  const [createModal, setCreateModal] = useState({ isOpen: false, type: 'text' });
  
  
  
  // Data States
  const [myServers, setMyServers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true); // Daha yüklenecek mesaj var mı?
  const [isMessagesLoading, setIsMessagesLoading] = useState(false); // Şu an yükleniyor mu?
  const [deletedChannelData, setDeletedChannelData] = useState(null);
  const [welcomeData, setWelcomeData] = useState(null);
  const [kickedData, setKickedData] = useState(null); // Atılma verisi
  const [activeVoiceChannel, setActiveVoiceChannel] = useState(null); // Şu an hangi ses kanalındayım?
  const [allVoiceStates, setAllVoiceStates] = useState({});
  const [activeBot, setActiveBot] = useState(null);
  

  // Form Inputs
  const [friendInput, setFriendInput] = useState(''); // Arkadaş ekleme inputu

  const openCreateModal = (type) => { 
      setCreateModal({ isOpen: true, type }); 
  };
  

  // ---------------------------------------------------------
  // YENİLENMİŞ: AKILLI YÖNLENDİRME (SMART ROUTING) 🧠
  // ---------------------------------------------------------
  useEffect(() => {
    // 1. Kök dizin -> Home'a yönlendir
    if (location.pathname === '/') {
        navigate('/servers/@me');
        return;
    }

    // 2. Home Modu
    if (location.pathname.includes('/servers/@me')) {
        setActiveServer(null);
        setActiveChannel(null);
        return;
    }

    // 3. Sunucu Modu (/servers/ID...)
    if (myServers.length > 0 && location.pathname.includes('/servers/')) {
        
        const parts = location.pathname.split('/');
        const serverId = parts[2]; 
        const channelId = parts[4]; // Varsa kanal ID'si

        if (serverId) {
            const targetServer = myServers.find(s => s._id === serverId);
            
            if (targetServer) {
                // Sunucu state'ini güncelle
                if (activeServer?._id !== targetServer._id) {
                    setActiveServer(targetServer);
                }

                // --- AKILLI YÖNLENDİRME MANTIĞI ---
                
                // Metin kanallarını bul
                const textChannels = targetServer.channels?.filter(c => c.type === 'text') || [];
                const firstTextChannel = textChannels[0];

                // DURUM 1: HİÇ METİN KANALI YOKSA -> ZORUNLU WELCOME
                if (textChannels.length === 0) {
                    // Eğer zaten welcome sayfasında değilsek, oraya at
                    if (!location.pathname.includes('/welcome')) {
                        navigate(`/servers/${serverId}/welcome`, { replace: true });
                    }
                    setActiveChannel(null);
                    return; // İşlem bitti
                }

                // DURUM 2: METİN KANALI VAR AMA KULLANICI WELCOME'DA VEYA ROOT'TA
                // (Kanal varken Welcome sayfasını görmemeli, direkt kanala uçmalı)
                if (location.pathname.includes('/welcome') || !channelId) {
                    if (firstTextChannel) {
                        navigate(`/servers/${serverId}/channels/${firstTextChannel._id}`, { replace: true });
                    }
                    return; // Yönlendirme yapıldı, işlem bitti
                }

                // DURUM 3: BELİRLİ BİR KANAL SEÇİLMİŞ
                if (channelId) {
                    const targetChannel = targetServer.channels?.find(c => c._id === channelId);
                    
                    if (targetChannel) {
                        setActiveChannel(targetChannel);
                        
                        // Mesajları çek (Sadece kanal değiştiyse)
                        if (activeChannel?._id !== targetChannel._id) {
                            setMessages([]); 
                            setHasMoreMessages(true);
                            fetchMessages(targetChannel._id); 
                        }
                    }
                }
            }
        }
    }
  }, [location.pathname, myServers]);

  

  // Kanal değişince mesajları çek
  useEffect(() => {
      // Sadece activeChannel DOLU ise ve bir ID'si varsa çek
      if (activeChannel && activeChannel._id) {
          setMessages([]); // Önceki kanalın mesajlarını temizle
          setHasMoreMessages(true);
          fetchMessages(activeChannel._id);
      }
  }, [activeChannel?._id]); // Sadece ID değiştiğinde tetikle

  // --- DATA FETCHING & SOCKET ---
  useEffect(() => {
    if (token && currentUser.id) {
      fetchUserData();
      
      // 1. ÖNEMLİ: Socket'e kim olduğunu bildir (Backend'deki odaya katılmak için)
      socket.emit('register_socket', currentUser.id);

      socket.emit("get_voice_states");

      // Mevcut dinleyiciler
      
      socket.on('chat_message', (msg) => {setMessages(prev => {return [...prev, msg];});});

      // --- YENİ EKLENEN CANLI BİLDİRİMLER ---
      
      // A) Biri bana istek attı!
      socket.on('new_friend_request', (senderUser) => {
          // Listeye ekle (Eğer zaten yoksa)
          setIncomingRequests(prev => {
              if (prev.find(req => req._id === senderUser._id)) return prev;
              return [...prev, senderUser];
          });
          // Küçük bir ses veya bildirim efekti de eklenebilir
          // alert("Yeni bir arkadaşlık isteği aldın!");
      });

      // B) Biri isteğimi kabul etti veya ben kabul ettim!
      socket.on('friend_request_accepted', (newFriend) => {
          // 1. Arkadaş listesine ekle
          setFriends(prev => [...prev, newFriend]);
          
          // 2. Bekleyenler listesinden çıkar (Eğer oradaysa)
          setIncomingRequests(prev => prev.filter(req => req._id !== newFriend._id));
      });

      // C) BİR KULLANICI PROFİLİNİ GÜNCELLEDİ (Avatar, Nickname, Durum)
      socket.on('user_updated', (updatedUser) => {
          
          // 1. Kendi profilimse güncelle
          // (currentUser state'ine erişmek yerine ID kontrolünü direkt yapıyoruz)
          const currentUserId = JSON.parse(localStorage.getItem('user'))?._id; 
          if (updatedUser._id === currentUserId) {
              const freshMe = { ...updatedUser, id: updatedUser._id };
              setCurrentUser(freshMe);
              localStorage.setItem('user', JSON.stringify(freshMe));
          }

          // 2. Arkadaş listesini güncelle (Fonksiyonel Update)
          setFriends(prev => prev.map(f => f._id === updatedUser._id ? updatedUser : f));

          // 3. Bekleyen istekleri güncelle
          setIncomingRequests(prev => prev.map(req => req._id === updatedUser._id ? updatedUser : req));

          // 4. Aktif sunucudaki üye listesini güncelle
          setActiveServer(prevServer => {
              if (!prevServer) return null;
              
              // Sadece durumu güncellemek yetmez, üye listesinde var mı diye bakmak lazım
              const isMember = prevServer.members.some(m => m.user._id === updatedUser._id);
              
              if (!isMember) return prevServer;

              return {
                  ...prevServer,
                  members: prevServer.members.map(member => {
                      if (member.user._id === updatedUser._id) {
                          // Tüm kullanıcı objesini yenile (Status dahil)
                          return { ...member, user: updatedUser };
                      }
                      return member;
                  })
              };
          });

          // 👇 YENİ: MESAJLARDAKİ AVATARLARI DA GÜNCELLE
        setMessages(prevMessages => prevMessages.map(msg => {
            // Mesajın göndereni güncellenen kullanıcı mı?
            const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
            
            if (senderId === updatedUser._id) {
                // Eğer sender bir obje ise (populate edilmişse) içini güncelle
                if (typeof msg.sender === 'object') {
                    return { 
                        ...msg, 
                        sender: { ...msg.sender, avatar: updatedUser.avatar, nickname: updatedUser.nickname } 
                    };
                }
                // Populate edilmemişse yapacak bir şey yok (veya senderAvatar string'ini güncellersin)
                return msg;
            }
            return msg;
        }));
      });

      // D) KANAL SİLİNDİ (GÜNCELLENMİŞ)
      socket.on('channel_deleted', ({ channelId, serverId, channelName, deleterName }) => {
          
          // 1. Listeleri Güncelle (Kanalı UI'dan sil)
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

          // 2. KONTROL: Eğer ben o kanaldaysam MODALI AÇ
          const currentPath = window.location.pathname; // /servers/XXX/channels/YYY
          if (currentPath.includes(channelId)) {
             // Alert yerine State'i dolduruyoruz -> Modal açılır
             setDeletedChannelData({ 
                 channelName, 
                 deleterName, 
                 serverId 
             });
          }
      });

      // ... diğer socket dinleyicileri ...

      // E) YENİ KANAL OLUŞTURULDU
      socket.on('channel_created', (newChannel) => {
          // 1. Sunucu listesindeki ilgili sunucuyu bul ve kanal ekle
          setMyServers(prevServers => prevServers.map(server => {
              if (server._id === newChannel.serverId) {
                  return { 
                      ...server, 
                      channels: [...(server.channels || []), newChannel] 
                  };
              }
              return server;
          }));

          // 2. Eğer şu an o sunucu açıksa, ekrandaki listeyi de anlık güncelle
          setActiveServer(prevServer => {
              if (prevServer && prevServer._id === newChannel.serverId) {
                  return { 
                      ...prevServer, 
                      channels: [...(prevServer.channels || []), newChannel] 
                  };
              }
              return prevServer;
          });
      });

      // F) SUNUCUDAN ATILDIN (CANLI) 🦶
      socket.on('member_kicked', ({ serverId, serverName, kickerName }) => {
          // 1. Sunucu listemden o sunucuyu sil
          setMyServers(prev => prev.filter(s => s._id !== serverId));

          // 2. Eğer şu an o sunucudaysam -> Home'a at ve Modalı aç
          if (window.location.pathname.includes(serverId)) {
              setActiveServer(null); // State'i temizle
              navigate('/servers/@me'); // Ana sayfaya yönlendir
          }

          // 3. Her durumda o modalı göster (İster o sunucuda ol ister olma)
          setKickedData({ serverName, kickerName });
          
          // 4. Veritabanındaki bildirimi hemen temizle ki F5 atınca tekrar çıkmasın
          // (Çünkü canlı gördük zaten)
          fetch(`${API_URL}/api/users/${currentUser.id}/notifications`, { method: 'DELETE' });
      });

      // G) SUNUCU GÜNCELLENDİ (Rol eklendi, üye rolü değişti, isim değişti vb.)
      socket.on('server_updated', (updatedServer) => {
          // 1. Sunucu listemdeki eski veriyi yenisiyle değiştir
          setMyServers(prev => prev.map(s => s._id === updatedServer._id ? updatedServer : s));

          // 2. Eğer şu an o sunucudaysam, aktif sunucuyu da güncelle (Anlık renk değişimi için şart!)
          setActiveServer(prev => {
              if (prev && prev._id === updatedServer._id) {
                  return updatedServer;
              }
              return prev;
          });
      });

      // H) BAŞKASI KONUŞUYOR/SUSTU
      socket.on("user_speaking_change", ({ userId, isSpeaking }) => {
          setVoiceParticipants(prev => prev.map(p => {
              // Gelen ID, listedeki bir kullanıcıyla eşleşiyor mu?
              if (p.user._id === userId || p.user.id === userId) {
                  return { ...p, isSpeaking };
              }
              return p;
          }));
      });

      // I) TÜM SES KANALLARI DURUMU (İLK YÜKLEME)
      socket.on("all_voice_states", (states) => {
          setAllVoiceStates(states);
      });

      // J) TEK BİR KANAL GÜNCELLENDİ (Biri girdi/çıktı)
      socket.on("voice_channel_state", ({ channelId, users }) => {
          setAllVoiceStates(prev => ({
              ...prev,
              [channelId]: users
          }));
      });

      const handleMusicCommand = (data) => {
            // Müzik başladıysa ve sunucu bot bilgisini gönderdiyse kaydet
            console.log('HandleMusicCommand', data);
            
            if (data.action === 'play' && data.bot) {
                setActiveBot(data.bot);
            }
            // Müzik durduysa botu temizle
            if (data.action === 'stop') {
                setActiveBot(null);
            }
        };

        socket.on('music_command', handleMusicCommand);
    }

    // Temizlik (Unmount)
    return () => {
        socket.off('load_messages');
        socket.off('chat_message');
        socket.off('new_friend_request');      // Temizle
        socket.off('friend_request_accepted'); // Temizle
        socket.off('user_updated');
        socket.off('channel_deleted');
        socket.off('channel_created');
        socket.off('server_updated');
        socket.off('user_speaking_change');
        socket.off('all_voice_states');
        socket.off('voice_channel_state');
        socket.off('music_command', handleMusicCommand);
    };
  }, [token, currentUser.id]);

  const fetchUserData = async () => {
    try {
      const userId = currentUser.id || currentUser._id;
      if (!userId) return;

      const res = await fetch(`${API_URL}/api/users/me?userId=${userId}`);
      const data = await res.json();
      
      // 1. Sunucu Listesini Güncelle
      setMyServers(data.servers);
      
      // 2. Arkadaş Listelerini Güncelle
      setFriends(data.user.friends || []);
      setIncomingRequests(data.user.incomingRequests || []);

      // 3. Kullanıcı Bilgisini Güncelle
      const freshUser = { ...data.user, id: data.user._id };
      setCurrentUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));

      // 4. KRİTİK DÜZELTME: Aktif Sunucuyu da Güncelle! 🛠️
      // Eğer şu an bir sunucunun içindeysek (activeServer varsa),
      // sunucudan yeni gelen listeden bu sunucunun GÜNCEL halini bulup state'e yazmalıyız.
      if (activeServer) {
          const updatedActiveServer = data.servers.find(s => s._id === activeServer._id);
          // Eğer sunucu hala listedeyse (silinmemişse) güncelle
          if (updatedActiveServer) {
              setActiveServer(updatedActiveServer);
          } else {
              // Sunucudan atılmış veya sunucu silinmiş olabilir, ana sayfaya at
              setActiveServer(null);
          }
      }

      // 5. BEKLEYEN BİLDİRİM KONTROLÜ (Offline iken atıldıysa)
      if (data.user.notifications && data.user.notifications.length > 0) {
          const kickNotif = data.user.notifications.find(n => n.type === 'kick');
          
          if (kickNotif) {
              // Modalı aç
              setKickedData({ 
                  serverName: kickNotif.serverName, 
                  kickerName: kickNotif.kickerName 
              });

              // Bildirimi sunucudan sil (Tekrar tekrar çıkmasın)
              await fetch(`${API_URL}/api/users/${userId}/notifications`, { method: 'DELETE' });
          }
      }

    } catch (err) { console.error(err); }
  };

  // Fonksiyonlar arasına ekle
const fetchMessages = async (channelId, beforeDate = null) => {
    if (!channelId) return;
    console.log("📨 Mesajlar isteniyor, Kanal ID:", channelId);

    setIsMessagesLoading(true);
    try {
        let url = `${API_URL}/api/messages/${channelId}`;
        if (beforeDate) {
            url += `?before=${beforeDate}`;
        }

        const res = await fetch(url);
        const newMessages = await res.json();

        if (beforeDate) {
            // Eskileri yüklüyorsak başa ekle
            setMessages(prev => [...newMessages, ...prev]);
        } else {
            // İlk defa yüklüyorsak direkt set et
            setMessages(newMessages);
        }

        // Eğer 30'dan az geldiyse demek ki daha mesaj kalmadı
        if (newMessages.length < 30) {
            setHasMoreMessages(false);
        } else {
            setHasMoreMessages(true);
        }

    } catch (err) {
        console.error("Mesaj yükleme hatası:", err);
    } finally {
        setIsMessagesLoading(false);
    }
 };

  // --- HANDLERS (İŞ MANTIĞI) ---

  // Auth (Giriş/Kayıt)
  const handleAuth = async (username, password, endpoint) => {
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message);
      
      if (endpoint === '/api/register') {
        alert("Kayıt başarılı! Giriş yapabilirsiniz.");
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setCurrentUser(data.user);
      }
    } catch (err) { alert(err.message); }
  };

  const handleLogout = () => {
      localStorage.clear();
      window.location.reload();
  };

  // Mesaj Gönderme
  const handleSendMessage = (content) => {
    // Eğer aktif bir kanal yoksa gönderme
    if (!activeChannel) return;
    const currentVoiceChannelId = activeVoiceChannel ? activeVoiceChannel._id : null;
    socket.emit('chat_message', { 
        username: currentUser.username, 
        content,
        channelId: activeChannel._id,
        // 👇 Bu bilgiyi pakete ekliyoruz
        voiceChannelId: currentVoiceChannelId 
    });
  };

  // Ses kanalından ayrılma
  const handleLeaveVoice = () => {
      if (activeVoiceChannel) {
          // Backend'e haber ver: "Ben çıkıyorum, beni listeden sil"
          socket.emit("leave_voice_room", activeVoiceChannel._id);
          
          // Local State'i temizle
          setActiveVoiceChannel(null);
          setVoiceParticipants([]);
          setIsMicMuted(false);
          setIsDeafened(false);
      }
  };

  // --- HANDLERS GÜNCELLEMELERİ ---
  
  // Sunucu Oluşturunca
  const handleCreateServer = async (name) => {
    const res = await fetch(`${API_URL}/api/servers/create`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, ownerId: currentUser.id })
    });
    const newServer = await res.json();
    setMyServers([...myServers, newServer]); 
    setShowCreateModal(false);
    
    // YENİ YÖNLENDİRME: Welcome sayfasına git
    navigate(`/servers/${newServer._id}/welcome`);
  };

  // Sunucuya Katılınca -> O sunucuya git ve Hoş geldin de
  const handleJoinServer = async (serverId) => {
    try {
        const res = await fetch(`${API_URL}/api/servers/join`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ serverId, userId: currentUser.id })
        });
        const data = await res.json();

        if(res.ok) {
            // 1. Verileri yenile (Listeye yeni sunucu gelsin)
            await fetchUserData(); 
            
            // 2. Katılma modalını kapat
            setShowJoinModal(false);

            // 3. YÖNLENDİRME: Sunucu ID'sine git 
            // (App.jsx'teki useEffect zaten otomatik ilk kanalı bulup oraya atacak)
            navigate(`/servers/${serverId}`);

            // 4. HOŞ GELDİN MODALINI AÇ
            setWelcomeData({ serverName: data.server.name });

        } else {
            alert("Hata: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert("Sunucuya bağlanırken hata oluştu.");
    }
  };

  const handleJoinVoice = (channel) => {
      // Zaten aynı kanaldaysak işlem yapma
      if (activeVoiceChannel && activeVoiceChannel._id === channel._id) return;
      
      // Eğer başka bir kanaldaysak önce oradan çıkış sinyali gönder!
      if (activeVoiceChannel) {
          socket.emit("leave_voice_room", activeVoiceChannel._id);
      }
      
      // Yeni kanala geç (VoiceRoom bileşeni unmount/mount olacak ve yeni odaya join atacak)
      setActiveVoiceChannel(channel);
  };

  // --- SUNUCU YÖNETİMİ HANDLERS ---
  
  // A) Sunucuyu Güncelle
  const handleUpdateServer = async (serverId, updates) => {
      const res = await fetch(`${API_URL}/api/servers/${serverId}`, {
          method: 'PUT', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ ...updates, userId: currentUser.id })
      });
      if(res.ok) {
          fetchUserData(); // Verileri yenile
          alert("Sunucu güncellendi!");
      }
  };

  // B) Rol Oluştur
  const handleCreateRole = async (serverId, name, color) => {
      const res = await fetch(`${API_URL}/api/servers/${serverId}/roles`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ name, color, userId: currentUser.id })
      });
      if(res.ok) fetchUserData();
  };

  // C) Üye At
  const handleKickMember = async (serverId, memberId) => {
      const res = await fetch(`${API_URL}/api/servers/${serverId}/members/${memberId}`, {
          method: 'DELETE', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ userId: currentUser.id })
      });
      if(res.ok) fetchUserData();
  };

  // D) Rol Ata
  const handleAssignRole = async (serverId, memberId, roleId) => {
      const res = await fetch(`${API_URL}/api/servers/${serverId}/members/${memberId}/roles`, {
          method: 'PUT', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ roleId, userId: currentUser.id })
      });
      if(res.ok) fetchUserData();
  };

  // E) Rol Sil
  const handleDeleteRole = async (serverId, roleId) => {
      if(!confirm("Bu rolü silmek istediğine emin misin? Üyelerden de alınacak.")) return;

      const res = await fetch(`${API_URL}/api/servers/${serverId}/roles/${roleId}`, {
          method: 'DELETE', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ userId: currentUser.id })
      });
      if(res.ok) fetchUserData();
  };

  // --- KANAL YÖNETİMİ HANDLERS ---

  const handleCreateChannel = async (serverId, name, type) => {
    const res = await fetch(`${API_URL}/api/channels/create`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ serverId, name, type })
    });
    if(res.ok) {
        fetchUserData(); // Listeyi yenilemek için en kolay yol
    }
  };

  const handleDeleteChannel = async (channelId) => {
      // DELETE isteğinde body göndermek için headers ve body ekliyoruz
      const res = await fetch(`${API_URL}/api/channels/${channelId}`, { 
          method: 'DELETE',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ userId: currentUser.id }) // <--- ID GÖNDERİYORUZ
      });
      
      if(res.ok) {
          fetchUserData(); 
      }
  };

  const handleRenameChannel = async (channelId, newName) => {
    const res = await fetch(`${API_URL}/api/channels/${channelId}`, {
        method: 'PUT', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name: newName })
    });
    
    if(res.ok) {
        fetchUserData(); // Listeyi yenile
    }
  };

  const handleCloseDeletedModal = () => {
      if (deletedChannelData) {
          // Modal kapanınca sunucunun ana sayfasına yönlendir
          navigate(`/servers/${deletedChannelData.serverId}`);
          setDeletedChannelData(null); // Modalı kapat ve state'i temizle
      }
  };

  // Arkadaşlık İşlemleri
  const handleSendFriendRequest = async () => {
    const parts = friendInput.split('#');
    if(parts.length !== 2) { alert("Format şöyle olmalı: Nickname#1234"); return; }
    
    const res = await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ senderId: currentUser.id, targetUsername: parts[0], targetCode: parts[1] })
    });
    const data = await res.json();
    alert(data.message);
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
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(updates)
        });
        const data = await res.json();

        if(!res.ok) throw new Error(data.message);

        // State'i ve LocalStorage'ı güncelle
        const updatedUser = { ...currentUser, ...data, id: data._id };
        setCurrentUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // alert("Profil güncellendi!"); // <--- BU SATIRI SİLDİK
        
        setShowSettingsModal(false); // Modalı sessizce kapatıyoruz
        
    } catch (err) {
        console.error(err); // Hata olursa konsola yazsın, kullanıcıyı boğmayalım
        alert("Bir hata oluştu: " + err.message); // Sadece hata varsa uyarabiliriz
    }
  };

  // --- RENDER ---

  // 1. GİRİŞ EKRANI
  if (!token) {
    return (
      <AuthForm 
        onLogin={(u, p) => handleAuth(u, p, '/api/login')}
        onRegister={(u, p) => handleAuth(u, p, '/api/register')}
      />
    );
  }

  // 2. ANA UYGULAMA
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
                {/* Orta Sol: Kanal Listesi + Profil */}
                <ChannelList 
                    serverName={activeServer.name}
                    channels={activeServer.channels || []} // Kanalları gönderiyoruz
                    currentUser={currentUser}
                    handleLogout={handleLogout}
                    
                    // Yeni Yetenekler:
                    onCreateChannel={handleCreateChannel}
                    onDeleteChannel={handleDeleteChannel}
                    onRenameChannel={handleRenameChannel}
                    activeChannelId={activeChannel?._id}
                    activeBot={activeBot}
                    serverId={activeServer._id}
                    onOpenSettings={() => setShowSettingsModal(true)}
                    onOpenServerSettings={() => setShowServerSettings(true)}
                    onJoinVoice={handleJoinVoice}
                    activeVoiceChannel={activeVoiceChannel} // <--- Hangi kanalda olduğumuzu bilmeli
                    voiceParticipants={voiceParticipants}   // <--- Kimler var?
                    VoiceComponent={
                        activeVoiceChannel ? (
                            <VoiceRoom 
                                serverId={activeServer._id}
                                channelId={activeVoiceChannel._id}
                                socket={socket}
                                currentUser={currentUser}
                                setVoiceParticipants={setVoiceParticipants}
                                isMicMuted={isMicMuted}
                                isDeafened={isDeafened}
                            />
                        ) : null
                    }
                    allVoiceStates={allVoiceStates}
                    onLeaveVoice={handleLeaveVoice}
                    isMicMuted={isMicMuted}
                    toggleMic={() => setIsMicMuted(!isMicMuted)}
                    isDeafened={isDeafened}
                    toggleDeafen={() => setIsDeafened(!isDeafened)}
                    onOpenCreateChannel={openCreateModal}
                />
                
                {/* ORTA ALAN: WELCOME SAYFASI veya CHAT ALANI */}
                {location.pathname.includes('/welcome') ? (
                    <ServerWelcome 
                        server={activeServer}
                        onOpenCreateChannel={openCreateModal}
                    />
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

                {/* SAĞ: SUNUCU ÜYELERİ (YENİ EKLENDİ) */}
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
                handleLogout={handleLogout}
                onOpenSettings={() => setShowSettingsModal(true)}
                friendInput={friendInput}
                setFriendInput={setFriendInput}
                handleSendFriendRequest={handleSendFriendRequest}
                handleAcceptFriend={handleAcceptFriend}
                socket={socket}
                onSendMessage={(content, channelId) => {
                    socket.emit('chat_message', { 
                        username: currentUser.username, 
                        content,
                        channelId: channelId 
                    });
                }}
                messages={messages}
                fetchMessages={fetchMessages}
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
      {/* KANAL SİLİNDİ MODALI */}
      {deletedChannelData && (
        <ChannelDeletedModal 
            data={deletedChannelData}
            onClose={handleCloseDeletedModal}
        />
      )}
      {/* HOŞ GELDİN MODALI */}
      {welcomeData && (
        <WelcomeModal 
            serverName={welcomeData.serverName}
            onClose={() => setWelcomeData(null)}
        />
      )}
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
              onCreateRole={handleCreateRole}
              onKickMember={handleKickMember}
              onAssignRole={handleAssignRole}
              onDeleteRole={handleDeleteRole}
          />
      )}
      {/* ATILMA MODALI */}
      {kickedData && (
        <KickedModal 
            data={kickedData}
            onClose={() => setKickedData(null)}
        />
      )}
    </div>
    
  );
}

export default App;