const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // 1. Token'ı başlık bilgisinden (Header) al
    // Genelde "Authorization: Bearer <TOKEN>" şeklinde gelir
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer " kısmını at, sadece token'ı al

    // 2. Eğer token yoksa içeri alma
    if (!token) {
        return res.status(401).json({ message: 'Yetki yok, token bulunamadı.' });
    }

    // 3. Token'ı doğrula
    try {
        // .env dosyasındaki gizli anahtarı kullanarak şifreyi çöz
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Şifre çözüldü, içindeki kullanıcı bilgisini isteğe ekle
        req.user = decoded; 
        
        // Yola devam et (Asıl fonksiyona geç)
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token geçersiz.' });
    }
};