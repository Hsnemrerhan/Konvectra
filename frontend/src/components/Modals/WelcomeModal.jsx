import { FaSmileWink } from 'react-icons/fa';

const WelcomeModal = ({ serverName, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] animate-fade-in">
      <div className="bg-[#121214] w-[440px] rounded-lg shadow-2xl p-8 flex flex-col items-center text-center relative overflow-hidden">
        
        {/* Dekoratif Arka Plan Efekti */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

        {/* İkon */}
        <div className="w-20 h-20 bg-[#5865F2] rounded-full flex items-center justify-center mb-6 shadow-lg transform hover:scale-110 transition-transform duration-300">
            <FaSmileWink size={40} className="text-white" />
        </div>

        {/* Başlık */}
        <h2 className="text-2xl font-extrabold text-white mb-2">Aramıza Hoş Geldin!</h2>

        {/* Açıklama */}
        <p className="text-gray-300 mb-8 leading-relaxed text-lg">
           <span className="font-bold text-[#5865F2]">{serverName}</span> sunucusuna katılımın başarıyla gerçekleşti. Sohbet seni bekliyor!
        </p>

        {/* Buton */}
        <button 
          onClick={onClose}
          className="bg-[#23a559] hover:bg-[#1a8545] text-white px-10 py-3 rounded text-base font-bold transition shadow-md w-full"
        >
          Sohbete Başla
        </button>

      </div>
    </div>
  );
};

export default WelcomeModal;