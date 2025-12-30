import { useState } from 'react';
import { FaDiscord } from 'react-icons/fa';

const AuthForm = ({ onLogin, onRegister, isLoading }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });

  // Input değişimlerini tek yerden yönet
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isRegister) {
      onRegister(formData.username, formData.password);
    } else {
      onLogin(formData.username, formData.password);
    }
  };

  return (
    // Arka Plan (Discord Deseni)
    <div className="flex items-center justify-center min-h-screen bg-[#121214] relative overflow-hidden">

      {/* Ana Kart */}
      <div className="bg-[#1A1A1E] p-8 rounded-lg w-full max-w-[480px] shadow-2xl flex flex-col gap-6 relative z-10 animate-fade-in-up">
        
        {/* Başlık Kısmı */}
        <div className="text-center mb-2">
            <h2 className="text-2xl font-bold text-white mb-1">
                {isRegister ? 'Bir Hesap Oluştur' : 'Tekrar Hoş Geldin!'}
            </h2>
            <p className="text-[#B5BAC1] text-sm">
                {isRegister 
                    ? 'Sunucularımıza katılmak için hemen kayıt ol.' 
                    : 'Seni tekrar gördüğümüze çok sevindik!'}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Kullanıcı Adı */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#B5BAC1] uppercase tracking-wide">
                Kullanıcı Adı <span className="text-red-500">*</span>
            </label>
            <input 
              name="username"
              className="bg-[#121214] p-2.5 rounded text-white outline-none focus:ring-2 focus:ring-[#00A8FC] transition-all font-medium h-10" 
              value={formData.username} 
              onChange={handleChange} 
              required 
            />
          </div>

          {/* Şifre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#B5BAC1] uppercase tracking-wide">
                Şifre <span className="text-red-500">*</span>
            </label>
            <input 
              name="password"
              className="bg-[#121214] p-2.5 rounded text-white outline-none focus:ring-2 focus:ring-[#00A8FC] transition-all font-medium h-10" 
              type="password" 
              value={formData.password} 
              onChange={handleChange} 
              required 
            />
            {!isRegister && (
                <div className="text-xs text-[#00A8FC] hover:underline cursor-pointer mt-1">
                    Şifreni mi unuttun?
                </div>
            )}
          </div>

          {/* Buton */}
          <button 
            disabled={isLoading}
            className={`bg-[#5865F2] hover:bg-[#4752c4] text-white p-2.5 rounded font-bold transition-all mt-4 h-11 flex items-center justify-center
            ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
                isRegister ? 'Devam Et' : 'Giriş Yap'
            )}
          </button>

          {/* Geçiş Linki */}
          <div className="text-sm text-[#949BA4] mt-1">
            {isRegister ? 'Zaten bir hesabın var mı?' : 'Bir hesaba mı ihtiyacın var?'}
            <span 
              className="text-[#00A8FC] cursor-pointer ml-1 hover:underline font-medium" 
              onClick={() => {
                  setIsRegister(!isRegister);
                  setFormData({ username: '', password: '' }); // Formu temizle
              }}
            >
              {isRegister ? 'Giriş yap' : 'Kaydol'}
            </span>
          </div>

        </form>
      </div>
    </div>
  );
};

export default AuthForm;