import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { IoMdSend } from 'react-icons/io';
import { FaHashtag, FaPlus, FaSpinner, FaPen, FaTrash } from 'react-icons/fa';
import AnimatedAvatar from './AnimatedAvatar';
import AnimatedNickname from './AnimatedNickname';

const ChatArea = ({ 
  messages, 
  currentUser, 
  onSendMessage, 
  activeChannelName = "genel-sohbet", 
  activeChannelId,
  onLoadMore,
  hasMore,
  chatType,
  friendAvatar,
  isLoading
}) => {
  const [input, setInput] = useState('');
  
  // Son okunan mesajın ID'sini tutuyoruz (Kırmızı çizgi için)
  const [lastReadMessageId, setLastReadMessageId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const isAtBottomRef = useRef(true);

  // --- 1. STATE VE SCROLL AYARLARI ---
  
  useEffect(() => {
     messagesEndRef.current?.scrollIntoView();
     isAtBottomRef.current = true;
  }, [activeChannelId]);

  // Kanal değişince veya kullanıcı bilgisi güncellenince "Son Okunanı" ayarla
  useEffect(() => {
     if (currentUser && currentUser.lastRead && activeChannelId) {
         setLastReadMessageId(currentUser.lastRead[activeChannelId] || null);
     }
  }, [activeChannelId, currentUser]);

  // --- 2. SCROLL POZİSYON MANTIĞI ---
  useLayoutEffect(() => {
      if (!scrollContainerRef.current) return;

      // A) Pagination Yüklemesi (Eski mesajlar gelince zıplamayı önle)
      if (prevScrollHeightRef.current > 0) {
          const newScrollHeight = scrollContainerRef.current.scrollHeight;
          const heightDifference = newScrollHeight - prevScrollHeightRef.current;
          if (heightDifference > 0) scrollContainerRef.current.scrollTop = heightDifference;
          prevScrollHeightRef.current = 0;
      } 
      // B) Yeni Mesaj veya İlk Yükleme
      else {
          const lastMsg = messages[messages.length - 1];
          const senderId = typeof lastMsg?.sender === 'object' ? lastMsg.sender._id : lastMsg?.sender;
          const isMyMessage = senderId === currentUser.id;

          // Eğer mesajı ben attıysam VEYA zaten en alttaysam -> Aşağı Kaydır
          if (isMyMessage || isAtBottomRef.current) {
              messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          }
      }
  }, [messages, currentUser.id]);

  // --- 3. SCROLL EVENT (OKUNDU BİLGİSİ GÖNDERME) ---
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    // Pagination tetikleyici
    if (scrollTop === 0 && hasMore && !isLoading) {
        prevScrollHeightRef.current = scrollHeight;
        onLoadMore();
    }

    // En altta mıyız kontrolü
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isBottom = distanceFromBottom < 50;
    isAtBottomRef.current = isBottom;

    // YENİ: Eğer en alttaysak ve son mesajı henüz "okundu" işaretlemediysek işaretle
    if (isBottom && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        
        // Veritabanındaki son okuduğum ID, şu anki son mesajdan farklıysa güncelle
        if (lastMsg._id !== lastReadMessageId) {
             setLastReadMessageId(lastMsg._id); // State güncelle (çizgiyi kaldır)
             
             // Backend'e haber ver (API URL'in App.jsx'ten gelmesi veya global olması lazım, burada varsayıyoruz)
             // Not: API_URL değişkeni App.jsx scope'unda olabilir, buraya prop olarak geçmek veya global tanımlamak gerekir.
             // Şimdilik window.location üzerinden dinamik alıyoruz:
             const API_BASE = `http://${window.location.hostname}:5000`; 
             
             fetch(`${API_BASE}/api/channels/${activeChannelId}/ack`, {
                 method: 'POST',
                 headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({ userId: currentUser.id, messageId: lastMsg._id })
             }).catch(err => console.error("Ack error:", err));
        }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  // --- YARDIMCI FORMATLAYICILAR ---
  const formatDateTime = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleString('tr-TR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
      });
  };

  const formatTimeOnly = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  // Filtreleme (Sadece aktif kanal)
  const displayMessages = messages.filter(m => {
      if (!m.channelId) return true;
      return m.channelId === activeChannelId;
  });

  return (
    <div className="flex-1 bg-[#1A1A1E] flex flex-col min-w-0 h-full">
      {/* chatType bir boolean veya kontrol edilebilir bir değer olmalı */}
      {chatType ? (
        
        // --- 1. DURUM: DM MODU (Burayı doldurabilirsin) ---
        <>
            {/* MESAJ LİSTESİ */}
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col"
            >
                {isLoading && (
                    <div className="flex justify-center py-2"><FaSpinner className="animate-spin text-gray-400" /></div>
                )}

                {/* HOŞ GELDİN MESAJI (Tepede) */}
                {!hasMore && !isLoading && (
                    <div className="mt-4 mb-8 px-4">
                        <div className="w-[120px] h-[120px] bg-gray-600 rounded-full flex items-center justify-center mb-4">
                            <img src={friendAvatar} className="w-full h-full rounded-full object-cover"/>
                        </div>
                        <h3 className="font-bold text-white text-[35px] mb-2">{activeChannelName}</h3>
                        <p className="text-gray-400">Bu <span className='font-bold text-white'>{activeChannelName}</span> kullanıcısıyla olan direkt mesaj geçmişinin başlangıcıdır.</p>
                    </div>
                )}

                <div className="flex flex-col pb-4">
                    {displayMessages.map((msg, index) => {
                        const senderId = msg.sender?._id || msg.sender;
                        const isMe = senderId === currentUser.id;
                        
                        const prevMsg = displayMessages[index - 1];
                        const prevSenderId = prevMsg ? (typeof prevMsg.sender === 'object' ? prevMsg.sender._id : prevMsg.sender) : null;
                        const isSameUser = prevSenderId === senderId;
                        const timeDiff = prevMsg ? new Date(msg.timestamp) - new Date(prevMsg.timestamp) : 0;
                        const isNearTime = timeDiff < 60 * 60 * 1000;
                        const shouldGroup = isSameUser && isNearTime;

                        return (
                            <React.Fragment key={msg._id || index}>
                                <div className={`group flex pr-4 pl-4 hover:bg-[#2e3035] -mx-4 transition-colors relative ${shouldGroup ? 'py-0.5 mt-0' : 'mt-[17px] py-0.5'}`}>
                                    <div className="w-[50px] flex-shrink-0 cursor-pointer">
                                        {!shouldGroup ? (
                                            <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden active:translate-y-0.5 transition-transform mt-0.5">
                                                <AnimatedAvatar 
                                                    src={msg.sender?.avatar || "https://i.pravatar.cc/150"} 
                                                    alt={msg.senderNickname}
                                                    className="w-full h-full object-cover" // className'i buraya veriyoruz
                                                />
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-gray-500 hidden group-hover:block text-right w-10 mt-1.5 select-none">
                                            {formatTimeOnly(msg.timestamp)}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        {!shouldGroup && (
                                            <div className="flex items-center gap-2 mb-[2px]">
                                                <AnimatedNickname 
                                                    text={msg.sender?.nickname || msg.sender?.username || 'Kullanıcı'}
                                                    className="font-bold font-medium text-[16px] hover:underline cursor-pointer"
                                                    style={{ color: isMe ? '#eab308' : '#f87171' }} 
                                                />
                                                {msg.sender?.type === 'bot' && (
                                                    <span className="bg-[#5865F2] text-white text-[10px] px-1.5 rounded-[4px] py-[1px] flex items-center h-4 leading-none">
                                                        BOT
                                                    </span>
                                                )}
                                                <span className="text-[12px] text-[#949BA4] font-medium mt-0.5">
                                                    {formatDateTime(msg.timestamp)}
                                                </span>
                                            </div>
                                        )}
                                        <div className={`text-[#dbdee1] whitespace-pre-wrap break-words leading-[1.375rem] text-[15px] font-normal`}>
                                            {msg.content}
                                        </div>
                                    </div>

                                    {isMe && (
                                        <div className="absolute right-4 -top-2 bg-[#313338] border border-[#26272d] rounded shadow-sm p-1 hidden group-hover:flex gap-2 items-center z-10">
                                            <FaPen className="text-gray-400 hover:text-blue-400 cursor-pointer p-1.5 box-content" size={12} title="Düzenle"/>
                                            <FaTrash className="text-gray-400 hover:text-red-400 cursor-pointer p-1.5 box-content" size={12} title="Sil"/>
                                        </div>
                                    )}
                                </div>
                            </React.Fragment>
                        )
                    })}
                </div>
                
                <div ref={messagesEndRef} className="h-0" />
            </div>

            {/* INPUT ALANI */}
            <div className="px-4 pb-6 pt-2 flex-shrink-0">
                <div className="bg-[#222327] rounded-lg px-4 py-2.5 flex items-center">
                    <button className="text-gray-400 mr-3 hover:text-white transition">
                        <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-[#313338] font-bold text-xs hover:bg-white transition"><FaPlus /></div>
                    </button>
                    
                    <form onSubmit={handleSubmit} className="flex-1">
                        <input 
                            className="w-full bg-transparent text-gray-200 outline-none placeholder-[#949BA4] font-medium"
                            placeholder={`${activeChannelName} kişisine mesaj gönder`}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                        />
                    </form>
                    <IoMdSend size={24} className="cursor-pointer text-gray-400 hover:text-[#5865F2] ml-3 transition" onClick={handleSubmit} />
                </div>
            </div>
        </>

      ) : (
        
        // --- 2. DURUM: NORMAL KANAL MODU ---
        <> 
            {/* ÜST BAR */}
            <div className="h-12 border-b border-[#26272d] flex items-center px-4 shadow-sm flex-shrink-0 bg-[#121214]">
                <FaHashtag className="text-gray-400 mr-2" size={20} />
                <span className="font-bold text-white mr-4">{activeChannelName}</span>
            </div>

            {/* MESAJ LİSTESİ */}
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col"
            >
                {isLoading && (
                    <div className="flex justify-center py-2"><FaSpinner className="animate-spin text-gray-400" /></div>
                )}

                {/* HOŞ GELDİN MESAJI (Tepede) */}
                {!hasMore && !isLoading && (
                    <div className="mt-4 mb-8 px-4">
                        <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-4">
                            <FaHashtag size={32} className="text-white"/>
                        </div>
                        <h3 className="font-bold text-white text-3xl mb-2">#{activeChannelName} kanalına hoş geldin!</h3>
                        <p className="text-gray-400">Burası #{activeChannelName} kanalının başlangıcı.</p>
                    </div>
                )}

                <div className="flex flex-col pb-4">
                    {displayMessages.map((msg, index) => {
                        const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
                        const isMe = senderId === currentUser.id;
                        
                        const prevMsg = displayMessages[index - 1];
                        const prevSenderId = prevMsg ? (typeof prevMsg.sender === 'object' ? prevMsg.sender._id : prevMsg.sender) : null;
                        const isSameUser = prevSenderId === senderId;
                        const timeDiff = prevMsg ? new Date(msg.timestamp) - new Date(prevMsg.timestamp) : 0;
                        const isNearTime = timeDiff < 60 * 60 * 1000;
                        const shouldGroup = isSameUser && isNearTime;

                        return (
                            <React.Fragment key={msg._id || index}>
                                <div className={`group flex pr-4 pl-4 hover:bg-[#2e3035] -mx-4 transition-colors relative ${shouldGroup ? 'py-0.5 mt-0' : 'mt-[17px] py-0.5'}`}>
                                    <div className="w-[50px] flex-shrink-0 cursor-pointer">
                                        {!shouldGroup ? (
                                            <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden active:translate-y-0.5 transition-transform mt-0.5">
                                                <AnimatedAvatar 
                                                    src={msg.sender?.avatar || "https://i.pravatar.cc/150"} 
                                                    alt={msg.senderNickname}
                                                    className="w-full h-full object-cover" // className'i buraya veriyoruz
                                                />
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-gray-500 hidden group-hover:block text-right w-10 mt-1.5 select-none">
                                            {formatTimeOnly(msg.timestamp)}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        {!shouldGroup && (
                                            <div className="flex items-center gap-2 mb-1">
                                                <AnimatedNickname 
                                                    text={msg.sender?.nickname || msg.sender?.username || 'Kullanıcı'}
                                                    className="font-bold font-medium text-[16px] hover:underline cursor-pointer"
                                                    style={{ color: isMe ? '#eab308' : '#f87171' }} 
                                                />
                                                <span className="text-[12px] text-[#949BA4] font-medium mt-0.5">
                                                    {formatDateTime(msg.timestamp)}
                                                </span>
                                            </div>
                                        )}
                                        <div className={`text-[#dbdee1] whitespace-pre-wrap break-words leading-[1.375rem] text-[15px] font-normal`}>
                                            {msg.content}
                                        </div>
                                    </div>

                                    {isMe && (
                                        <div className="absolute right-4 -top-2 bg-[#313338] border border-[#26272d] rounded shadow-sm p-1 hidden group-hover:flex gap-2 items-center z-10">
                                            <FaPen className="text-gray-400 hover:text-blue-400 cursor-pointer p-1.5 box-content" size={12} title="Düzenle"/>
                                            <FaTrash className="text-gray-400 hover:text-red-400 cursor-pointer p-1.5 box-content" size={12} title="Sil"/>
                                        </div>
                                    )}
                                </div>
                            </React.Fragment>
                        )
                    })}
                </div>
                
                <div ref={messagesEndRef} className="h-0" />
            </div>

            {/* INPUT ALANI */}
            <div className="px-4 pb-6 pt-2 flex-shrink-0">
                <div className="bg-[#222327] rounded-lg px-4 py-2.5 flex items-center">
                    <button className="text-gray-400 mr-3 hover:text-white transition">
                        <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-[#313338] font-bold text-xs hover:bg-white transition"><FaPlus /></div>
                    </button>
                    
                    <form onSubmit={handleSubmit} className="flex-1">
                        <input 
                            className="w-full bg-transparent text-gray-200 outline-none placeholder-[#949BA4] font-medium"
                            placeholder={`#${activeChannelName} kanalına mesaj gönder`}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                        />
                    </form>
                    <IoMdSend size={24} className="cursor-pointer text-gray-400 hover:text-[#5865F2] ml-3 transition" onClick={handleSubmit} />
                </div>
            </div>
        </> // <--- KAPATICI FRAGMENT BURADA
      )}
    </div>
    );
};

export default ChatArea;