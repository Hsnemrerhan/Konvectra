const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const { spawn } = require('child_process');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ytdl = require('@distube/ytdl-core'); // YouTube indirici
const ffmpeg = require('fluent-ffmpeg'); // Ses işleyici
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const authMiddleware = require('./middleware/auth');
const { AccessToken, WebhookReceiver } = require('livekit-server-sdk');

require('dotenv').config();
ffmpeg.setFfmpegPath(ffmpegPath);

// --- AYARLAR ---
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const webhookReceiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use('/avatars', express.static(path.join(__dirname, 'public/avatars')));

app.use((req, res, next) => {
    // Sadece avatar isteği geldiğinde log alalım
    if (req.url.includes('/avatar') && req.method === 'POST') {
        console.log('🔥 --- AVATAR İSTEĞİ YAKALANDI --- 🔥');
        console.log('Gelen Content-Type:', req.headers['content-type']);
        console.log('---------------------------------------');
    }
    next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"], credentials: true }
});
let globalVoiceState = {};
const JWT_SECRET = process.env.JWT_SECRET; 

// --- BACKBLAZE B2 AYARLARI ---
const s3 = new S3Client({
  // ÖNEMLİ: Kendi Endpoint'ini ve Region'ını yaz.
  // Örn: Endpoint "s3.us-west-004.backblazeb2.com" ise Region "us-west-004"tür.
  endpoint: "https://s3.eu-central-003.backblazeb2.com", 
  region: "eu-central-003", 
  credentials: {
    accessKeyId: process.env.BACKBLAZE_KEY_ID, // Backblaze Key ID
    secretAccessKey: process.env.BACKBLAZE_APP_KEY // Backblaze Application Key
  }
});

const BUCKET_NAME = process.env.BACKBLAZE_BUCKET; // Oluşturduğun Bucket adı

// --- MULTER AYARLARI (GEÇİCİ DEPOLAMA) ---

// Uploads klasörü yoksa oluştur (Hata almamak için)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Dosyayı diske kaydetme kuralı
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // Çakışmayı önlemek için benzersiz isim: fieldname-userid-zaman.jpg
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // req.params.userId henüz burada erişilebilir olmayabilir, o yüzden sadece uniqueSuffix yeterli
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Sadece resim dosyalarına izin ver
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
    }
};

const upload = multer({ storage: storage, limits: { fileSize: 100 * 1024 * 1024 } }); // Max 5MB

// --- MONGODB BAĞLANTISI ---
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Bağlantısı Başarılı'))
  .catch(err => console.error('❌ MongoDB Hatası:', err));

// --- REDIS BAĞLANTISI ---
const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
    await redisClient.connect();
    console.log("✅ Redis Bağlantısı Başarılı!");
})();

// --- REDIS YARDIMCI FONKSİYONLARI ---
async function setUserStatus(userId, status) {
    await redisClient.set(`status:${userId}`, status);
}

async function getUserStatus(userId) {
    const status = await redisClient.get(`status:${userId}`);
    return status || 'offline';
}

// --- ŞEMALAR (AYNI) ---
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  nickname: { type: String },
  friendCode: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String },
  status: { type: String, default: 'offline' }, 
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  incomingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  outgoingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notifications: [{
      type: { type: String }, // 'kick', 'ban' vs.
      serverName: String,
      kickerName: String,
      timestamp: { type: Date, default: Date.now }
  }],
  lastRead: { type: Map, of: String, default: {} }
}, { timestamps: true });
const User = mongoose.model('User', UserSchema);

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, default: '#99aab5' },
  permissions: [String]
});

const ServerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  roles: [RoleSchema], 
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    roles: [{ type: mongoose.Schema.Types.ObjectId }]
  }],
  channels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Channel' }]
});
const ServerModel = mongoose.model('Server', ServerSchema);

const ChannelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, default: 'text', enum: ['text', 'voice', 'dm'] }, 
  // 👇 YENİ ALAN: Kanalın özelleştirilmiş hali (normal, music, announcement vs.)
  subtype: { type: String, default: 'normal', enum: ['normal', 'music'] },
  serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
const Channel = mongoose.model('Channel', ChannelSchema);

const MessageSchema = new mongoose.Schema({
  content: String,
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
  attachmentUrl: { type: String, default: null }, // Dosya Linki
  attachmentType: { type: String, default: null }, // 'image', 'video', 'file'
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const BotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: { type: String }, // Varsayılan Bot Resmi
  type: { type: String, default: 'music', enum: ['music', 'moderation'] }, // İleride başka botlar eklersin
  
  // Hangi sunucuya ait?
  serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  
  // Şu an hangi kanalda? (Null ise hiçbir kanalda değil)
  currentVoiceChannel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
  boundTextChannel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
  currentSongUrl: { type: String, default: null },
  isOnline: { type: Boolean, default: true }
});
const Bot = mongoose.model('Bot', BotSchema);

function generateFriendCode(length = 7) {
    // 0, O, I, 1 gibi kafa karıştıranları çıkardım.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// --- YARDIMCI FONKSİYON: DOSYAYI BULUTA YÜKLE VE SİL ---
// folderPath parametresi eklendi (Örn: 'users', 'servers/123/channels/456')
async function uploadToB2(file, folderPath) {
    const fileStream = fs.createReadStream(file.path);
    
    // Dosya uzantısını al (.jpg, .png vs)
    const ext = path.extname(file.originalname);
    
    // Dosya Adı Stratejisi:
    // 1. Türkçe karakter ve boşluk sorunları olmasın diye timestamp kullanıyoruz.
    // 2. Browser cache (önbellek) sorunu yaşamamak için her yüklemede isim benzersiz olmalı.
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;

    // BACKBLAZE KEY (DOSYA YOLU)
    // Örn: users/17823213-resim.jpg
    const key = `${folderPath}/${uniqueName}`; 

    const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key, 
        Body: fileStream,
        ContentType: file.mimetype, 
    };

    try {
        await s3.send(new PutObjectCommand(uploadParams));
        
        // Yerel dosyayı sil
        fs.unlinkSync(file.path);

        // Public URL oluştur
        const endpointUrl = "https://s3.eu-central-003.backblazeb2.com"; // Kendi endpointin
        const fileUrl = `${endpointUrl}/${BUCKET_NAME}/${key}`;
        
        return fileUrl;
    } catch (err) {
        console.error("B2 Upload Hatası:", err);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new Error("Dosya buluta yüklenemedi.");
    }
}

// --- ESKİ DOSYAYI SİLME FONKSİYONU ---
async function deleteFromB2(fileUrl) {
    if (!fileUrl) return;
    
    // Sadece bizim bucket'taki dosyaları silmeye çalışalım (pravatar.cc vs. silinmez)
    if (!fileUrl.includes("backblazeb2.com") || !fileUrl.includes(BUCKET_NAME)) return;

    try {
        // URL: https://s3.us-west-004.backblazeb2.com/MY-BUCKET/users/resim.jpg
        // Bizim ihtiyacımız olan Key: users/resim.jpg
        
        // URL'i parçala ve Key'i bul
        const urlParts = fileUrl.split(`${BUCKET_NAME}/`);
        if (urlParts.length < 2) return;
        
        const key = urlParts[1]; // users/resim.jpg kısmını alır

        const deleteParams = {
            Bucket: BUCKET_NAME,
            Key: key,
        };

        await s3.send(new DeleteObjectCommand(deleteParams));
        console.log(`🗑️ Eski dosya silindi: ${key}`);
    } catch (err) {
        console.error("Dosya silme hatası:", err);
        // Hata olsa bile akışı bozmayalım, loglayıp devam edelim.
    }
}

// --- API ROTALARI ---

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'Bu kullanıcı adı dolu!' });

    // 2. Benzersiz Friend Code Üretme Döngüsü
    let friendCode;
    let isUnique = false;

    // Eşsiz bir kod bulana kadar dön (Genelde ilk seferde bulur)
    while (!isUnique) {
        friendCode = generateFriendCode(); // 6 haneli kod üret
        
        // Veritabanında bu koda sahip BAŞKA biri var mı diye bak
        // NOT: Eğer sadece "Username + FriendCode" benzersiz olsun istersen sorguyu değiştirmen gerekir.
        // Ama 6 haneli sistemde kodu "Global Benzersiz" (TC Kimlik gibi) yapmak daha sağlıklıdır.
        // Böylece arkadaş ararken sadece kodu girmeleri yeterli olur.
        const checkCode = await User.findOne({ friendCode });
        
        if (!checkCode) {
            isUnique = true; // Kimse kullanmıyor, döngüden çık
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 👇 YENİ KISIM: İSİM LİSTESİNDEN SEÇİM
    const avatarNames = ['nova', 'silas', 'arlo', 'maya', 'felix', 'jasper', 'luna'];
    
    // Listeden rastgele bir isim seç
    const randomName = avatarNames[Math.floor(Math.random() * avatarNames.length)];

    // URL'i oluştur
    const avatarUrl = `https://konvectra.com/avatars/${randomName}.png`;

    const newUser = new User({ username, nickname, friendCode, password: hashedPassword, avatar: avatarUrl });
    await newUser.save();
    res.status(201).json({ message: 'Kullanıcı oluşturuldu!', friendCode });
  } catch (err) {
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// GİRİŞ YAP
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Kullanıcı bulunamadı!' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Hatalı parola!' });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    const currentStatus = await getUserStatus(user._id.toString());

    // DÜZELTME BURADA: id alanını manuel olarak ekliyoruz
    const userObj = user.toObject();
    userObj.id = user._id; // Frontend bu alanı bekliyor!
    userObj.status = currentStatus;
    delete userObj.password;

    res.json({ 
      token, 
      user: userObj
    });
  } catch (err) {
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// ==========================================
// 🔥 LIVEKIT TOKEN API'Sİ (GÜNCELLENMİŞ) 🔥
// ==========================================
app.post('/api/livekit/token', async (req, res) => {
    try {
        const { roomName, userId, username, avatar } = req.body;

        if (!roomName || !userId || !username) {
            return res.status(400).json({ error: 'Eksik parametreler' });
        }

        // Token Oluştur
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: String(userId), // 👈 DİKKAT: userId'yi String'e çevirmek daha güvenlidir
            name: username,
            metadata: JSON.stringify({ 
                avatar: avatar
            }),
        });

        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canUpdateOwnMetadata: true,
        });

        // ✅ await burada var, bu çok önemli!
        const token = await at.toJwt();

        console.log(`🎟️ Token verildi: ${username} -> ${roomName}`); // Log eklemek iyidir
        res.json({ token });
    } catch (err) {
        console.error("Token hatası:", err);
        res.status(500).json({ error: 'Token oluşturulamadı' });
    }
});

// 1. KULLANICININ VERİLERİNİ GETİR
app.get('/api/users/me', async (req, res) => {
  const { userId } = req.query; 
  try {
    const userDoc = await User.findById(userId)
      .populate('friends')
      .populate('incomingRequests')
      .lean();

    if (!userDoc) return res.status(404).json({message: "User not found"});

    // id alanını buraya da ekleyelim ki fetchUserData sonrası state bozulmasın
    userDoc.id = userDoc._id; 

    // ... (Redis arkadaş durumları kodu aynı kalacak) ...
    if (userDoc.friends && userDoc.friends.length > 0) {
        const friendsWithStatus = await Promise.all(userDoc.friends.map(async (friend) => {
            const status = await getUserStatus(friend._id.toString());
            return { ...friend, status: status, id: friend._id }; // arkadaşlara da id ekleyelim
        }));
        userDoc.friends = friendsWithStatus;
    }

    // ... (Sunucu çekme kodu aynı kalacak) ...
    const servers = await ServerModel.find({ "members.user": userId })
      // friendCode ve id alanını select içine ekledik
      .populate({ path: 'members.user', select: 'username nickname avatar status friendCode' }) 
      .populate('channels')
      .lean();

    // ... (Redis sunucu üyeleri kodu aynı kalacak) ...
    for (let server of servers) {
        if (server.members) {
            const membersWithStatus = await Promise.all(server.members.map(async (member) => {
                const status = await getUserStatus(member.user._id.toString());
                member.user.status = status;
                member.user.id = member.user._id; // üyelere de id ekleyelim
                return member;
            }));
            server.members = membersWithStatus;
        }
    }
    
    userDoc.status = await getUserStatus(userId);

    // 4. OKUNMAMIŞ MESAJ SAYILARINI HESAPLA (ID BAZLI) 🧮
    const unreadCounts = {};

    for (const server of servers) {
        if (server.channels) {
            for (const channel of server.channels) {
                // Kullanıcının bu kanalda gördüğü SON mesaj ID'si
                const lastReadMsgId = userDoc.lastRead ? userDoc.lastRead[channel._id.toString()] : null;

                if (!lastReadMsgId) {
                    // Hiç okumamışsa hepsini say (Limitli)
                    const count = await Message.countDocuments({ channelId: channel._id });
                    if (count > 0) unreadCounts[channel._id.toString()] = count;
                } else {
                    // Gördüğü ID'den DAHA BÜYÜK (daha yeni) olan ID'leri say
                    const count = await Message.countDocuments({ 
                        channelId: channel._id,
                        _id: { $gt: lastReadMsgId } 
                    });
                    if (count > 0) unreadCounts[channel._id.toString()] = count;
                }
            }
        }
    }

    res.json({ user: userDoc, servers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:userId', async (req, res) => {
  const { userId } = req.params;
  const { nickname, avatar, status, currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: "Mevcut şifre gerekli." });
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: "Mevcut şifre hatalı." });
      user.password = await bcrypt.hash(newPassword, 10);
    }
    if (nickname) user.nickname = nickname;
    if (avatar) user.avatar = avatar;
    if (status) {
        user.status = status; 
        await setUserStatus(userId, status);
    }
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    userResponse.status = status || await getUserStatus(userId);

    io.emit('user_updated', userResponse);
    res.json(userResponse);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/channels/create', async (req, res) => {
  const { serverId, name, type } = req.body;
  try {
    const newChannel = new Channel({ name, type, serverId });
    await newChannel.save();
    await ServerModel.findByIdAndUpdate(serverId, { $push: { channels: newChannel._id } });
    // YENİ: Herkese haber ver! 📢
    io.emit('channel_created', newChannel);
    res.json(newChannel);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. KANAL SİL (GÜNCELLENMİŞ - Silen Kişi Bilgisiyle)
app.delete('/api/channels/:channelId', async (req, res) => {
  const { channelId } = req.params;
  const { userId } = req.body; // <--- Frontend'den bunu göndereceğiz

  try {
    const channel = await Channel.findById(channelId);
    if(!channel) return res.status(404).json({message: "Kanal bulunamadı"});

    // Silen kişinin ismini bulalım
    const deleterUser = await User.findById(userId);
    const deleterName = deleterUser ? (deleterUser.nickname || deleterUser.username) : "Biri";

    // 1. Sunucudan çıkar
    await ServerModel.findByIdAndUpdate(channel.serverId, {
      $pull: { channels: channelId }
    });

    // 2. Kanalı ve mesajları sil
    await Message.deleteMany({ channelId });
    await Channel.findByIdAndDelete(channelId);

    // 3. Herkese detaylı haber ver! 📢
    io.emit('channel_deleted', { 
        channelId, 
        serverId: channel.serverId,
        channelName: channel.name,
        deleterName // <--- ARTIK BU DA GİDİYOR
    });

    res.json({ message: "Kanal silindi" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/channels/:channelId', async (req, res) => {
  const { channelId } = req.params;
  const { name } = req.body;
  try {
    const updatedChannel = await Channel.findByIdAndUpdate(channelId, { name }, { new: true });
    res.json(updatedChannel);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DM KANALI BUL VEYA OLUŞTUR
app.post('/api/channels/dm', async (req, res) => {
    const { myId, friendId } = req.body;

    try {
        // 1. Bu iki kişinin olduğu bir DM kanalı var mı?
        // $all operatörü: members dizisinde HEM myId HEM friendId olanı bul.
        let channel = await Channel.findOne({
            type: 'dm',
            members: { $all: [myId, friendId] }
        });

        // 2. Varsa ID'sini döndür
        if (channel) {
            return res.json({ channelId: channel._id });
        }

        // 3. Yoksa YENİ OLUŞTUR
        const newChannel = new Channel({
            type: 'dm',
            members: [myId, friendId],
            name: 'dm' // Sembolik isim
        });

        await newChannel.save();
        res.json({ channelId: newChannel._id });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MESAJI OKUNDU İŞARETLE (ACKNOWLEDGE)
app.post('/api/channels/:channelId/ack', async (req, res) => {
    const { channelId } = req.params;
    const { messageId, userId } = req.body; // userId: Frontend göndermeli

    try {
        const user = await User.findById(userId);
        if(user) {
            // Sadece daha yeni bir mesaj gördüyse güncelle (Eskiye dönünce bozma)
            const currentLastRead = user.lastRead.get(channelId);
            
            // Eğer daha önce hiç okumamışsa VEYA yeni ID eskisinden büyükse (alfanümerik karşılaştırma ObjectId için çalışır)
            if (!currentLastRead || messageId > currentLastRead) {
                user.lastRead.set(channelId, messageId);
                await user.save();
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/servers/join', async (req, res) => {
  const { serverId, userId } = req.body;
  try {
    const server = await ServerModel.findById(serverId);
    if (!server) return res.status(404).json({ message: "Sunucu bulunamadı" });
    const isMember = server.members.some(m => m.user.toString() === userId);
    if (isMember) return res.status(400).json({ message: "Zaten üyesiniz" });
    server.members.push({ user: userId, roles: [] });
    await server.save();
    res.json({ message: "Katılım başarılı", server });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. SUNUCU OLUŞTUR (GÜNCELLENDİ: Populate Eklendi)
app.post('/api/servers/create', async (req, res) => {
  const { name, ownerId } = req.body;
  try {
    // 1. Sunucuyu Oluştur (Kanal yok, sadece üye var)
    const newServer = new ServerModel({
      name,
      owner: ownerId,
      members: [{ user: ownerId, roles: [] }],
      channels: [] 
    });

    await newServer.save();
    
    // 2. KRİTİK NOKTA: Oluşturulan sunucuyu hemen geri çekip POPULATE etmeliyiz.
    // Yoksa frontend sadece ID görür, avatar göremez.
    const populatedServer = await ServerModel.findById(newServer._id)
        .populate({ path: 'members.user', select: 'username nickname avatar status friendCode' })
        .lean();

    // 3. Redis Status Entegrasyonu (Yaratıcının online durumunu ekle)
    if (populatedServer.members) {
        for (let member of populatedServer.members) {
            const realStatus = await getUserStatus(member.user._id.toString());
            member.user.status = realStatus;
        }
    }

    res.json(populatedServer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SUNUCU SİLME (Cascade Delete) ---
app.delete('/api/servers/:serverId', authMiddleware, async (req, res) => {
    try {
        const { serverId } = req.params;
        const userId = req.user.id || req.user.userId || req.user._id; // Auth middleware'den gelen ID

        // 1. Sunucuyu bul (Server değil, ServerModel kullanıyoruz)
        const server = await ServerModel.findById(serverId); // 👈 DÜZELTİLDİ
        if (!server) return res.status(404).json({ message: "Sunucu bulunamadı." });

        // 2. Sadece SAHİBİ silebilir
        if (server.owner.toString() !== userId) {
            return res.status(403).json({ message: "Bu sunucuyu silme yetkiniz yok." });
        }

        // 3. Backblaze B2'den İkonu Sil (Varsa)
        if (server.icon && !server.icon.includes('/avatars/')) {
            try {
                // deleteFromB2 fonksiyonunun server.js'de tanımlı olduğunu varsayıyoruz
                if (typeof deleteFromB2 === 'function') {
                     await deleteFromB2(server.icon);
                }
            } catch (err) {
                console.error("Sunucu ikonu silinirken hata (önemsiz):", err);
            }
        }

        // 4. Zincirleme Silme: Kanallar ve Mesajlar
        const channels = await Channel.find({ serverId: serverId }); // Channel modeli doğru
        const channelIds = channels.map(c => c._id);

        // Mesajları sil
        await Message.deleteMany({ channelId: { $in: channelIds } }); // Message modeli doğru
        
        // Kanalları sil
        await Channel.deleteMany({ serverId: serverId });

        // 5. Son olarak sunucuyu sil
        await ServerModel.findByIdAndDelete(serverId); // 👈 DÜZELTİLDİ

        // Socket ile herkese haber ver
        io.emit('server_deleted', { serverId });

        res.json({ message: "Sunucu ve bağlı tüm veriler başarıyla silindi." });

    } catch (err) {
        console.error("Sunucu silme hatası:", err);
        res.status(500).json({ message: "Sunucu silinirken bir hata oluştu." });
    }
});

// --- SUNUCU YÖNETİMİ API'LERİ ---

// A) SUNUCU BİLGİLERİNİ GÜNCELLE (İsim, İkon)
app.put('/api/servers/:serverId', async (req, res) => {
  const { serverId } = req.params;
  const { name, icon, userId } = req.body; // userId: İşlemi yapan kişi
  try {
    const server = await ServerModel.findById(serverId);
    if (server.owner.toString() !== userId) return res.status(403).json({ message: "Yetkisiz işlem!" });

    if (name) server.name = name;
    if (icon) server.icon = icon;
    
    await server.save();
    // Socket ile herkese haber ver (İsim değişti diye)
    io.emit('server_updated', server);
    res.json(server);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// G) SUNUCU İKONU YÜKLEME 🏰
app.post('/api/servers/:serverId/icon', upload.single('icon'), async (req, res) => {
    try {
        const { serverId } = req.params;
        
        if (!req.file) return res.status(400).json({ message: "Resim seçilmedi." });

        // 1. Önce Sunucuyu Bul (İsmini almak için önce buna ihtiyacımız var)
        const server = await ServerModel.findById(serverId);
        if (!server) return res.status(404).json({ message: "Sunucu bulunamadı" });

        // 2. Sunucu Adını "Güvenli Klasör İsmi"ne Çevir (Sanitization)
        // Örn: "Oyun & Sohbet!" -> "oyun-sohbet"
        const safeServerName = server.name
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')           
            .replace(/&/g, '-ve-')           
            .replace(/ı/g, 'i')           
            .replace(/ğ/g, 'g')           
            .replace(/ü/g, 'u')           
            .replace(/ş/g, 's')           
            .replace(/ö/g, 'o')           
            .replace(/ç/g, 'c')
            .replace(/[^\w\-]+/g, '')       // Alfanümerik olmayanları sil (emoji vb.)
            .replace(/\-\-+/g, '-');        // Çift tireleri tek yap

        // Klasör Yolu: servers/sunucu-adi
        // Eğer sunucu adı çok bozuksa ve boş string kaldıysa ID'yi kullan (Yedek plan)
        const folderName = safeServerName || serverId; 
        const folderPath = `servers/${folderName}`;

        // 3. Yeni İkonu Yükle
        const cloudUrl = await uploadToB2(req.file, folderPath);

        // 4. Eski İkon Varsa Sil
        if (server.icon) {
            await deleteFromB2(server.icon);
        }

        // 5. Veritabanını Güncelle
        server.icon = cloudUrl;
        await server.save();

        // 6. Soket ile Bildir
        const updatedServer = await ServerModel.findById(serverId)
            .populate({ path: 'members.user', select: 'username nickname avatar status friendCode' })
            .lean();
        
        io.emit('server_updated', updatedServer);

        res.json({ message: "Sunucu ikonu güncellendi!", icon: cloudUrl });

    } catch (err) {
        console.error("İkon yükleme hatası:", err);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

// B) YENİ ROL OLUŞTUR (Redis Status Fix)
app.post('/api/servers/:serverId/roles', async (req, res) => {
  const { serverId } = req.params;
  const { name, color, userId } = req.body;
  try {
    const server = await ServerModel.findById(serverId);
    if (server.owner.toString() !== userId) return res.status(403).json({ message: "Yetkisiz işlem!" });

    server.roles.push({ name, color, permissions: [] });
    await server.save();
    
    // 1. Veriyi Çek (lean() kullanarak saf JSON alıyoruz)
    const populatedServer = await ServerModel.findById(serverId)
        .populate({ path: 'members.user', select: 'username nickname avatar status friendCode' })
        .populate('channels')
        .lean(); // <--- ÖNEMLİ: Düzenlenebilir olması için

    // 2. REDIS ENTEGRASYONU: Her üyenin gerçek durumunu Redis'ten alıp üzerine yaz
    if (populatedServer.members) {
        for (let member of populatedServer.members) {
            const realStatus = await getUserStatus(member.user._id.toString());
            member.user.status = realStatus; // Mongo verisini ez
        }
    }

    // 3. Güncel ve Doğru Veriyi Gönder
    io.emit('server_updated', populatedServer);

    res.json(populatedServer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// C) ÜYE AT (KICK) - GÜNCELLENMİŞ
app.delete('/api/servers/:serverId/members/:memberId', async (req, res) => {
  const { serverId, memberId } = req.params; 
  const { userId } = req.body; // Atan Patron ID
  
  try {
    const server = await ServerModel.findById(serverId);
    if (server.owner.toString() !== userId) return res.status(403).json({ message: "Yetkisiz işlem!" });
    if (server.owner.toString() === memberId) return res.status(400).json({ message: "Sunucu sahibi atılamaz!" });

    // Atan kişinin ismini bul (Bildirim için)
    const kicker = await User.findById(userId);
    const kickerName = kicker ? (kicker.nickname || kicker.username) : "Yönetici";

    // 1. Üyeyi sunucudan sil
    server.members = server.members.filter(m => m.user.toString() !== memberId);
    await server.save();

    // 2. Atılan kullanıcıya "Kalıcı Bildirim" ekle (Offline ise girişte görsün diye)
    await User.findByIdAndUpdate(memberId, {
        $push: { 
            notifications: { 
                type: 'kick', 
                serverName: server.name, 
                kickerName: kickerName 
            } 
        }
    });

    // 3. Canlı Sinyal Gönder (Eğer online ise anında görsün)
    io.to(memberId).emit('member_kicked', { 
        serverId, 
        serverName: server.name, 
        kickerName 
    });

    // 4. Sunucudaki diğer herkese de "Listeyi güncelle" sinyali atalım (Opsiyonel ama iyi olur)
    // Şimdilik sadece atılan kişiye odaklanıyoruz.

    res.json({ message: "Üye atıldı.", server });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// EKSTRA ROTA: Bildirimleri Temizle (Gördükten sonra silmek için)
app.delete('/api/users/:userId/notifications', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.userId, { $set: { notifications: [] } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// D) ÜYEYE ROL EKLE/ÇIKAR (Redis Status Fix)
app.put('/api/servers/:serverId/members/:memberId/roles', async (req, res) => {
  const { serverId, memberId } = req.params;
  const { roleId, userId } = req.body; 
  try {
    const server = await ServerModel.findById(serverId);
    if (server.owner.toString() !== userId) return res.status(403).json({ message: "Yetkisiz işlem!" });

    const memberIndex = server.members.findIndex(m => m.user.toString() === memberId);
    if (memberIndex === -1) return res.status(404).json({ message: "Üye bulunamadı" });

    const member = server.members[memberIndex];
    
    const roleIndex = member.roles.indexOf(roleId);
    if (roleIndex > -1) {
        member.roles.splice(roleIndex, 1); 
    } else {
        member.roles.push(roleId); 
    }

    server.markModified('members');
    await server.save();

    // 1. Veriyi Çek
    const populatedServer = await ServerModel.findById(serverId)
        .populate({ path: 'members.user', select: 'username nickname avatar status friendCode' })
        .populate('channels')
        .lean();

    // 2. REDIS ENTEGRASYONU
    if (populatedServer.members) {
        for (let m of populatedServer.members) {
            const realStatus = await getUserStatus(m.user._id.toString());
            m.user.status = realStatus;
        }
    }

    // 3. Gönder
    io.emit('server_updated', populatedServer);

    res.json(populatedServer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// E) ROL SİL (Redis Status Fix)
app.delete('/api/servers/:serverId/roles/:roleId', async (req, res) => {
  const { serverId, roleId } = req.params;
  const { userId } = req.body; 

  try {
    const server = await ServerModel.findById(serverId);
    if (!server) return res.status(404).json({ message: "Sunucu bulunamadı" });
    if (server.owner.toString() !== userId) return res.status(403).json({ message: "Yetkisiz işlem!" });

    server.roles = server.roles.filter(r => r._id.toString() !== roleId);
    server.members.forEach(member => {
        member.roles = member.roles.filter(r => r.toString() !== roleId);
    });

    await server.save();

    // 1. Veriyi Çek
    const populatedServer = await ServerModel.findById(serverId)
        .populate({ path: 'members.user', select: 'username nickname avatar status friendCode' })
        .populate('channels')
        .lean();

    // 2. REDIS ENTEGRASYONU
    if (populatedServer.members) {
        for (let member of populatedServer.members) {
            const realStatus = await getUserStatus(member.user._id.toString());
            member.user.status = realStatus;
        }
    }

    // 3. Gönder
    io.emit('server_updated', populatedServer);

    res.json(populatedServer); 
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- AVATAR YÜKLEME ROTASI (SİLME ÖZELLİKLİ) ---
app.post('/api/users/:userId/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!req.file) return res.status(400).json({ message: "Resim seçilmedi." });

    // 1. Önce kullanıcıyı bul (Eski avatarını öğrenmek için)
    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    // 2. Yeni dosyayı yükle
    const cloudUrl = await uploadToB2(req.file, 'users');

    // 3. Eğer kullanıcının eski bir avatarı varsa ve bu bir Backblaze url'iyse SİL
    if (currentUser.avatar && !currentUser.avatar.includes('/avatars/')) {
        try {
            await deleteFromB2(currentUser.avatar);
        } catch (deleteErr) {
            console.error("Eski avatar silinemedi (önemli değil, devam et):", deleteErr);
            // Silme hatası olsa bile işlemi durdurma, yeni resmi kaydetmeye devam et
        }
    }

    // 4. Veritabanını güncelle
    currentUser.avatar = cloudUrl;
    await currentUser.save();

    const userResponse = currentUser.toObject();
    delete userResponse.password;
    userResponse.id = userResponse._id; 
    
    io.emit('user_updated', userResponse);

    res.json({ message: "Avatar güncellendi!", avatar: cloudUrl, user: userResponse });

  } catch (err) {
    console.error("Avatar yükleme hatası:", err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// GÜNCELLENMİŞ OPTİMİZE MESAJ ÇEKME ROTASI
app.get('/api/messages/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { before } = req.query; 
    const limit = 50; // Tek seferde 50 mesaj idealdir

    let query = { channelId };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 }) // En yeniden eskiye
      .limit(limit)
      // 1. OPTİMİZASYON: Sadece bu alanları getir (Şifre vs. gelmesin, yük azalır)
      .populate('sender', 'username nickname avatar status color') 
      // 2. OPTİMİZASYON: Mongoose objesi değil, saf JSON döndür (Çok daha hızlı)
      .lean(); 

    // Frontend için ters çevir
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MESAJ EKİ YÜKLEME ROTASI ---
app.post('/api/chat/upload', upload.single('attachment'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Dosya yok" });

    // 1. Dosya Türünü Belirle
    const mime = req.file.mimetype;
    let type = 'file';
    if (mime.startsWith('image/')) type = 'image';
    else if (mime.startsWith('video/')) type = 'video';

    // 2. Backblaze'e Yükle (attachments klasörüne)
    const cloudUrl = await uploadToB2(req.file, 'attachments');

    res.json({ url: cloudUrl, type: type });
  } catch (err) {
    console.error("Upload hatası:", err);
    res.status(500).json({ message: "Yükleme başarısız" });
  }
});

app.post('/api/friends/request', async (req, res) => {
  const { senderId, targetCode } = req.body;
  try {
    const targetUser = await User.findOne({ friendCode: targetCode });
    const senderUser = await User.findById(senderId);
    if (!targetUser) return res.status(404).json({ message: "Kullanıcı bulunamadı!" });
    if (targetUser._id.toString() === senderId) return res.status(400).json({ message: "Kendine istek atamazsın!" });
    if (targetUser.incomingRequests.includes(senderId)) return res.status(400).json({ message: "Zaten istek gönderilmiş!" });
    if (targetUser.friends.includes(senderId)) return res.status(400).json({ message: "Zaten arkadaşsınız!" });

    targetUser.incomingRequests.push(senderId);
    senderUser.outgoingRequests.push(targetUser._id);
    await targetUser.save();
    await senderUser.save();
    
    io.to(targetUser._id.toString()).emit('new_friend_request', {
        _id: senderUser._id,
        nickname: senderUser.nickname,
        avatar: senderUser.avatar,
        friendCode: senderUser.friendCode
    });
    res.json({ message: `Başarılı! ${targetUser.nickname} kullanıcısına istek gönderildi.`, nickname: targetUser.nickname});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/friends/accept', async (req, res) => {
  const { userId, requesterId } = req.body;
  try {
    const user = await User.findById(userId);
    const requester = await User.findById(requesterId);
    user.incomingRequests = user.incomingRequests.filter(id => id.toString() !== requesterId);
    requester.outgoingRequests = requester.outgoingRequests.filter(id => id.toString() !== userId);
    user.friends.push(requesterId);
    requester.friends.push(userId);
    await user.save();
    await requester.save();
    
    const userStatus = await getUserStatus(userId);
    const requesterStatus = await getUserStatus(requesterId);
    const userObj = user.toObject(); userObj.status = userStatus;
    const reqObj = requester.toObject(); reqObj.status = requesterStatus;

    io.to(userId).emit('friend_request_accepted', reqObj);
    io.to(requesterId).emit('friend_request_accepted', userObj);
    res.json({ message: "Artık arkadaşsınız!", friend: requester });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// M) MÜZİK STREAM ROTASI (AAC - CRYSTAL CLEAR) 💎
app.get('/api/stream/play', (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) return res.status(400).send('URL yok');

    // Tarayıcıya AAC (ADTS) göndereceğimizi söylüyoruz
    res.setHeader('Content-Type', 'audio/aac');
    
    // Önbellek sorunlarını önle
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        // 1. YT-DLP: En iyi sesi çek
        const ytDlp = spawn('yt-dlp', [
            '-f', 'bestaudio',      
            '--no-playlist',
            '-o', '-',
            '--quiet',
            videoUrl
        ]);

        // 2. FFmpeg: AAC Formatına Çevir (Tarayıcı Dostu)
        const ffmpeg = spawn('ffmpeg', [
            '-i', 'pipe:0',
            
            // Codec Ayarları
            '-c:a', 'aac',          // AAC Codec kullan (En temiz tiz sesler bunda olur)
            '-b:a', '192k',         // 192kbps (Stream için ideal yüksek kalite)
            '-ar', '44100',         // 44.1kHz (Standart CD Kalitesi - Boğukluğu alır)
            '-ac', '2',             // Stereo
            
            // Format Ayarı
            '-f', 'adts',           // ADTS, AAC'nin stream edilebilir kapsayıcısıdır
            
            // Performans
            '-movflags', 'frag_keyframe+empty_moov', // Stream optimizasyonu
            '-'
        ]);

        // --- PIPELINE ---
        ytDlp.stdout.pipe(ffmpeg.stdin);
        ffmpeg.stdout.pipe(res);

        // --- TEMİZLİK ---
        req.on('close', () => {
            ytDlp.kill('SIGKILL');
            ffmpeg.kill('SIGKILL');
        });
        
        // Hata bastırma (Log kirliliğini önlemek için)
        ytDlp.stderr.on('data', () => {});
        ffmpeg.stderr.on('data', () => {});

    } catch (error) {
        console.error("Stream Hatası:", error);
        if (!res.headersSent) res.status(500).send("Hata");
    }
});

// ==========================================
// 🔔 GÜÇLENDİRİLMİŞ WEBHOOK ROTASI
// ==========================================
app.post('/api/livekit/webhook', async (req, res) => {
    try {
        console.log("📨 Webhook İsteği Geldi!"); // Log 1

        // WebhookReceiver'ı başlat (Key ve Secret'ın LiveKit sunucusuyla aynı olduğundan emin ol)
        const webhookReceiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

        // 👇 DEBUG: Bakalım rawBody yakalanmış mı?
        if (!req.rawBody) {
            console.error("❌ HATA: req.rawBody BOŞ! Middleware çalışmıyor.");
            // RawBody yoksa işlem yapma, hatayı baştan gör
            return res.status(500).send("Middleware Error");
        } else {
            console.log("✅ Başarılı: req.rawBody yakalandı.");
        }

        const bodyToUse = req.rawBody || req.body;
        // Gelen veriyi doğrula ve oku
        const event = await webhookReceiver.receive(bodyToUse, req.get('Authorization'));

        console.log("🔔 LiveKit Olayı Tipi:", event.event); // Log 2
        console.log("🏠 Oda:", event.room?.name);

        // İlgilendiğimiz olaylar: Katılma ve Ayrılma
        if (event.event === 'participant_joined' || event.event === 'participant_left') {
            const roomName = event.room.name;
            const participant = event.participant;
            
            // Metadata içindeki avatarı çözümle
            let avatar = "";
            try {
                if (participant.metadata) {
                    const meta = JSON.parse(participant.metadata);
                    avatar = meta.avatar || avatar;
                }
            } catch(e) {}

            const userObj = {
                _id: participant.identity,
                username: participant.name,
                nickname: participant.name,
                avatar: avatar
            };

            // Hafızayı başlat
            if (!globalVoiceState[roomName]) globalVoiceState[roomName] = [];

            // Listeyi temizle (Önce eskiyi sil)
            globalVoiceState[roomName] = globalVoiceState[roomName].filter(p => p._id !== userObj._id);

            // Eğer katıldıysa listeye ekle
            if (event.event === 'participant_joined') {
                globalVoiceState[roomName].push(userObj);
                console.log(`➕ ${userObj.username} odaya eklendi.`);
            } else {
                console.log(`➖ ${userObj.username} odadan çıktı.`);
            }

            // 🔥 SOCKET İLE GÖNDER
            console.log("📡 Socket yayını yapılıyor: voice_state_update");
            io.emit('voice_state_update', globalVoiceState);
        }

        res.status(200).send('ok');
    } catch (error) {
        console.error("❌ Webhook Hatası:", error); // Log 3 (Hata varsa burada görürüz)
        res.status(500).send('error');
    }
});

// 💡 İPUCU: Kullanıcı siteye ilk girdiğinde (F5 attığında) mevcut durumu görmek ister.
// Socket bağlantısı kurulduğunda ona mevcut listeyi gönderelim.
io.on('connection', (socket) => {
    console.log('Bir kullanıcı bağlandı:', socket.id);
    socket.emit('voice_state_update', globalVoiceState); // Hoşgeldin paketi

    // ... diğer socket dinleyicilerin ...
});

// --- SOCKET.IO GÜNCELLEMESİ ---
const userSocketMap = new Map();
const userDisconnectTimers = new Map();

io.on('connection', async (socket) => {
  console.log(`🔌 Yeni Bağlantı: ${socket.id}`);

  socket.emit('voice_state_update', globalVoiceState);

  // 1. KULLANICI GİRİŞİ (Status Takibi İçin)
  socket.on('register_socket', async (userId) => {
    if (userId) {
      socket.join(userId);
      socket.userId = userId;

      if (userDisconnectTimers.has(userId)) {
          clearTimeout(userDisconnectTimers.get(userId));
          userDisconnectTimers.delete(userId);
      }

      let userSockets = userSocketMap.get(userId);
      if (!userSockets) {
        userSockets = new Set();
        userSocketMap.set(userId, userSockets);
      }
      userSockets.add(socket.id);

      const currentRedisStatus = await getUserStatus(userId);
      if (userSockets.size === 1 || currentRedisStatus === 'offline') {
          await setUserStatus(userId, 'online');
          const user = await User.findById(userId).lean();
          if (user) {
             delete user.password;
             user.status = 'online';
             io.emit('user_updated', user);
          }
      }
    }
  });

  // 2. CHAT MESAJLARI
  socket.on('chat_message', async (data) => {
      try {
        const user = await User.findOne({ username: data.username });
        if (user) {

          if (data.content.startsWith('!play ')) {
          const url = data.content.split(' ')[1];

          // Kullanıcının ses kanalında olup olmadığını kontrol et
          if (data.voiceChannelId) {
              console.log(`🎵 Müzik İsteği: ${url} -> Kanal: ${data.voiceChannelId}`);
              
              // Kullanıcıya "Başlatılıyor" mesajı gönder
              io.to(data.channelId).emit('chat_message', {
                  _id: Date.now(),
                  content: `🤖 Müzik Botu hazırlanıyor...`,
                  sender: { username: "DJ Bot", type: "bot", avatar: "https://cdn-icons-png.flaticon.com/512/461/461238.png" },
                  timestamp: new Date()
              });

              const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

              const pythonProcess = spawn('python3', ['music_bot.py', data.voiceChannelId, url]);

              pythonProcess.stdout.on('data', (output) => {
                  console.log(`[MusicBot]: ${output}`);
              });

              pythonProcess.stderr.on('data', (error) => {
                  console.error(`[MusicBot Error]: ${error}`);
              });
              
              pythonProcess.on('close', (code) => {
                  console.log(`MusicBot kapandı. Kod: ${code}`);
              });

              // Bu mesajı veritabanına kaydetmemek için return diyoruz
              return; 
          } else {
              // Ses kanalında değilse uyar
              io.to(data.channelId).emit('chat_message', {
                  _id: Date.now(),
                  content: `❌ Önce bir ses kanalına girmelisin!`,
                  sender: { username: "Sistem", type: "bot" },
                  timestamp: new Date()
              });
              return;
          }
      }
          const newMessage = new Message({
            content: data.content,
            sender: user._id,
            channelId: data.channelId || null ,
            attachmentUrl: data.attachmentUrl || null,
            attachmentType: data.attachmentType || null
          });
          await newMessage.save();
          const populatedMsg = await newMessage.populate('sender', 'username nickname avatar color');
          io.emit('chat_message', populatedMsg);
          
          // NOT: Müzik botu komutlarını (!play) şimdilik kaldırdık veya pasif bıraktık.
          // Çünkü LiveKit ile müzik botu yapmak için "SIP/Ingress" servisi gerekir.
          // Eski HTTP stream yöntemi LiveKit odasının içine ses vermez.
        }
      } catch (err) { console.error(err); }
  });

  // 3. DM ve GENEL ODALAR
  socket.on("join_dm_room", (roomId) => {
      socket.join(roomId);
  });

  // ----------------------------------------------------------------------
  // 🗑️ SİLİNEN KISIMLAR:
  // join_voice_room, leave_voice_room, sending_signal, returning_signal
  // speaking_status, music_ended, voiceSessions...
  //
  // ARTIK GEREK YOK! LiveKit bunların hepsini kendi sunucusunda yönetiyor.
  // Frontend, LiveKit SDK kullanarak odaya bağlanacak.
  // ----------------------------------------------------------------------

  // --- BAĞLANTI KOPTUĞUNDA ---
  socket.on('disconnect', async () => {
    // Sadece Online/Offline takibi yapıyoruz. Ses odası temizliğine gerek kalmadı.
    if (socket.userId) {
        const userId = socket.userId;
        const userSockets = userSocketMap.get(userId);

        if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
                if (userDisconnectTimers.has(userId)) clearTimeout(userDisconnectTimers.get(userId));
                const timer = setTimeout(async () => {
                    const currentSockets = userSocketMap.get(userId);
                    if (!currentSockets || currentSockets.size === 0) {
                        userSocketMap.delete(userId);
                        userDisconnectTimers.delete(userId);
                        await setUserStatus(userId, 'offline');
                        const user = await User.findById(userId).lean();
                        if (user) {
                            delete user.password;
                            user.status = 'offline';
                            io.emit('user_updated', user);
                        }
                    }
                }, 2000); 
                userDisconnectTimers.set(userId, timer);
            }
        }
    }
  });
});

const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`🚀 Sunucu ${PORT} portunda çalışıyor`);
});