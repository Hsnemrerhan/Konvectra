import { useState } from 'react';

const AuthForm = ({ onLogin, onRegister }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isRegister) {
      onRegister(username, password);
    } else {
      onLogin(username, password);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-200">
      <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-lg w-96 flex flex-col gap-4 shadow-lg">
        <h2 className="text-2xl font-bold text-center text-white">
          {isRegister ? 'Hesap Oluştur' : 'Giriş Yap'}
        </h2>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400 uppercase">Kullanıcı Adı</label>
          <input 
            className="bg-gray-900 p-2.5 rounded text-white outline-none focus:ring-2 focus:ring-blue-500 transition" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            required 
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400 uppercase">Şifre</label>
          <input 
            className="bg-gray-900 p-2.5 rounded text-white outline-none focus:ring-2 focus:ring-blue-500 transition" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
        </div>

        <button className="bg-[#5865F2] hover:bg-[#4752c4] p-2.5 rounded font-bold text-white transition mt-2">
          {isRegister ? 'Kayıt Ol' : 'Giriş Yap'}
        </button>

        <p className="text-sm text-center mt-2">
          {isRegister ? 'Zaten hesabın var mı?' : 'Hesabın yok mu?'}
          <span 
            className="text-[#00aff4] cursor-pointer ml-1 hover:underline" 
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? 'Giriş yap' : 'Hesap oluştur'}
          </span>
        </p>
      </form>
    </div>
  );
};

export default AuthForm;