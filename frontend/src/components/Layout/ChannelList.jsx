import { useState, useEffect, act } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHashtag, FaVolumeUp, FaPlus, FaCog, FaAngleDown, FaMusic } from 'react-icons/fa';
import UserProfile from './UserProfile';
import ChannelSettingsModal from '../Modals/ChannelSettingsModal';
import VoiceConnectionPanel from '../Voice/VoiceConnectionPanel';

const ChannelList = ({ 
  serverName, 
  channels, 
  serverId, 
  currentUser, 
  onCreateChannel,
  onDeleteChannel,
  onRenameChannel,
  onOpenSettings,
  onOpenServerSettings,
  onJoinVoice,
  activeVoiceChannel,
  voiceParticipants,
  allVoiceStates = {}, 
  VoiceComponent,
  onLeaveVoice, 
  isMicMuted, 
  toggleMic, 
  isDeafened, 
  toggleDeafen,
  activeChannelId,
  onOpenCreateChannel,
  unreadCounts = {},
  activeBot // 👈 YENİ PROP: Aktif Bot Bilgisi buraya gelecek
}) => {
  const navigate = useNavigate();
  const channelId = activeChannelId;

  const [editingChannel, setEditingChannel] = useState(null);
  
  const [isVoiceCollapsed, setIsVoiceCollapsed] = useState(false);
  const [isTextCollapsed, setIsTextCollapsed] = useState(false);

  const textChannels = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  const handleChannelClick = (id) => {
      navigate(`/servers/${serverId}/channels/${id}`);
  };

  console.log("Gelen activeBot:", activeBot);

  return (
    <div className="w-60 bg-[#121214] flex flex-col flex-shrink-0 relative h-full">
      
      {/* SUNUCU BAŞLIĞI */}
      <div className="h-12 flex items-center justify-between px-4 font-bold shadow-sm text-white hover:bg-[#35373c] cursor-pointer transition border-b border-[#1f2023] group flex-shrink-0">
        <span className="truncate">{serverName}</span>
        <FaCog 
            className="text-gray-400 hover:text-white transition cursor-pointer" 
            onClick={(e) => {
                e.stopPropagation();
                onOpenServerSettings();
            }}
            title="Sunucu Ayarları"
        />
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        
        {/* --- METİN KANALLARI --- */}
        <div className="mt-2 mb-0.5">
          <div 
            className="flex items-center justify-between px-2 pt-2 pb-1 text-xs font-bold text-[#949BA4] hover:text-white cursor-pointer transition-colors group"
            onClick={() => setIsTextCollapsed(!isTextCollapsed)}
          >
            <div className="flex items-center">
               <FaAngleDown size={12} className={`mr-0.5 transition-transform ${isTextCollapsed ? '-rotate-90' : ''}`} />
               Metin Kanalları
            </div>
            <FaPlus 
                className="cursor-pointer hover:text-white" 
                onClick={(e) => { e.stopPropagation(); onOpenCreateChannel('text'); }}
                title="Kanal Oluştur" 
                size={12}
            />
          </div>
          
          {!isTextCollapsed && textChannels.map(channel => {
              const isActive = channelId === channel._id;
              const count = unreadCounts[channel._id]; 

              return (
                <div 
                    key={channel._id} 
                    onClick={() => handleChannelClick(channel._id)} 
                    className={`group relative flex items-center px-2 py-1.5 rounded-md cursor-pointer mx-2 mb-[2px] transition-all duration-200
                    ${isActive 
                        ? 'bg-[#1A1A1E] text-white' 
                        : 'text-[#949BA4] hover:bg-[#1A1A1E] hover:text-gray-100'}`}
                >
                    {isActive && (
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-r-full"></div>
                    )}
                    <div className="mr-1.5 text-gray-400 group-hover:text-gray-300">
                        {channel.subtype === 'music' ? <FaMusic className={`mr-1.5 ${isActive ? 'text-white' : 'text-[#80848E]'}`} size={16}/> : <FaHashtag className={`mr-1.5 ${isActive ? 'text-white' : 'text-[#80848E]'}`} size={20}/>}
                    </div>
                    
                    <span className={`font-medium truncate flex-1 text-[15px] ${isActive ? 'text-white' : ''}`}>
                        {channel.name}
                    </span>

                    {count > 0 && (
                        <div className="bg-[#F23F42] text-white text-[11px] font-bold px-1.5 h-4 min-w-[16px] flex items-center justify-center rounded-full ml-2 shadow-sm">
                            {count}
                        </div>
                    )}

                    <FaCog 
                        className={`hidden group-hover:block transition-colors ml-1 ${isActive ? 'text-gray-200 hover:text-white' : 'text-gray-400 hover:text-white'}`}
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
                   Ses Kanalları
                </div>
                <FaPlus 
                    className="cursor-pointer hover:text-white" 
                    onClick={(e) => { e.stopPropagation(); onOpenCreateChannel('voice'); }}
                    size={12}
                    title="Ses Kanalı Oluştur"
                />
            </div>
            
            {!isVoiceCollapsed && voiceChannels.map(channel => {
                const isActive = activeVoiceChannel && activeVoiceChannel._id === channel._id;
                
                // Bot bu kanalda mı?
                // Not: activeBot.currentVoiceChannel backend'den gelen ID ile eşleşmeli
                const isBotInThisChannel = activeBot && 
                    String(activeBot.currentVoiceChannel) === String(channel._id) && // ID Eşleşmesi
                    String(activeBot.serverId) === String(serverId);
                console.log(isBotInThisChannel , activeBot);
                console.log(activeBot?.currentVoiceChannel, channel._id);
                console.log(activeBot?.serverId, serverId);
                
                
                
                // Hangi listeyi göstereceğiz?
                const participantsToDisplay = isActive 
                    ? voiceParticipants 
                    : (allVoiceStates[channel._id] || []);
                
                // Eğer biz o kanaldaysak veya bot oradaysa veya başkaları oradaysa listeyi aç
                const shouldExpand = isActive || participantsToDisplay.length > 0 || isBotInThisChannel;

                return (
                    <div key={channel._id}>
                        <div 
                            onClick={() => onJoinVoice(channel)} 
                            className={`group relative flex items-center px-2 py-1.5 rounded-md cursor-pointer mx-2 mb-[2px] transition-all duration-200
                            ${isActive 
                                ? 'bg-[#1A1A1E] text-white' 
                                : 'text-[#949BA4] hover:bg-[#1A1A1E] hover:text-gray-100'}`}
                        >
                            <FaVolumeUp className={`mr-1.5 ${isActive ? 'text-white' : 'text-[#80848E]'}`} size={16} />
                            <span className="font-medium truncate flex-1 text-[15px]">{channel.name}</span>
                            <FaCog 
                                className={`hidden group-hover:block transition-colors ml-1 ${isActive ? 'text-gray-200 hover:text-white' : 'text-gray-400 hover:text-white'}`}
                                onClick={(e) => { e.stopPropagation(); setEditingChannel(channel); }} 
                                size={14}
                            />
                        </div>

                        {/* KATILIMCILAR LİSTESİ (BOT + İNSANLAR) */}
                        {shouldExpand && (
                            <div className="pl-8 pb-2 flex flex-col gap-1">
                                
                                {/* 🤖 ÖZEL BOT KARTI (Sidebar İçin Küçültülmüş) */}
                                {isBotInThisChannel && (
                                    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#35373c] cursor-pointer mb-0.5 bg-green-500/5 border-l-2 border-green-500 mt-1">
                                        {/* Avatar & Ring */}
                                        <div className="relative w-6 h-6 flex-shrink-0">
                                            <img src={activeBot.avatar} className="w-full h-full rounded-full object-cover" />
                                            {/* Mini Bot Tag */}
                                            <div className="absolute -bottom-1 -right-1 bg-[#5865F2] text-white text-[7px] px-1 rounded flex items-center leading-none h-3 border border-[#121214]">BOT</div>
                                        </div>

                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-bold text-white truncate">{activeBot.name}</span>
                                            
                                            {/* Mini Müzik Barları */}
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-green-400 font-medium">Çalıyor</span>
                                                <div className="flex gap-0.5 items-end h-2">
                                                    <div className="w-0.5 bg-green-400 animate-music-bar-1 h-full"></div>
                                                    <div className="w-0.5 bg-green-400 animate-music-bar-2 h-2/3"></div>
                                                    <div className="w-0.5 bg-green-400 animate-music-bar-3 h-1/2"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* NORMAL KULLANICILAR */}
                                {participantsToDisplay.map((p, idx) => {
                                    const user = p.user || p; 
                                    const isSpeaking = p.isSpeaking || false; 

                                    return (
                                        <div key={user._id || idx} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#35373c] cursor-pointer group/user">
                                            <div className={`relative w-6 h-6 rounded-full transition-all duration-100
                                                ${isActive && isSpeaking ? 'ring-2 ring-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : ''}
                                            `}>
                                                <img 
                                                    src={user.avatar || "https://i.pravatar.cc/150"} 
                                                    className={`w-full h-full rounded-full object-cover ${isActive && isSpeaking ? 'opacity-100' : 'opacity-80'}`}
                                                    alt={user.username}
                                                />
                                            </div>
                                            <span className={`text-sm truncate ${isActive && isSpeaking ? 'text-white font-bold' : 'text-gray-400 group-hover/user:text-gray-200'}`}>
                                                {user.nickname || user.username}
                                            </span>
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

      {VoiceComponent}

      {/* 1. SES BAĞLANTI PANELİ */}
      {activeVoiceChannel && (
          <VoiceConnectionPanel 
              channelName={activeVoiceChannel.name}
              onDisconnect={onLeaveVoice}
              serverName={serverName}
          />
      )}

      {/* 2. KULLANICI PROFİLİ */}
      <UserProfile 
          currentUser={currentUser}
          onOpenSettings={() => onOpenSettings()} 
          isMicMuted={isMicMuted}
          toggleMic={toggleMic}
          isDeafened={isDeafened}
          toggleDeafen={toggleDeafen}
      />

      {/* MODALLAR */}
      {editingChannel && <ChannelSettingsModal channel={editingChannel} onClose={() => setEditingChannel(null)} onRename={onRenameChannel} onDelete={onDeleteChannel} />}
    </div>
  );
};

export default ChannelList;