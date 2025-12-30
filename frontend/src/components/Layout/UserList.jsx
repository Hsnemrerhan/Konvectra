import React from 'react';
import AnimatedNickname from '../Chat/AnimatedNickname';
import AnimatedAvatar from '../Chat/AnimatedAvatar';

const UserList = ({ users, roles = [], ownerId, type = "server" }) => {
  // Veriyi normalize et
  const safeMembers = (users || []).map(item => {
      if (type === 'home') {
          return { user: item, roles: [] }; 
      }
      return item; 
  });

  // --- YARDIMCI FONKSİYONLAR ---

  // Bir üyenin en yüksek rolünü bul
  const getHighestRole = (memberRoles) => {
      if (!memberRoles || memberRoles.length === 0 || roles.length === 0) return null;
      
      const memberRoleIds = new Set(memberRoles);
      
      // Rol listesini olduğu gibi tarıyoruz. 
      // (Backend'den gelen sıraya güveniyoruz, genelde ilk eşleşen en yetkili olandır)
      return roles.find(r => memberRoleIds.has(r._id));
  };

  // --- GRUPLAMA MANTIĞI ---
  
  const groups = {}; 
  const offlineList = [];

  safeMembers.forEach(member => {
      const user = member.user;
      if (!user) return;

      const status = user.status || 'offline';
      
      // ÇEVRİMDIŞI
      if (status === 'offline') {
          offlineList.push(member);
          return;
      }

      // ÇEVRİMİÇİ -> ROL GRUPLAMA
      const highestRole = getHighestRole(member.roles);
      
      if (highestRole) {
          if (!groups[highestRole._id]) {
              groups[highestRole._id] = {
                  role: highestRole,
                  members: []
              };
          }
          groups[highestRole._id].members.push(member);
      } else {
          if (!groups['ONLINE']) {
              groups['ONLINE'] = {
                  role: { name: 'ÇEVRİMİÇİ', _id: 'ONLINE', color: '#99aab5' },
                  members: []
              };
          }
          groups['ONLINE'].members.push(member);
      }
  });

  // --- SIRALAMA MANTIĞI (GÜNCELLENEN KISIM) ---

  // 1. Varsayılan Sıralama: Rolleri ters çevir (Son eklenen üstte)
  let orderedGroupKeys = [...roles].reverse().map(r => r._id); 
  
  // 2. OWNER ÖNCELİĞİ: Sunucu sahibi hangi gruptaysa, o grubu EN BAŞA al.
  if (ownerId) {
      const ownerGroupKey = orderedGroupKeys.find(key => {
          const group = groups[key];
          return group && group.members.some(m => m.user._id === ownerId);
      });

      if (ownerGroupKey) {
          // O grubu listeden çıkar ve en başa ekle
          orderedGroupKeys = orderedGroupKeys.filter(key => key !== ownerGroupKey);
          orderedGroupKeys.unshift(ownerGroupKey);
      }
  }

  // 3. Online (Rolsüzler) grubunu en sona ekle
  if (groups['ONLINE']) orderedGroupKeys.push('ONLINE');

  // 4. Grup İçi Sıralama (Owner en üstte, diğerleri alfabetik)
  Object.keys(groups).forEach(key => {
      groups[key].members.sort((a, b) => {
          // Owner her zaman en üstte
          if (a.user._id === ownerId) return -1; 
          if (b.user._id === ownerId) return 1;
          
          // İkincil: İsimlerine göre alfabetik
          const nameA = a.user.nickname || a.user.username;
          const nameB = b.user.nickname || b.user.username;
          return nameA.localeCompare(nameB);
      });
  });

  // --- RENDER ---

  const renderUser = (member, isOffline = false) => {
      const user = member.user;
      const highestRole = getHighestRole(member.roles);
      const nameColor = highestRole ? highestRole.color : (isOffline ? '#9ca3af' : '#f3f4f6'); 

      // Durum Rengi
      const getStatusColor = (s) => {
          switch(s) {
              case 'dnd': return 'bg-red-500';
              case 'idle': return 'bg-yellow-500';
              case 'offline': return 'bg-gray-500';
              default: return 'bg-green-500';
          }
      };

      return (
        <div 
          key={user._id} 
          className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-[#1A1A1E] group transition
            ${isOffline ? 'opacity-40 hover:opacity-100' : 'opacity-100'}`} 
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gray-600 relative flex-shrink-0">
            <AnimatedAvatar 
                src={user.avatar} 
                alt={user.nickname}
                className={`w-full h-full rounded-full object-cover ${isOffline ? 'grayscale' : ''}`} // className'i buraya veriyoruz
            />
            {/* Durum Noktası */}
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#121214] 
                ${getStatusColor(user.status || 'offline')}`}>
            </div>
          </div>

          {/* İsim ve Durum */}
          <div className="overflow-hidden">
            <div 
                className="font-bold text-sm truncate" 
                style={{ color: nameColor }} 
            >
                <AnimatedNickname 
                    text={user.nickname || user.username}
                />
            </div>
            
            <div className="text-xs text-gray-400 truncate">
                {user.status === 'online' ? 'Çevrimiçi' : user.status === 'dnd' ? 'Rahatsız Etmeyin' : user.status === 'idle' ? 'Boşta' : user.status === 'offline' ? 'Çevrimdışı' : ''
                }
            </div>
          </div>
        </div>
      );
  };

  return (
    <div className="w-60 bg-[#121214] hidden lg:flex flex-col p-3 overflow-y-auto flex-shrink-0 border-l border-[#1f2023] custom-scrollbar">
      
      {/* 1. ÇEVRİMİÇİ GRUPLARI */}
      {orderedGroupKeys.map(key => {
          const group = groups[key];
          if (!group || group.members.length === 0) return null;

          return (
              <div key={key} className="mb-6">
                  <div className="text-xs font-bold text-gray-400 uppercase mb-2 px-2 flex justify-between items-center">
                      <span>{group.role.name} — {group.members.length}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                      {group.members.map(member => renderUser(member, false))}
                  </div>
              </div>
          );
      })}

      {/* 2. ÇEVRİMDIŞI GRUBU */}
      {offlineList.length > 0 && (
          <div className="mt-2">
              <div className="text-xs font-bold text-gray-400 uppercase mb-2 px-2">
                  ÇEVRİMDIŞI — {offlineList.length}
              </div>
              <div className="flex flex-col gap-0.5">
                  {offlineList.map(member => renderUser(member, true))}
              </div>
          </div>
      )}

      {/* BOŞSA */}
      {safeMembers.length === 0 && (
        <div className="text-center mt-10 opacity-50">
           <div className="text-2xl mb-2 grayscale">😴</div>
           <div className="text-xs text-gray-400">Kimse yok...</div>
        </div>
      )}

    </div>
  );
};

export default UserList;