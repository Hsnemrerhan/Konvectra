import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { IoMdSend } from 'react-icons/io';
import { FaHashtag, FaPlus, FaSpinner, FaPen, FaTrash, FaFileAlt, FaTimes, FaPlay, FaDownload } from 'react-icons/fa';
import AnimatedAvatar from './AnimatedAvatar';
import AnimatedNickname from './AnimatedNickname';

const ChatArea = ({ 
  messages, 
  currentUser, 
  onSendMessage, // Not: Artık bu fonksiyonu nesne olarak çağıracağız {content, attachmentUrl, attachmentType}
  activeChannelName = "genel-sohbet", 
  activeChannelId,
  onLoadMore,
  hasMore,
  chatType,
  friendAvatar,
  isLoading
}) => {
  const [input, setInput] = useState('');
  const [lastReadMessageId, setLastReadMessageId] = useState(null);
  
  // --- DOSYA YÜKLEME STATE'LERİ ---
  const [selectedFile, setSelectedFile] = useState(null); // Seçilen dosya objesi
  const [previewUrl, setPreviewUrl] = useState(null);     // Önizleme URL'i (Blob)
  const [isUploading, setIsUploading] = useState(false);  // Yükleniyor mu?
  const [fileType, setFileType] = useState(null);         // 'image', 'video', 'file'

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const fileInputRef = useRef(null); // Gizli input referansı

  // --- API URL (Local vs Prod) ---
  const isProduction = window.location.hostname !== 'localhost';
  const API_URL = isProduction ? "https://konvectra.com" : "http://localhost:5000";

  // --- SCROLL AYARLARI ---
  useEffect(() => {
     messagesEndRef.current?.scrollIntoView();
     isAtBottomRef.current = true;
  }, [activeChannelId]);

  useEffect(() => {
     if (currentUser && currentUser.lastRead && activeChannelId) {
         setLastReadMessageId(currentUser.lastRead[activeChannelId] || null);
     }
  }, [activeChannelId, currentUser]);

  useLayoutEffect(() => {
      if (!scrollContainerRef.current) return;
      if (prevScrollHeightRef.current > 0) {
          const newScrollHeight = scrollContainerRef.current.scrollHeight;
          const heightDifference = newScrollHeight - prevScrollHeightRef.current;
          if (heightDifference > 0) scrollContainerRef.current.scrollTop = heightDifference;
          prevScrollHeightRef.current = 0;
      } else {
          const lastMsg = messages[messages.length - 1];
          const senderId = typeof lastMsg?.sender === 'object' ? lastMsg.sender._id : lastMsg?.sender;
          const isMyMessage = senderId === currentUser.id;
          if (isMyMessage || isAtBottomRef.current) {
              messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          }
      }
  }, [messages, currentUser.id]);

  // --- DOSYA SEÇME İŞLEMİ ---
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        setSelectedFile(file);

        // Türü belirle
        if (file.type.startsWith('image/')) setFileType('image');
        else if (file.type.startsWith('video/')) setFileType('video');
        else setFileType('file');

        // Önizleme oluştur
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
    }
  };

  const cancelUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileType(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- MESAJ GÖNDERME (NORMAL + DOSYALI) ---
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!input.trim() && !selectedFile) return;

    // 1. EĞER DOSYA VARSA ÖNCE YÜKLE
    if (selectedFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('attachment', selectedFile);

        try {
            const res = await fetch(`${API_URL}/api/chat/upload`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error("Yükleme başarısız");
            const data = await res.json();

            // Dosya yüklendi, şimdi mesajı socket ile gönder
            onSendMessage({
                content: input, // Dosya ile birlikte yazı da olabilir
                attachmentUrl: data.url,
                attachmentType: data.type
            });

            // Temizlik
            cancelUpload();
            setInput('');
        } catch (error) {
            console.error(error);
            alert("Dosya yüklenemedi!");
        } finally {
            setIsUploading(false);
        }
    } 
    // 2. SADECE YAZI VARSA
    else {
        onSendMessage({ content: input });
        setInput('');
    }
  };

  // --- SCROLL EVENT ---
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop === 0 && hasMore && !isLoading) {
        prevScrollHeightRef.current = scrollHeight;
        onLoadMore();
    }
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isAtBottomRef.current = distanceFromBottom < 50;

    if (isAtBottomRef.current && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg._id !== lastReadMessageId) {
             setLastReadMessageId(lastMsg._id);
             fetch(`${API_URL}/api/channels/${activeChannelId}/ack`, {
                 method: 'POST',
                 headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({ userId: currentUser.id, messageId: lastMsg._id })
             }).catch(err => console.error("Ack error:", err));
        }
    }
  };

  const formatDateTime = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeOnly = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const displayMessages = messages.filter(m => {
      if (!m.channelId) return true;
      return m.channelId === activeChannelId;
  });

  // URL'den dosya ismini çıkaran fonksiyon
  const getFileNameFromUrl = (url) => {
    if (!url) return "Dosya";
    try {
      // URL'in sonundaki parçayı al (örn: 1723123-odev.pdf)
      const fileName = decodeURIComponent(url.split('/').pop());
      // İstersen baştaki timestamp'i temizlemek için regex kullanabilirsin ama şimdilik olduğu gibi gösterelim
      return fileName;
    } catch (e) {
      return "Dosya";
    }
  };

  // Dosya uzantısını bulan fonksiyon (örn: PDF, ZIP)
  const getFileExtension = (url) => {
    if (!url) return "DOSYA";
    return url.split('.').pop().toUpperCase() + " DOSYASI";
  };

  return (
    <div className="flex-1 bg-[#1A1A1E] flex flex-col min-w-0 h-full relative">
      {/* 1. KANAL BAŞLIĞI */}
      {!chatType && (
        <div className="h-12 border-b border-[#26272d] flex items-center px-4 shadow-sm flex-shrink-0 bg-[#121214]">
            <FaHashtag className="text-gray-400 mr-2" size={20} />
            <span className="font-bold text-white mr-4">{activeChannelName}</span>
        </div>
    )}

      {/* 2. MESAJ ALANI */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col"
      >
        {isLoading && (
            <div className="flex justify-center py-2"><FaSpinner className="animate-spin text-gray-400" /></div>
        )}

        {!hasMore && !isLoading && (
            <div className="mt-4 mb-8 px-4">
                <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-4">
                    {chatType ? (
                        <img src={friendAvatar} className="w-full h-full rounded-full object-cover"/>
                    ) : (
                        <FaHashtag size={32} className="text-white"/>
                    )}
                </div>
                <h3 className="font-bold text-white text-3xl mb-2">
                    {chatType ? activeChannelName : `#${activeChannelName} kanalına hoş geldin!`}
                </h3>
                <p className="text-gray-400">
                    {chatType ? `Bu ${activeChannelName} ile olan sohbetin başlangıcı.` : `Burası #${activeChannelName} kanalının başlangıcı.`}
                </p>
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
                const shouldGroup = isSameUser && isNearTime && !msg.attachmentUrl;

                return (
                    <React.Fragment key={msg._id || index}>
                        {/* Okunmamış Mesaj Çizgisi */}
                        {!isMe && lastReadMessageId && msg._id > lastReadMessageId && (!prevMsg || prevMsg._id <= lastReadMessageId) && (
                            <div className="flex items-center my-2 select-none">
                                <div className="h-[1px] bg-red-600 flex-1 opacity-60"></div>
                                <span className="text-[10px] font-bold text-white bg-red-600 px-1 rounded mx-2">YENİ</span>
                                <div className="h-[1px] bg-red-600 flex-1 opacity-60"></div>
                            </div>
                        )}
                                                             {/* color: #212125ff*/}
                        <div className={`group flex pr-4 pl-4 hover:bg-[#212125ff] -mx-4 transition-colors relative ${shouldGroup ? 'py-0.5 mt-0' : 'mt-[17px] py-0.5'}`}>
                            {/* AVATAR */}
                            <div className="w-[50px] flex-shrink-0 cursor-pointer">
                                {!shouldGroup ? (
                                    <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden active:translate-y-0.5 transition-transform mt-0.5">
                                        <AnimatedAvatar 
                                            src={msg.sender?.avatar} 
                                            alt={msg.senderNickname}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-gray-500 hidden group-hover:block text-right w-10 mt-1.5 select-none">
                                        {formatTimeOnly(msg.timestamp)}
                                    </div>
                                )}
                            </div>
                            
                            {/* İÇERİK */}
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
                                
                                {/* METİN İÇERİĞİ */}
                                {msg.content && (
                                    <div className="text-[#dbdee1] whitespace-pre-wrap break-words leading-[1.375rem] text-[15px] font-normal">
                                        {msg.content}
                                    </div>
                                )}
                                {/* --- MEDYA / DOSYA GÖSTERİMİ --- */}
                                {msg.attachmentUrl && (
                                    <div className="mb-2">
                                        {/* RESİM */}
                                        {msg.attachmentType === 'image' && (
                                            <div className="max-w-[500px] max-h-[500px] overflow-hidden rounded-lg cursor-pointer mt-2">
                                                <img 
                                                    src={msg.attachmentUrl} 
                                                    className="max-w-full max-h-full object-contain rounded-lg hover:scale-[1.01] transition"
                                                    alt="attachment"
                                                    onClick={()=> window.open(msg.attachmentUrl, '_blank')}
                                                />
                                            </div>
                                        )}

                                        {/* VİDEO */}
                                        {msg.attachmentType === 'video' && (
                                            <div className="max-w-[500px] max-h-[300px] mt-2">
                                                <video 
                                                    src={msg.attachmentUrl} 
                                                    controls 
                                                    className="w-full rounded-lg bg-black max-w-[500px] max-h-[300px]"
                                                />
                                            </div>
                                        )}

                                        {/* DOSYA (İNDİRME KARTI) */}
                                        {msg.attachmentType === 'file' && (
                                            <div className="flex items-center gap-3 bg-[#121214] p-3 rounded max-w-[500px] mt-2 group/file hover:bg-[#1a1b1e] transition-colors border border-transparent hover:border-[#2b2d31]">
                                                <div className="bg-[#1e1f22] p-3 rounded">
                                                    <FaFileAlt size={24} className="text-blue-400"/>
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    {/* Dosya İsmi */}
                                                    <div 
                                                        className="text-blue-400 text-sm font-medium hover:underline truncate cursor-pointer" 
                                                        onClick={()=> window.open(msg.attachmentUrl, '_blank')}
                                                        title={msg.fileName || getFileNameFromUrl(msg.attachmentUrl)} // Üzerine gelince tam isim yazar
                                                    >
                                                        {/* Varsa veritabanındaki ismi, yoksa URL'den üretilen ismi kullan */}
                                                        {msg.fileName || getFileNameFromUrl(msg.attachmentUrl)}
                                                    </div>
                                                    
                                                    {/* Dosya Uzantısı */}
                                                    <div className="text-gray-500 text-xs font-bold">
                                                        {getFileExtension(msg.attachmentUrl)} {msg.fileSize ? `- ${msg.fileSize}` : ''}
                                                    </div>
                                                </div>
                                                <a href={msg.attachmentUrl} download target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-[#2b2d31] transition">
                                                    <FaDownload />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                            </div>
                        </div>
                    </React.Fragment>
                )
            })}
        </div>
        <div ref={messagesEndRef} className="h-0" />
      </div>

      {/* --- YÜKLEME / ÖNİZLEME MODALI (Discord Tarzı) --- */}
      {selectedFile && (
        <div className="px-4 pb-0 flex-shrink-0">
             <div className="bg-[#2b2d31] rounded-t-lg p-4 flex gap-4 border-b border-[#222327]">
                <div className="w-40 h-40 bg-[#1e1f22] rounded flex items-center justify-center overflow-hidden border border-[#222327] relative">
                    {fileType === 'image' ? (
                        <img src={previewUrl} className="w-full h-full object-contain" alt="preview" />
                    ) : fileType === 'video' ? (
                        <video src={previewUrl} className="w-full h-full object-cover" />
                    ) : (
                        <FaFileAlt size={40} className="text-gray-400" />
                    )}
                    
                    <button onClick={cancelUpload} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg">
                        <FaTimes size={10} />
                    </button>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                    <h4 className="text-white font-bold mb-1">Dosya Yükleniyor</h4>
                    <p className="text-gray-400 text-sm mb-4 truncate">{selectedFile.name}</p>
                    <div className="text-xs text-gray-500">Opsiyonel olarak bir mesaj ekleyebilirsin.</div>
                </div>
             </div>
        </div>
      )}

      {/* 3. INPUT ALANI */}
      <div className={`px-4 pb-6 pt-2 flex-shrink-0 ${selectedFile ? 'bg-[#2b2d31] rounded-b-lg mx-4 pb-4 pt-0 px-4 mb-4' : ''}`}>
          <div className={`${selectedFile ? '' : 'bg-[#383a40]'} rounded-lg px-4 py-3 flex items-center`}>
              
              {/* DOSYA YÜKLEME BUTONU */}
              <button 
                onClick={() => fileInputRef.current.click()} 
                className="text-gray-400 mr-3 hover:text-white transition"
                disabled={isUploading}
              >
                  <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-[#313338] font-bold text-xs hover:bg-white transition">
                    <FaPlus />
                  </div>
              </button>
              
              {/* GİZLİ INPUT */}
              <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleFileSelect} 
                 className="hidden" 
              />

              {/* YAZI INPUT */}
              <form onSubmit={handleSubmit} className="flex-1">
                  <input 
                      className="w-full bg-transparent text-gray-200 outline-none placeholder-[#949BA4] font-medium"
                      placeholder={selectedFile ? "Bir başlık ekle..." : `#${activeChannelName} kanalına mesaj gönder`}
                      value={input}
                      disabled={isUploading}
                      onChange={e => setInput(e.target.value)}
                  />
              </form>
              
              {/* GÖNDER BUTONU */}
              <button onClick={handleSubmit} disabled={isUploading} className="ml-3">
                 {isUploading ? (
                     <FaSpinner className="animate-spin text-blue-500" size={24} />
                 ) : (
                     <IoMdSend size={24} className={`transition ${input.trim() || selectedFile ? 'text-[#5865F2] cursor-pointer' : 'text-gray-500'}`} />
                 )}
              </button>
          </div>
      </div>

    </div>
  );
};

export default ChatArea;