import React from 'react';
import { FaPhoneSlash, FaSignal } from 'react-icons/fa';
import { MdSignalCellularAlt } from "react-icons/md";

const VoiceConnectionPanel = ({ channelName, onDisconnect, serverName }) => {
  return (
    <div className="bg-[#1A1A1E] border-b border-[#2b2d31] p-2 flex items-center justify-between m-1 mb-0 rounded-md">
      
      {/* Sol: Bağlantı Bilgisi */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1 text-[#23a559] text-xs font-bold group cursor-pointer">
           <MdSignalCellularAlt className="mb-0.5"/>
           <span className="group-hover:underline">Ses Bağlandı</span>
        </div>
        <div className="text-gray-400 text-xs truncate flex-1">
           {channelName} / {serverName}
        </div>
      </div>

      {/* Sağ: Bağlantıyı Kes Butonu */}
      <button 
        onClick={onDisconnect}
        className="text-gray-200 hover:text-white p-2 rounded hover:bg-[#393d42] transition"
        title="Bağlantıyı Kes"
      >
        <FaPhoneSlash size={16} />
      </button>

    </div>
  );
};

export default VoiceConnectionPanel;