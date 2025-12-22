import React, { useState, useEffect } from 'react';

const AnimatedNickname = ({ text, className, style }) => {
  const [displayText, setDisplayText] = useState(text);
  const [animState, setAnimState] = useState('idle'); // 'idle', 'exiting', 'entering'

  useEffect(() => {
    // Yeni bir isim geldiyse animasyonu başlat
    if (text !== displayText) {
      triggerTransition(text);
    }
  }, [text, displayText]);

  const triggerTransition = (newText) => {
    // 1. ÇIKIŞ: Yukarı doğru kayarak silin (Blur + Opacity 0 + TranslateY -5px)
    setAnimState('exiting');

    setTimeout(() => {
      // 2. DEĞİŞİM: Metni güncelle
      setDisplayText(newText);
      
      // Hemen giriş animasyonuna hazırla (Aşağıdan gelmesi için)
      setAnimState('entering'); // Başlangıç pozisyonu (altta, görünmez)

      requestAnimationFrame(() => {
          requestAnimationFrame(() => {
              // 3. GİRİŞ: Yerine otur (Blur 0 + Opacity 1 + TranslateY 0)
              setAnimState('idle');
          });
      });

    }, 200); // 200ms çıkış süresi
  };

  // Animasyon sınıflarını duruma göre ayarla
  const getTransitionClass = () => {
      switch (animState) {
          case 'exiting':
              return 'opacity-0 blur-sm -translate-y-1 scale-95'; // Yukarı kayıp silinme
          case 'entering':
              return 'opacity-0 blur-sm translate-y-1 scale-95';  // Aşağıda bekleme
          case 'idle':
              return 'opacity-100 blur-0 translate-y-0 scale-100'; // Normal duruş
          default:
              return '';
      }
  };

  return (
    <span 
        className={`inline-block transition-all duration-300 ease-out transform ${getTransitionClass()} ${className}`}
        style={style} // Renk (me/other) stili buradan gelecek
    >
      {displayText}
    </span>
  );
};

export default AnimatedNickname;