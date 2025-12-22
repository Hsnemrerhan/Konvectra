import React, { useState, useEffect } from 'react';

const AnimatedAvatar = ({ src, alt, className }) => {
  const [displaySrc, setDisplaySrc] = useState(src);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Eğer prop olarak gelen 'src' değiştiyse animasyonu başlat
    if (src !== displaySrc) {
      triggerTransition(src);
    }
  }, [src, displaySrc]);

  const triggerTransition = (newSrc) => {
    // 1. ADIM: GİZLE (Fade Out)
    // Resmi saydamlaştır, biraz küçült ve bulanıklaştır
    setIsVisible(false);

    // CSS transition süresi kadar bekle (300ms)
    setTimeout(() => {
      
      // 2. ADIM: KAYNAĞI DEĞİŞTİR (Swap)
      setDisplaySrc(newSrc);
      
      // Browser'ın yeni resmi render etmesi için milisaniyelik bir boşluk bırak
      // ve hemen ardından...
      requestAnimationFrame(() => {
          // 3. ADIM: GÖSTER (Fade In)
          setIsVisible(true);
      });

    }, 300); // Bu süre CSS'deki duration-300 ile aynı olmalı
  };

  return (
    <div className={`relative bg-black overflow-hidden ${className}`}> {/* className ile gelen w-10 h-10 vs buraya uygulanır */}
      <img 
        src={displaySrc} 
        alt={alt} 
        className={`w-full h-full object-cover transition-all duration-300 ease-in-out
          ${isVisible 
            ? 'opacity-100 scale-100 blur-0'   // Görünür Hal (Normal)
            : 'opacity-0 scale-90 blur-sm'     // Gizli Hal (Efektli)
          }
        `}
      />
      
      {/* İsteğe Bağlı: Parlama Efekti (Flash) 
          Resim değişirken anlık beyaz bir parlama geçsin istersen bunu açabilirsin.
          Şu an kapalı, sade geçiş daha şık duruyor.
      */}
      {/* <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-300 ${isVisible ? 'opacity-0' : 'opacity-30'}`}></div> 
      */}
    </div>
  );
};

export default AnimatedAvatar;