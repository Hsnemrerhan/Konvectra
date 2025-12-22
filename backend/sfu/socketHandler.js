// sfu/socketHandler.js
const config = require('./config');

// Peers listesini burada tutuyoruz
const peers = {}; 

module.exports = function(io, router) {
  // Ana projedeki socket.io ile karışmaması için "Namespace" kullanıyoruz
  const sfuNamespace = io.of('/sfu'); // ÖNEMLİ: Kanalları ayırdık!

  sfuNamespace.on('connection', (socket) => {
    console.log('Video Servisine Bağlandı:', socket.id);

    console.log('Yeni Kişi:', socket.id);
  
    // Kullanıcı için kayıt oluştur
    peers[socket.id] = { transports: [], producers: [], consumers: [] };

    socket.on('disconnect', () => {
        console.log('Ayrıldı:', socket.id);
        // Gerçek uygulamada burada transportları kapatmak gerekir (cleanup)
        delete peers[socket.id];
    });

    // İlk parametre boş veri ({}), ikinci parametre fonksiyondur
    socket.on('getRouterRtpCapabilities', (_data, callback) => {
        callback(router.rtpCapabilities);
    });

    // --- TRANSPORT OLUŞTURMA (Hem Producer hem Consumer için ortak) ---
    socket.on('createWebRtcTransport', async ({ consumer }, callback) => {
        try {
        const transport = await router.createWebRtcTransport({
            listenIps: [{ ip: '0.0.0.0', announcedIp: '13.1.0.201' }], // <-- SENİN IP ADRESİN BURADA OLMALI
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });

        // Transport'u kaydet
        peers[socket.id].transports.push(transport);

        transport.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'closed') transport.close();
        });

        callback({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        });
        } catch (error) {
        callback({ error: error.message });
        }
    });

    // --- TRANSPORT BAĞLAMA ---
    socket.on('transport-connect', async ({ transportId, dtlsParameters }, callback ) => {
        const transport = peers[socket.id].transports.find(t => t.id === transportId);
        if (transport) await transport.connect({ dtlsParameters });
        callback();
    });

    // --- YAYIN YAPMA (PRODUCE) ---
    socket.on('transport-produce', async ({ transportId, kind, rtpParameters }, callback) => {
        const transport = peers[socket.id].transports.find(t => t.id === transportId);
        
        if (transport) {
        const producer = await transport.produce({ kind, rtpParameters });
        peers[socket.id].producers.push(producer);

        // ÖNEMLİ: Odadaki diğer herkese "Yeni yayıncı var" diye haber ver!
        socket.broadcast.emit('new-producer', { producerId: producer.id });

        callback({ id: producer.id });
        }
    });

    // --- YAYIN ALMA (CONSUME) ---
    socket.on('consume', async ({ transportId, producerId, rtpCapabilities }, callback) => {
        const transport = peers[socket.id].transports.find(t => t.id === transportId);

        if (router.canConsume({ producerId, rtpCapabilities })) {
        const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: true,
        });
        
        peers[socket.id].consumers.push(consumer);

        callback({
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
        });

        await consumer.resume();
        }
    });

    // --- MEVCUT YAYINCILARI LİSTELE ---
    // Yeni gelen kişi, odaya girdiğinde zaten içeride olanları öğrenmeli
    socket.on('getProducers', (callback) => {
        // Tüm socket'leri gez, onların producer'larını topla
        let producerList = [];
        for (const peerId in peers) {
            peers[peerId].producers.forEach(producer => {
                producerList.push(producer.id);
            });
        }
        callback(producerList);
    });
  });
};