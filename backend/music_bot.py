import asyncio
import os
import sys
import yt_dlp
from livekit import rtc
from livekit.api import AccessToken, VideoGrants
from dotenv import load_dotenv

load_dotenv()

LIVEKIT_URL = os.getenv('LIVEKIT_URL')
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')

async def main(room_name, youtube_url):
    print(f"🤖 Bot Başlatılıyor... Oda: {room_name}")

    # 1. Token
    grant = VideoGrants(room_join=True, room=room_name, can_publish=True, can_subscribe=False)
    token = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET).with_identity("MusicBot").with_name("DJ Bot").with_grants(grant).to_jwt()

    # 2. Bağlantı (UDP Sorununu Azaltmak İçin auto_subscribe=False)
    room = rtc.Room()
    options = rtc.RoomOptions(auto_subscribe=False)

    try:
        await room.connect(LIVEKIT_URL, token, options=options)
        print(f"✅ Bot bağlandı")
    except Exception as e:
        print(f"❌ Bağlantı Hatası: {e}")
        return

    # 3. Youtube Linkini Al
    ydl_opts = {'format': 'bestaudio/best', 'quiet': True, 'noplaylist': True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            audio_url = info['url']
            print(f"▶️ Çalınıyor: {info.get('title')}")
    except Exception as e:
        print(f"❌ URL Hatası: {e}")
        await room.disconnect()
        return

    # 4. Yayın ve FFmpeg
    source = rtc.AudioSource(48000, 2)
    track = rtc.LocalAudioTrack.create_audio_track("music_track", source)
    options = rtc.TrackPublishOptions()
    options.source = rtc.TrackSource.SOURCE_MICROPHONE
    await room.local_participant.publish_track(track, options)

    # FFmpeg Komutu (Linux uyumlu)
    cmd = ['ffmpeg', '-re', '-i', audio_url, '-f', 's16le', '-ac', '2', '-ar', '48000', '-vn', '-loglevel', 'error', '-']
    
    process = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE)
    frame_size = 3840

    try:
        while True:
            data = await process.stdout.read(frame_size)
            if not data: break
            if len(data) < frame_size: break
            await source.capture_frame(rtc.AudioFrame(data, 48000, 2, len(data) // 4))
    except Exception as e:
        print(f"⚠️ Yayın Hatası: {e}")
    finally:
        if process.returncode is None: process.terminate()
        await room.disconnect()

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2]))