import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useTracks,
  useRoomContext,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles'; // Varsayılan stiller
import { Track } from 'livekit-client';

// Backend API adresiniz
const isProduction = window.location.hostname !== 'localhost';
const API_URL = isProduction
    ? "https://konvectra.com"  // Canlıdaysak Domain (Portsuz)
    : "http://localhost:5000"; // Localdeysek Port 5000

// Docker'da çalışan LiveKit Sunucu adresi (Frontend'den erişilen)
const LIVEKIT_URL = 'wss://konvectra-tpi8ize0.livekit.cloud';

export default function VoiceChannel({ 
  channelId, 
  channelName, 
  user, 
  onLeave, 
  setVoiceParticipants,
  isMicMuted,
  isDeafened 
 }) {
  const [token, setToken] = useState('');

  // 1. Kanal değiştiğinde Backend'den YENİ TOKEN al
  useEffect(() => {
    // Kanal değiştiğinde eski token'ı hemen unut
    setToken('');
    if (!channelId || !user) return;

    const fetchToken = async () => {
      try {
        const response = await fetch(`${API_URL}/api/livekit/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: channelId, // Oda ismi olarak Kanal ID'sini kullanıyoruz (Benzersiz olması için)
            username: user.nickname || user.username,
            userId: user.id || user._id,
            avatar: user.avatar
          }),
        });
        
        const data = await response.json();
        console.log("Backend'den Gelen Cevap:", data);
        setToken(data.token);
      } catch (error) {
        console.error("Token alınamadı:", error);
      }
    };

    fetchToken();
  }, [channelId, user]);

  if (!token) {
    return <div className="p-4 text-gray-400">Ses kanalına bağlanılıyor...</div>;
  }

  return (
    <LiveKitRoom
      video={false} // Başlangıçta video kapalı (Ses kanalı)
      audio={true}  // Mikrofon açık başla
      token={token}
      serverUrl={LIVEKIT_URL}
      data-lk-theme="default"
      style={{ height: '0px', overflow: 'hidden' }} // Discord koyu gri
      onDisconnected={() => {
          setVoiceParticipants([]); // Çıkınca listeyi temizle
          onLeave();
      }} // Bağlantı koparsa veya çıkılırsa tetikle
    >
      {/* Bu bileşen, odadaki tüm sesleri (başkalarının sesini) tarayıcıya verir */}
      {!isDeafened && <RoomAudioRenderer />}

      {/* 👇 GÜNCELLENDİ: Artık cihaz değişimlerini de yönetiyor */}
      <DeviceController isMicMuted={isMicMuted} isDeafened={isDeafened} user={user} />

      {/* 👇 YENİ: Katılımcı Takipçisi */}
      <ParticipantListener setVoiceParticipants={setVoiceParticipants} />
      
      <ControlBar variation="minimal" controls={{ microphone: true, camera: false, screenShare: false, leave: true }} />
    </LiveKitRoom>
  );
}

// ==========================================
// 🛠️ GÜNCELLENMİŞ: Cihaz ve Mikrofon Kontrolcüsü
// ==========================================
function DeviceController({ isMicMuted, isDeafened, user }) {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext(); // 👈 Oda kontrolünü aldık

    // 1. MUTE ve METADATA AYARLARI (GÜVENLİ HALE GETİRİLDİ)
    useEffect(() => {
        if (!localParticipant) return;

        const updateMyState = async () => {
            try {
                // A) Mikrofon Durumu
                const shouldMicBeOn = !isMicMuted && !isDeafened;
                
                // Mikrofonu sadece durum farklıysa değiştir (Gereksiz işlemi önler)
                if (localParticipant.isMicrophoneEnabled !== shouldMicBeOn) {
                    await localParticipant.setMicrophoneEnabled(shouldMicBeOn);
                }

                // B) Metadata (Avatar ve Sağır Durumu)
                const newMetadata = JSON.stringify({
                    avatar: user.avatar,
                    isDeafened: isDeafened
                });

                // 🛡️ ÖNEMLİ KONTROL: Sadece metadata değişmişse sunucuya gönder
                // Bu, "SignalRequestError" hatasını ve flood yapmayı engeller.
                if (localParticipant.metadata !== newMetadata) {
                    await localParticipant.setMetadata(newMetadata);
                }

            } catch (error) {
                // Hata olursa (Timeout vb.) sessizce konsola yaz ama uygulamayı çökertme
                console.warn("⚠️ Metadata/Mikrofon güncellenemedi (Geçici sorun):", error);
            }
        };

        updateMyState();
        
    }, [isMicMuted, isDeafened, localParticipant, user]);

    // 2. 🎧 SES GİRİŞ/ÇIKIŞ CİHAZI SEÇİMİ (YENİ EKLENDİ)
    useEffect(() => {
        if (!room) return;

        const applyDevices = async () => {
            // LocalStorage'dan seçili cihazları oku
            const micId = localStorage.getItem('selectedAudioInput');
            const speakerId = localStorage.getItem('selectedAudioOutput');

            try {
                // Mikrofonu değiştir
                if (micId) {
                    await room.switchActiveDevice('audioinput', micId);
                    console.log("🎤 Mikrofon değiştirildi:", micId);
                }

                // Hoparlörü değiştir (Sadece destekleyen tarayıcılarda, örn: Chrome)
                if (speakerId) {
                    await room.switchActiveDevice('audiooutput', speakerId);
                    console.log("🔊 Hoparlör değiştirildi:", speakerId);
                }
            } catch (error) {
                console.error("Cihaz değiştirme hatası:", error);
            }
        };

        // Bağlanınca hemen uygula
        applyDevices();

        // İPUCU: Kullanıcı ayarlardan cihazı değiştirdiğinde buranın haberi olması için
        // basit bir event listener ekleyebiliriz. (Opsiyonel ama iyi olur)
        const handleStorageChange = () => applyDevices();
        window.addEventListener('device-change-request', handleStorageChange);

        return () => {
            window.removeEventListener('device-change-request', handleStorageChange);
        };

    }, [room]);

    return null;
}

// --- YENİ BİLEŞEN: Katılımcıları Dinleyen ve App.jsx'e Gönderen ---
// VoiceChannel.jsx -> En alttaki bileşen

function ParticipantListener({ setVoiceParticipants }) {
    const participants = useParticipants();
    const audioTracks = useTracks([Track.Source.Microphone]);

    useEffect(() => {
        const formattedParticipants = participants.map(p => {
            const isSpeaking = p.isSpeaking;

            // 1. Metadata'yı Çözümle (Parse)
            let userAvatar = "https://i.pravatar.cc/150"; // Varsayılan
            let isDeafenedRemote = false;
            
            if (p.metadata) {
                try {
                    const meta = JSON.parse(p.metadata);
                    if (meta.avatar) userAvatar = meta.avatar;
                    if (meta.isDeafened) isDeafenedRemote = true;
                } catch (e) {
                    console.error("Metadata okunamadı:", e);
                }
            }

            const isMutedRemote = !p.isMicrophoneEnabled;

            return {
                user: {
                    _id: p.identity,
                    username: p.name,
                    nickname: p.name,
                    avatar: userAvatar // 👈 ARTIK GERÇEK AVATAR BURADA
                },
                isSpeaking: isSpeaking,
                isMuted: isMutedRemote,     // 👇 Listeye eklendi
                isDeafened: isDeafenedRemote
            };
        });

        setVoiceParticipants(formattedParticipants);

    }, [participants, setVoiceParticipants, audioTracks]);

    return null;
}