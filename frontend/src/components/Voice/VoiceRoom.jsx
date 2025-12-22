import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";

// Görünmez Ses Oynatıcı (Her katılımcı için bir tane oluşur)
// AudioPlayer'a 'muted' özelliği eklendi (Deafen için)
const AudioPlayer = ({ peer, muted }) => { 
    const ref = useRef();
    useEffect(() => {
        peer.on("stream", stream => {
            if (ref.current) ref.current.srcObject = stream;
        });
    }, [peer]);
    // Eğer 'muted' true ise ses çıkmaz
    return <audio playsInline autoPlay ref={ref} muted={muted} />;
};

const VoiceRoom = ({ 
    serverId, 
    channelId, 
    socket, 
    currentUser, 
    setVoiceParticipants ,
    isMicMuted,
    isDeafened
}) => {
    // Referanslar
    const userStream = useRef();
    const peersRef = useRef([]); // [{ peerID, peer }]
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const silenceTimer = useRef(null);

    const [musicUrl, setMusicUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [activeBot, setActiveBot] = useState(null); // Odadaki bot

    // 1. MİKROFON KONTROLÜ (MUTE) 🎤
    useEffect(() => {
        if (userStream.current) {
            const audioTrack = userStream.current.getAudioTracks()[0];
            if (audioTrack) {
                // Eğer isMicMuted true ise enabled = false (kapat)
                // Ayrıca 'Deafen' açıksa mikrofon kesinlikle kapalı olmalı
                audioTrack.enabled = !isMicMuted && !isDeafened;
            }
        }
        // Kendimize görsel güncelleme (Yeşil ışığı söndür)
        if (isMicMuted || isDeafened) {
             // (Opsiyonel: Burada updateMySpeakingStatus(false) çağırılabilir)
        }
    }, [isMicMuted, isDeafened]);

    useEffect(() => {
        // 1. Mikrofon İzni Al
        navigator.mediaDevices.getUserMedia({ video: false, audio: true })
            .then(stream => {
                userStream.current = stream;
                
                // 2. Kendini Listeye Ekle (Başlangıçta)
                setVoiceParticipants(prev => {
                    // Eğer zaten varsa ekleme
                    if (prev.find(p => p.user._id === currentUser.id)) return prev;
                    return [...prev, { user: currentUser, isSpeaking: false, isSelf: true }];
                });

                // 3. Ses Analizini Başlat (Konuşuyor muyum?)
                startAudioAnalysis(stream);

                // 4. Odaya Katıl
                socket.emit("join_voice_room", channelId);

                // --- SOCKET OLAYLARI ---

                // A) GÖRSEL LİSTE YÖNETİMİ (KİM VAR KİM YOK?) 🖼️
                
                // Odaya girince: İçeridekilerin listesini al
                socket.on("voice_room_participants", (participants) => {
                    // Gelen listede 'isSelf' ayarını yap
                    const formatted = participants.map(p => ({
                        ...p,
                        isSelf: p.user._id === currentUser.id || p.user.id === currentUser.id
                    }));
                    setVoiceParticipants(formatted);
                });

                // Başkası girince: Listeye ekle
                socket.on("user_joined_voice_visual", (newParticipant) => {
                    setVoiceParticipants(prev => {
                        if (prev.find(p => p.user._id === newParticipant.user._id)) return prev;
                        return [...prev, newParticipant];
                    });
                });

                // Başkası çıkınca: Listeden sil
                socket.on("user_left_voice_visual", (leftUserId) => {
                     setVoiceParticipants(prev => prev.filter(p => p.user._id !== leftUserId && p.user.id !== leftUserId));
                });

                // B) WEBRTC SES BAĞLANTILARI (GÖRÜNMEZ KABLOLAR) 🎤
                
                // Odadaki mevcut kullanıcılarla p2p bağlantı kur
                socket.on("all_users_in_voice", users => {
                    users.forEach(userID => {
                        const peer = createPeer(userID, socket.id, stream);
                        peersRef.current.push({ peerID: userID, peer });
                    });
                });

                // Yeni gelen biri benimle bağlantı kuruyor
                socket.on("user_joined_voice", payload => {
                    const peer = addPeer(payload.signal, payload.callerID, stream);
                    peersRef.current.push({ peerID: payload.callerID, peer });
                });

                // Sinyal cevabı geldi
                socket.on("receiving_returned_signal", payload => {
                    const item = peersRef.current.find(p => p.peerID === payload.id);
                    if (item) item.peer.signal(payload.signal);
                });

                socket.on('music_command', (data) => {
                    if (data.action === 'play') {
                        setMusicUrl(data.url); // Cache-busting eklemişsen onu burada yap
                        // Bot bilgisini kaydet
                        if (data.bot) {
                        }
                    }
                    if (data.action === 'stop') {
                        setMusicUrl(null);
                    }
                });

                // Biri ses bağlantısını kopardı
                socket.on("user_left_voice", id => {
                    const peerObj = peersRef.current.find(p => p.peerID === id);
                    if(peerObj) peerObj.peer.destroy();
                    peersRef.current = peersRef.current.filter(p => p.peerID !== id);
                });
            })
            .catch(err => {
                console.error("Mikrofon hatası:", err);
                alert("Mikrofona erişilemedi. Lütfen izin verin.");
            });

        // --- TEMİZLİK (Component Unmount) ---
        return () => {
            // Streamleri durdur
            if (userStream.current) userStream.current.getTracks().forEach(t => t.stop());
            if (audioContextRef.current) audioContextRef.current.close();
            
            // Socket dinleyicilerini kaldır
            socket.off("voice_room_participants");
            socket.off("user_joined_voice_visual");
            socket.off("user_left_voice_visual");
            socket.off("all_users_in_voice");
            socket.off("user_joined_voice");
            socket.off("receiving_returned_signal");
            socket.off("user_left_voice");
            socket.off('music_command');
            
            // Peerları yok et
            peersRef.current.forEach(p => p.peer.destroy());
            
            // State'i temizle
            setVoiceParticipants([]); 
        };
        // eslint-disable-next-line
    }, [channelId]);

    // --- SES ANALİZİ (VAD - Voice Activity Detection) ---
    const startAudioAnalysis = (stream) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;

        microphone.connect(analyser);
        analyser.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        let isSpeaking = false;

        scriptProcessor.onaudioprocess = () => {
            const array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            
            let values = 0;
            const length = array.length;
            for (let i = 0; i < length; i++) values += array[i];
            const average = values / length;

            // Eşik Değeri: 15 (Ortam gürültüsüne göre ayarlanabilir)
            if (average > 15) {
                if (!isSpeaking) {
                    isSpeaking = true;
                    updateMySpeakingStatus(true);
                }
                
                if (silenceTimer.current) clearTimeout(silenceTimer.current);
                
                // Sustuktan 500ms sonra kapat (Titreşimi önlemek için)
                silenceTimer.current = setTimeout(() => {
                    isSpeaking = false;
                    updateMySpeakingStatus(false);
                }, 500);
            }
        };
    };

    const updateMySpeakingStatus = (status) => {
        // 1. Kendi görselimi güncelle
        setVoiceParticipants(prev => prev.map(p => {
            if (p.isSelf) return { ...p, isSpeaking: status };
            return p;
        }));

        // 2. Diğerlerine "Ben konuşuyorum" sinyali at
        socket.emit("speaking_status", { roomID: channelId, isSpeaking: status });
    };

    // --- WEBRTC YARDIMCILARI ---
    function createPeer(userToSignal, callerID, stream) {
        const peer = new Peer({ initiator: true, trickle: false, stream });
        peer.on("signal", signal => socket.emit("sending_signal", { userToSignal, callerID, signal }));
        return peer;
    }

    function addPeer(incomingSignal, callerID, stream) {
        const peer = new Peer({ initiator: false, trickle: false, stream });
        peer.on("signal", signal => socket.emit("returning_signal", { signal, callerID }));
        peer.signal(incomingSignal);
        return peer;
    }

    // Görünmez Audio Oynatıcıları (Listeyi state değil ref üzerinden render ediyoruz)
    // React state gecikmesinden etkilenmemek için
    // Ancak görsel olarak bir şey basmıyoruz, sadece <audio> etiketleri var.
    return (
        <>
            <div className="hidden">
                {peersRef.current.map((p, i) => (
                    <AudioPlayer 
                        key={i} 
                        peer={p.peer} 
                        // Eğer Deafen açıksa (Sağırlaştırma), gelen sesleri sustur
                        muted={isDeafened} 
                    />
                ))}
            </div>
            {/* --- SUNUCU TABANLI MÜZİK OYNATICI --- */}
            {/* ReactPlayer YOK, sadece basit bir Audio etiketi var */}
            {musicUrl && (
                <audio 
                    src={musicUrl}
                    autoPlay 
                    controls={false} // Kullanıcı durduramasın, bot yönetsin
                    style={{ display: 'none' }} // Görünmesine gerek yok
                    onPlay={() => console.log("🎵 Sunucudan ses akışı başladı!")}
                    onError={(e) => console.error("Ses Hatası:", e)}
                    onEnded={()=>{socket.emit('music_ended', { channelId: channelId });}}
                    // Ses seviyesini state'den alması için ref kullanabilirsin ama şimdilik %100 çalar
                />
            )}
            
            {/* Botun çaldığı şarkı bilgisini ekranda şık bir şekilde gösterebilirsin */}
            {isPlaying && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-green-400 px-4 py-2 rounded-full flex items-center gap-2 z-50 animate-pulse border border-green-500/50">
                    <span className="text-xl">🎵</span>
                    <span className="text-sm font-bold">Müzik Çalıyor</span>
                </div>
            )}
        </>
    );
};

export default VoiceRoom;