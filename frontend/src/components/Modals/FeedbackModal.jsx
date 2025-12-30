import React, { useEffect } from 'react';
import { FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';

const FeedbackModal = ({ isOpen, onClose, type = 'success', title, message }) => {
    
    // Modal açıkken ESC tuşuna basılırsa kapansın
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    // Duruma göre ikon ve renk ayarları
    const getConfig = () => {
        switch (type) {
            case 'success':
                return {
                    icon: <FaCheckCircle size={50} className="text-green-500 mb-4" />,
                    buttonColor: 'bg-green-600 hover:bg-green-700',
                    borderColor: 'border-green-500'
                };
            case 'error':
                return {
                    icon: <FaTimesCircle size={50} className="text-red-500 mb-4" />,
                    buttonColor: 'bg-red-500 hover:bg-red-600',
                    borderColor: 'border-red-500'
                };
            case 'warning':
                return {
                    icon: <FaExclamationTriangle size={50} className="text-yellow-500 mb-4" />,
                    buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
                    borderColor: 'border-yellow-500'
                };
            default:
                return {
                    icon: <FaCheckCircle size={50} className="text-blue-500 mb-4" />,
                    buttonColor: 'bg-blue-600 hover:bg-blue-700',
                    borderColor: 'border-blue-500'
                };
        }
    };

    const config = getConfig();

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            {/* Modal Kutusu */}
            <div 
                className={`bg-[#121214] w-full max-w-sm rounded-lg shadow-2xl p-6 flex flex-col items-center text-center transform transition-all scale-100 animate-scale-in border-b-4 ${config.borderColor}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* İkon */}
                <div className="animate-bounce-short">
                    {config.icon}
                </div>

                {/* Başlık */}
                <h2 className="text-xl font-bold text-gray-100 mb-2">
                    {title}
                </h2>

                {/* Mesaj */}
                <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                    {message}
                </p>

                {/* Buton */}
                <button
                    onClick={onClose}
                    className={`w-full py-2.5 rounded text-white font-medium transition-colors duration-200 ${config.buttonColor}`}
                >
                    Tamam
                </button>
            </div>
        </div>
    );
};

export default FeedbackModal;