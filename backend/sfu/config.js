// sfu/config.js
module.exports = {
  // Sunucu IP'sini buradan yönetirsin
  announcedIp: '13.1.0.201', 
  mediaCodecs: [
  { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
  { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: { 'x-google-start-bitrate': 1000 } }
], // Test projesindeki codec listesi buraya
  webRtcTransport: {
    listenIps: [ { ip: '0.0.0.0', announcedIp: '13.1.0.201' } ]
  }
};