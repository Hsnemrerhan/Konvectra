import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHashtag, FaVolumeUp, FaPlus, FaCog, FaAngleDown, FaMusic, FaMicrophoneSlash } from 'react-icons/fa';
import { TbHeadphonesOff } from "react-icons/tb";
import ChannelSettingsModal from '../Modals/ChannelSettingsModal';

const ChannelList = ({ 
  serverName, 
  channels, 
  serverId, 
  currentUser, 
  onDeleteChannel,
  onRenameChannel,
  onOpenSettings,
  onOpenServerSettings,
  onJoinVoice,
  activeVoiceChannel,
  allVoiceStates = {}, 
  VoiceComponent, // LiveKit Odası Buradan Geliyor
  onLeaveVoice, 
  isMicMuted, 
  toggleMic, 
  isDeafened, 
  toggleDeafen,
  activeChannelId,
  onOpenCreateChannel,
  voiceParticipants,
  unreadCounts = {},
  activeBot = null // Varsayılan null
}) => {
  const navigate = useNavigate();
  const [editingChannel, setEditingChannel] = useState(null);
  
  const [isVoiceCollapsed, setIsVoiceCollapsed] = useState(false);
  const [isTextCollapsed, setIsTextCollapsed] = useState(false);

  const textChannels = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  const handleChannelClick = (id) => {
      navigate(`/servers/${serverId}/channels/${id}`);
  };

  return (
    <div className="w-[100%] bg-[#121214] flex flex-col flex-1 relative">
      
      
      
      {/* 2. KANAL LİSTESİ (Scroll Edilebilir Alan) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        
        {/* --- METİN KANALLARI --- */}
        <div className="mt-2 mb-0.5">
          <div 
            className="flex items-center justify-between px-2 pt-2 pb-1 text-xs font-bold text-[#949BA4] hover:text-white cursor-pointer transition-colors group"
            onClick={() => setIsTextCollapsed(!isTextCollapsed)}
          >
            <div className="flex items-center">
               <FaAngleDown size={12} className={`mr-0.5 transition-transform ${isTextCollapsed ? '-rotate-90' : ''}`} />
               METİN KANALLARI
            </div>
            <FaPlus 
                className="cursor-pointer hover:text-white" 
                onClick={(e) => { e.stopPropagation(); onOpenCreateChannel('text'); }}
                title="Kanal Oluştur" 
                size={12}
            />
          </div>
          
          {!isTextCollapsed && textChannels.map(channel => {
              const isActive = activeChannelId === channel._id;
              const count = unreadCounts?.[channel._id] || 0; 

              return (
                <div 
                    key={channel._id} 
                    onClick={() => handleChannelClick(channel._id)} 
                    className={`group relative flex items-center px-2 py-1.5 rounded-md cursor-pointer mx-2 mb-[2px] transition-all duration-200
                    ${isActive 
                        ? 'bg-[#26272D] text-white' 
                        : 'text-[#949BA4] hover:bg-[#26272D] hover:text-gray-100'}`}
                >
                    {isActive && (
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-r-full"></div>
                    )}
                    <div className="mr-1.5 text-gray-400 group-hover:text-gray-300">
                        {channel.subtype === 'music' ? <FaMusic size={16}/> : <FaHashtag size={20}/>}
                    </div>
                    
                    <span className="font-medium truncate flex-1 text-[15px]">
                        {channel.name}
                    </span>

                    {count > 0 && (
                        <div className="bg-[#F23F42] text-white text-[11px] font-bold px-1.5 h-4 min-w-[16px] flex items-center justify-center rounded-full ml-2">
                            {count}
                        </div>
                    )}

                    <FaCog 
                        className="hidden group-hover:block text-gray-400 hover:text-white ml-1"
                        onClick={(e) => { e.stopPropagation(); setEditingChannel(channel); }} 
                        size={14}
                    />
                </div>
              );
          })}
        </div>

        {/* --- SES KANALLARI --- */}
        <div className="mt-4 mb-1">
            <div 
                className="flex items-center justify-between px-2 pt-2 pb-1 text-xs font-bold text-[#949BA4] hover:text-white cursor-pointer transition-colors group"
                onClick={() => setIsVoiceCollapsed(!isVoiceCollapsed)}
            >
                <div className="flex items-center">
                   <FaAngleDown size={12} className={`mr-0.5 transition-transform ${isVoiceCollapsed ? '-rotate-90' : ''}`} />
                   SES KANALLARI
                </div>
                <FaPlus 
                    className="cursor-pointer hover:text-white" 
                    onClick={(e) => { e.stopPropagation(); onOpenCreateChannel('voice'); }}
                    size={12}
                    title="Ses Kanalı Oluştur"
                />
            </div>
            
            {/* --- SES KANALLARI LOOP --- */}
            {!isVoiceCollapsed && voiceChannels.map(channel => {
                // 1. Aktif kanalda mıyız?
                const isActive = activeVoiceChannel?._id === channel._id;

                // 2. Bot bu kanalda mı?
                const isBotInThisChannel = activeBot && 
                    activeBot.currentVoiceChannel === channel._id &&
                    activeBot.serverId === serverId;

                // 3. KATILIMCI LİSTESİNİ BELİRLE (KRİTİK KISIM) 🛠️
                let participantsToDisplay = [];

                if (isActive) {
                    // Durum A: Kanalın içindeyiz -> LiveKit verisini kullan (Anlık konuşma, mute bilgisi var)
                    participantsToDisplay = voiceParticipants || [];
                } else {
                    // Durum B: Dışarıdan bakıyoruz -> Socket verisini kullan (Global liste)
                    // allVoiceStates: { "kanalId": [ { _id, username, avatar... } ] }
                    participantsToDisplay = allVoiceStates?.[channel._id] || [];
                }

                // Botu listeye manuel ekle (Eğer socket listesinde yoksa ve bot oradaysa)
                // Bu, botun görünmez olmasını engeller.
                if (isBotInThisChannel) {
                    // Botun zaten listede olup olmadığına bak (ID çakışmasını önle)
                    const isBotListed = participantsToDisplay.some(p => (p.user?._id || p._id) === activeBot._id);
                    
                    if (!isBotListed) {
                        participantsToDisplay = [
                            ...participantsToDisplay, 
                            { 
                                user: { 
                                    _id: activeBot._id, 
                                    username: "Music Bot", 
                                    avatar: activeBot.avatar, // Bot avatarı
                                    isBot: true 
                                },
                                isSpeaking: true // Bot genelde konuşuyordur :)
                            }
                        ];
                    }
                }

                // Listede kimse var mı?
                const hasParticipants = participantsToDisplay.length > 0;
                
                // Genişletme mantığı: Aktifsek VEYA içeride biri varsa VEYA bot varsa aç.
                const shouldExpand = isActive || hasParticipants;

                return (
                    <div key={channel._id}>
                        <div 
                            onClick={() => onJoinVoice(channel)} 
                            className={`group relative flex items-center px-2 py-1.5 rounded-md cursor-pointer mx-2 mb-[2px] transition-all duration-200
                            ${isActive 
                                ? 'bg-[#26272D] text-white' 
                                : 'text-[#949BA4] hover:bg-[#26272D] hover:text-gray-100'}`}
                        >
                            <FaVolumeUp className="mr-1.5" size={16} />
                            <span className="font-medium truncate flex-1 text-[15px]">{channel.name}</span>
                        </div>

                        {/* KATILIMCILAR LİSTESİ */}
                        {shouldExpand && (
                            <div className="pl-8 pb-2 flex flex-col gap-1">
                                {participantsToDisplay.map((p, idx) => {
                                    // VERİ YAPISINI EŞİTLEME 🔄
                                    // Socket'ten gelen veri direk 'user' objesidir ({_id, username...})
                                    // LiveKit'ten gelen veri 'p.user' içindedir.
                                    const user = p.user || p; 

                                    
                                    
                                    // Socket verisinde isMuted/isSpeaking bilgisi olmaz, varsayılan false yapıyoruz.
                                    // Sadece kendi kanalımızdaysak (isActive) bu bilgiler doğrudur.
                                    const isMuted = isActive ? (p.isMuted || false) : false;
                                    const isDeafened = isActive ? (p.isDeafened || false) : false;
                                    const isSpeaking = isActive ? (p.isSpeaking || false) : false;

                                    return (
                                        <div key={user._id || idx} className="flex items-center justify-between px-2 py-1 rounded cursor-pointer group/user hover:bg-white/5">
                                            
                                            {/* Sol Kısım: Avatar ve İsim */}
                                            <div className="flex items-center gap-2 p-0.5 overflow-hidden">
                                                {/* Avatar Kısmı */}
                                                <div className={`relative w-8 h-8 rounded-full ${isSpeaking ? 'ring-2 ring-green-500' : ''} bg-[#313338] flex items-center justify-center`}>
                                                    
                                                    {/* Eğer avatar varsa göster */}
                                                    {user.avatar ? (
                                                        <img 
                                                            src={user.avatar} 
                                                            className={`w-full h-full rounded-full object-cover ${isDeafened ? 'opacity-50' : 'opacity-100'}`}
                                                            alt={user.username}
                                                            // Resim yüklenirken hata olursa (404 vb.) varsayılanı göster
                                                            onError={(e) => {
                                                                e.target.style.display = 'none'; // Resmi gizle
                                                                e.target.parentElement.classList.add('fallback-avatar'); // Arkadaki rengi göster
                                                            }}
                                                        />
                                                    ) : (
                                                        /* Avatar yoksa Discord Logosu veya Baş harf göster */
                                                        <div className={`w-full h-full rounded-full flex items-center justify-center bg-indigo-500 text-white text-xs font-bold ${isDeafened ? 'opacity-50' : ''}`}>
                                                            {user.username?.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Online indicator vb... */}
                                                </div>
                                                <span className={`text-[14px] truncate ${isDeafened ? 'text-gray-400' : 'text-gray-300'}`}>
                                                    {user.nickname || user.username}
                                                </span>
                                            </div>

                                            {/* Sağ Kısım: Durum İkonları (Sadece Aktif Kanalda Görünür) */}
                                            {isActive && (
                                                <div className="flex items-center gap-1">
                                                    {isDeafened ? (
                                                        <>
                                                            <FaMicrophoneSlash size={14} className="text-red-500" />
                                                            <TbHeadphonesOff size={14} className="text-red-500" />
                                                        </>
                                                    ) : (
                                                        isMuted && <FaMicrophoneSlash size={14} className="text-red-500" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

      </div>

      

      

      

      {/* MODAL */}
      {editingChannel && (
        <ChannelSettingsModal 
            channel={editingChannel} 
            onClose={() => setEditingChannel(null)} 
            onRename={onRenameChannel} 
            onDelete={onDeleteChannel} 
        />
      )}
    </div>
  );
};

export default ChannelList;