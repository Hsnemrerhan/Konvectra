import React, { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import { getCroppedImg } from '../../utils/canvasUtils';

// Resmi ortalayarak ve kare (1:1) olacak şekilde otomatik seçen yardımcı fonksiyon
function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 }, // Genişliğin %90'ını kaplasın
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

const ImageCropper = ({ imageSrc, onCropComplete, onCancel }) => {
  const [crop, setCrop] = useState(); // Anlık seçim alanı
  const [completedCrop, setCompletedCrop] = useState(); // Biten seçim alanı
  const imgRef = useRef(null);

  // Resim yüklendiğinde otomatik ortala
  function onImageLoad(e) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1)); // 1 = Kare (Aspect Ratio)
  }

  // "Kırp" butonuna basınca çalışır
  async function handleCropConfirm() {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
        // Canvas utils ile dosyayı oluştur
        const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
        onCropComplete(croppedBlob); // Blob'u üst bileşene gönder
    }
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Kırpma Alanı */}
      <div className="max-h-[400px] overflow-auto mb-6 border border-gray-700 rounded bg-black/50">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1} // Kareye zorla
            circularCrop={true} // Daire şeklinde göster (Discord tarzı)
            className="max-w-full"
          >
            <img 
                ref={imgRef} 
                src={imageSrc} 
                alt="Crop me" 
                onLoad={onImageLoad} 
                className="max-w-full block" // block önemli
            />
          </ReactCrop>
      </div>

      {/* Butonlar */}
      <div className="flex gap-3 justify-end w-full">
          <button onClick={onCancel} className="text-white hover:underline text-sm px-4 py-2">
              İptal
          </button>
          <button 
              onClick={handleCropConfirm}
              className="px-6 py-2 rounded bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium transition"
          >
              Uygula
          </button>
      </div>
    </div>
  );
};

export default ImageCropper;