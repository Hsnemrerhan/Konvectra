import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useTracks,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles'; // Varsayılan stiller
import { Track } from 'livekit-client';

// Backend API adresiniz
const API_URL = 'http://192.168.0.34:5000'; 
// Docker'da çalışan LiveKit Sunucu adresi (Frontend'den erişilen)
const LIVEKIT_URL = 'ws://192.168.0.34:7880';

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

      {/* 👇 YENİ: Mikrofonu ve Listeyi Yöneten Bileşenler */}
      <MicController isMicMuted={isMicMuted} isDeafened={isDeafened} user={user} />

      {/* 👇 YENİ: Katılımcı Takipçisi */}
      <ParticipantListener setVoiceParticipants={setVoiceParticipants} />
      
      <ControlBar variation="minimal" controls={{ microphone: true, camera: false, screenShare: false, leave: true }} />
    </LiveKitRoom>
  );
}

// ==========================================
// 🛠️ YENİ BİLEŞEN: Mikrofon Kontrolcüsü
// ==========================================
function MicController({ isMicMuted, isDeafened, user }) {
    // Kendi katılımcı objemizi alıyoruz
    const { localParticipant } = useLocalParticipant();

    useEffect(() => {
        if (!localParticipant) return;

        // Mantık: Eğer mute değilsek VE sağır değilsek mikrofon açık olsun.
        const shouldMicBeOn = !isMicMuted && !isDeafened;

        // LiveKit'e emri veriyoruz:
        localParticipant.setMicrophoneEnabled(shouldMicBeOn);

        const newMetadata = {
            avatar: user.avatar,
            isDeafened: isDeafened
        };

        localParticipant.setMetadata(JSON.stringify(newMetadata));
        
      }, [isMicMuted, isDeafened, localParticipant, user]);

    return null; // Görüntü yok, sadece mantık
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