import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { useNavigate, useLocation } from 'react-router-dom';
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
import ServerWelcome from './components/Server/ServerWelcome';
import CreateChannelModal from './components/Modals/CreateChannelModal';
import HomeView from './components/Home/HomeView';
import VoiceConnectionPanel from './components/Voice/VoiceConnectionPanel';

// 👇 YENİ: LiveKit Bileşeni (Eski VoiceRoom yerine)
import VoiceChannel from './components/Voice/VoiceChannel';

const API_URL = `http://${window.location.hostname}:5000`;
const socket = io(API_URL, { transports: ["websocket"], reconnectionAttempts: 5 });

function App() {
  // --- STATE YÖNETİMİ ---
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || {});
  const navigate = useNavigate();
  const location = useLocation();
  
  // UI States
  const [activeServer, setActiveServer] = useState(null); 
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeTab, setActiveTab] = useState('online'); 
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [createModal, setCreateModal] = useState({ isOpen: false, type: 'text' });
  
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

// Modal Kapatma Yardımcısı
const closeFeedback = () => {
    setFeedback(prev => ({ ...prev, isOpen: false }));
};

  const openCreateModal = (type) => { 
      setCreateModal({ isOpen: true, type }); 
  };
  
  // --- AKILLI YÖNLENDİRME (ROUTING) ---
  useEffect(() => {
    if (location.pathname === '/') {
        navigate('/servers/@me');
        return;
    }
    if (location.pathname.includes('/servers/@me')) {
        setActiveServer(null);
        setActiveChannel(null);
        return;
    }
    if (myServers.length > 0 && location.pathname.includes('/servers/')) {
        const parts = location.pathname.split('/');
        const serverId = parts[2]; 
        const channelId = parts[4]; 

        if (serverId) {
            const targetServer = myServers.find(s => s._id === serverId);
            if (targetServer) {
                if (activeServer?._id !== targetServer._id) {
                    setActiveServer(targetServer);
                }

                const textChannels = targetServer.channels?.filter(c => c.type === 'text') || [];
                const firstTextChannel = textChannels[0];

                if (textChannels.length === 0) {
                    if (!location.pathname.includes('/welcome')) {
                        navigate(`/servers/${serverId}/welcome`, { replace: true });
                    }
                    setActiveChannel(null);
                    return; 
                }

                if (location.pathname.includes('/welcome') || !channelId) {
                    if (firstTextChannel) {
                        navigate(`/servers/${serverId}/channels/${firstTextChannel._id}`, { replace: true });
                    }
                    return; 
                }

                if (channelId) {
                    const targetChannel = targetServer.channels?.find(c => c._id === channelId);
                    if (targetChannel) {
                        setActiveChannel(targetChannel);
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

  useEffect(() => {
      if (activeChannel && activeChannel._id) {
          setMessages([]); 
          setHasMoreMessages(true);
          fetchMessages(activeChannel._id);
      }
  }, [activeChannel?._id]); 

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
    };
  }, [token, currentUser.id]);


// 🔄 F5 SONRASI OTOMATİK BAĞLANMA (Rejoin)
useEffect(() => {
    // 1. Sunucu listesi (myServers) henüz yüklenmediyse bekle
    if (!myServers || myServers.length === 0) return;

    // 2. Hafızadaki son kanal ID'sini oku
    const savedChannelId = sessionStorage.getItem('lastVoiceChannelId');

    // 3. ID var ama state boşsa (yani sayfa yeni açıldıysa)
    if (savedChannelId && !activeVoiceChannel) {
        
        let foundChannel = null;

        // 4. `myServers` içindeki tüm sunucuları ve kanalları tara
        for (const server of myServers) {
            // Sunucunun kanalları var mı kontrol et
            if (server.channels) {
                const channel = server.channels.find(c => c._id === savedChannelId);
                if (channel) {
                    foundChannel = channel;
                    break; // Bulduk, döngüyü bitir
                }
            }
        }

        // 5. Kanal hala mevcutsa bağlan
        if (foundChannel) {
            console.log(`🔄 Otomatik bağlanılıyor: ${foundChannel.name}`);
            setActiveVoiceChannel(foundChannel);
        } else {
            // Kanal silinmişse veya artık erişim yoksa hafızayı temizle
            sessionStorage.removeItem('lastVoiceChannelId');
        }
    }
}, [myServers]); // 👈 myServers değiştiğinde (yüklendiğinde) çalışır

  const fetchUserData = async () => {
    try {
      const userId = currentUser.id || currentUser._id;
      if (!userId) return;

      const res = await fetch(`${API_URL}/api/users/me?userId=${userId}`);
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
const handleRegister = async (username, password) => {
    setIsAuthLoading(true);
    try {
        const res = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
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
            // İstersen burada otomatik olarak login ekranına geçiş yaptırabilirsin (UI state ile)
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
      window.location.reload();
  };

  const handleSendMessage = (content) => {
    if (!activeChannel) return;
    socket.emit('chat_message', { 
        username: currentUser.username, 
        content,
        channelId: activeChannel._id,
        voiceChannelId: activeVoiceChannel ? activeVoiceChannel._id : null 
    });
  };

  // --- LIVEKIT SES HANDLERS ---

  // Ses kanalından ayrılma
  const handleLeaveVoice = () => {
        setActiveVoiceChannel(null);
        setVoiceParticipants([]);
    };

  const handleManualDisconnect = () => {
    console.log("👋 Kullanıcı kendi isteğiyle ayrıldı.");
    // Önce hafızadan sil, sonra state'i temizle
    sessionStorage.removeItem('lastVoiceChannelId');
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
            sessionStorage.setItem('lastVoiceChannelId', channel._id);
        }, 150);
    } else {
        setActiveVoiceChannel(channel);
        // 👇 YENİ: Hafızaya kaydet
        sessionStorage.setItem('lastVoiceChannelId', channel._id);
    }
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
      if(res.ok) { fetchUserData(); alert("Sunucu güncellendi!"); }
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
    const parts = friendInput.split('#');
    if(parts.length !== 2) { alert("Format: Nickname#1234"); return; }
    const res = await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ senderId: currentUser.id, targetUsername: parts[0], targetCode: parts[1] })
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
                    <span className="font-bold text-white">{friendInput}</span> kullanıcısına arkadaşlık isteği başarıyla iletildi.
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

// App.jsx içi

// 🔍 Ses kanalının hangi sunucuda olduğunu bulan yardımcı fonksiyon
const getVoiceConnectionDetails = () => {
    if (!activeVoiceChannel || !myServers) return { serverName: "Bilinmeyen Sunucu" };

    // Tüm sunucuları tara, kanalı içeren sunucuyu bul
    const ownerServer = myServers.find(server => 
        server.channels && server.channels.some(c => c._id === activeVoiceChannel._id)
    );

    return {
        serverName: ownerServer ? ownerServer.name : "Sunucu Bulunamadı"
    };
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

const voicePanelContent = activeVoiceChannel ? (
    <VoiceConnectionPanel 
        channelName={activeVoiceChannel.name}
        onDisconnect={handleManualDisconnect}
        // DİKKAT: activeServer her zaman dolu olmayabilir (Ana sayfadaysak null'dır).
        // Bu yüzden helper fonksiyonu kullanıyoruz:
        serverName={getVoiceConnectionDetails().serverName}
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
                <div className="w-60 bg-[#121214] flex flex-col flex-shrink-0 relative h-full">
                    {/* 1. SUNUCU BAŞLIĞI */}
                    <div className="h-12 flex items-center justify-between px-4 font-bold shadow-sm text-white hover:bg-[#35373c] cursor-pointer transition border-b border-[#1f2023] group flex-shrink-0">
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
                        allVoiceStates={allVoiceStates}
                        
                        
                        
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
    </div>
  );
}

export default App;