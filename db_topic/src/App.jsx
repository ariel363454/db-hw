import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle, Tooltip, useMapEvents, FeatureGroup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { createPortal } from 'react-dom';


const parseWKTToLatLng = (wktStr) => {
  if (!wktStr || typeof wktStr !== 'string') return [];
  
  // 🚀 1. 抓出所有數位（包含負號與小數點）
  const numberPattern = /-?\d+\.\d+|-?\d+/g;
  const matches = wktStr.match(numberPattern);
  
  if (!matches || matches.length < 2) return [];
  
  const coords = [];
  
  // 🚀 2. 兩兩一組抽取座標對，進行智能盲測與物理對調
  for (let i = 0; i < matches.length; i += 2) {
    const val1 = parseFloat(matches[i]);
    const val2 = parseFloat(matches[i + 1]);
    
    if (isNaN(val1) || isNaN(val2)) continue;

    // 🎯 情況 A：第一個是經度 (121)，第二個是緯度 (25) -> 標準 WKT 流
    if (val2 >= 20 && val2 <= 26 && val1 >= 119 && val1 <= 123) {
      coords.push([val2, val1]); // Leaflet 要的是 [lat, lng]，所以放 [val2, val1]
    }
    // 🎯 情況 B：第一個是緯度 (25)，第二個是經度 (121) -> 髒資料顛倒流
    else if (val1 >= 20 && val1 <= 26 && val2 >= 119 && val2 <= 123) {
      coords.push([val1, val2]); // 自動對調，精準導正為 [lat, lng]
    }
  }
  
  return coords;
};

const getAvailabilityColor = (avaCar) => {
  if (avaCar === null || avaCar === undefined || avaCar === '') return '#BDC3C7';
  const count = parseInt(avaCar, 10);
  if (isNaN(count)) return '#BDC3C7'; 

  if (count > 3) return '#6B9E78';           // 🟢 綠色
  if (count >= 1 && count <= 3) return '#E67E22'; // 🟠 橘色
  if (count === 0) return '#C96B5C';          // 🔴 紅色
  return '#BDC3C7';
};

const getAvailabilityTextOpacity = (avaCar) => {
  if (avaCar === null || avaCar === undefined || avaCar === '') return 0.6;
  const count = parseInt(avaCar, 10);
  if (isNaN(count)) return 0.6;

  if (count > 3) return 0.8;
  if (count >= 1 && count <= 3) return 0.6;
  if (count === 0) return 0.72;
  return 0.6; 
};
let globalDebounceTimer;

function App() {
  const [parkingItems, setParkingItems] = useState([]);
  const [isRadiusMode, setIsRadiusMode] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [map, setMap] = useState(null);
  const [activeFeeItem, setActiveFeeItem] = useState(null);

  const MapEvents = () => {
    const mapInstance = useMapEvents({
      dragend: () => handleMapChange(),
      zoomend: () => handleMapChange(),
    });

    const handleMapChange = () => {
      clearTimeout(globalDebounceTimer);

      globalDebounceTimer = setTimeout(() => {
        if (!mapInstance) return;
        
        try {
          const bounds = mapInstance.getBounds();
          const params = {
            min_lat: bounds.getSouth(),
            max_lat: bounds.getNorth(),
            min_lng: bounds.getWest(),
            max_lng: bounds.getEast(),
          };

          if (isRadiusMode && userLocation) {
            params.user_lat = userLocation.lat;
            params.user_lng = userLocation.lng;
          }

          console.log("📡 [緩衝盾牌生效] 視域完全靜止，發送單一請求...", params);

          axios.get('/api/parking_bounds/', { params })
            .then((res) => {
              if (res.data) {
                console.log("✅ 成功獲取後端異質資料筆數:", res.data.length);
                setParkingItems(res.data);
              }
            })
            .catch((err) => console.error("❌ API 撈取失敗:", err));
            
        } catch (e) {
          console.warn("⚠️ 攔截到動畫重繪暫時性異常，已自動屏蔽以防止白屏:", e);
        }
      }, 400);
    };

    return null;
  };

  const handleSearchNearby = (mapInstance) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = 25.0478;
          const lng = 121.5170;
          
          console.log("🎯 [Demo Mock 模式啟用] 已模擬使用者位於台北車站");
          
          setUserLocation({ lat, lng });
          setIsRadiusMode(true);
          
          if (mapInstance) {
            mapInstance.flyTo([lat, lng], 16);
          }
        },
        (err) => {
          console.warn("⚠️ 攔截到 GPS 獲取失敗，啟動備用 Demo 機制");
          const lat = 25.0478;
          const lng = 121.5170;
          
          setUserLocation({ lat, lng });
          setIsRadiusMode(true);
          
          if (mapInstance) {
            mapInstance.flyTo([lat, lng], 16);
          }
        }
      );
    } else {
      const lat = 25.0478;
      const lng = 121.5170;
      setUserLocation({ lat, lng });
      setIsRadiusMode(true);
      if (mapInstance) mapInstance.flyTo([lat, lng], 16);
    }
  };

  const handleResetToGlobal = (mapInstance) => {
    setIsRadiusMode(false);
    setUserLocation(null);
    console.log("🌐 [自由瀏覽模式] 已解除 500m 半徑精篩，恢復全圖視野");

    // 🚀 讓地圖優雅地飛回大台北中心點，並把比例尺縮小到 14，展現全圖氣勢
    if (mapInstance) {
      mapInstance.flyTo([25.055, 121.523], 14);
    }
  };

  return (
    <div className="app-container relative w-full h-full flex flex-col" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
      
      <div 
        className="absolute left-1/2 -translate-x-1/2 z-[1000] flex flex-row items-center gap-3"
        style={{ top: '15px' }} 
      >
        
        {/* 🎯 按鈕 A：附近的 500m 精篩 */}
        <button 
          onClick={() => handleSearchNearby(map)}
          className="font-bold py-1.5 px-6 cursor-pointer transition-all active:scale-95 text-xs tracking-wide flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(255,255,255,0.82)', 
            color: '#374151',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            borderRadius: '14px',
            boxshadow: '0 4px 12px rgba(15,23,42,0.08)',
          }}
        >
          {isRadiusMode ? (
            <>
              {/* 📍 已鎖定：流線定位針 Icon */}
              <svg className="w-[1.3em] h-[1.3em]" style={{ marginRight: '6px', strokeWidth: '2.5', color: '#6B7280'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>已鎖定附近 500m 模式</span>
            </>
          ) : (
            <>
              {/* 🎯 未鎖定：科技雷達準心 Icon */}
              <svg className="w-[1.3em] h-[1.3em]" style={{ marginRight: '6px', strokeWidth: '2.5', color: '#6B7280'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="22" y1="12" x2="18" y2="12"></line>
                <line x1="6" y1="12" x2="2" y2="12"></line>
                <line x1="12" y1="6" x2="12" y2="2"></line>
                <line x1="12" y1="22" x2="12" y2="18"></line>
              </svg>
              <span>搜尋我附近 (500m 半徑精篩)</span>
            </>
          )}
        </button>

        {/* 🌐 按鈕 B：恢復自由瀏覽 */}
        {isRadiusMode && (
          <button 
            onClick={() => handleResetToGlobal(map)}
            className="font-bold py-1.5 px-6 rounded-full cursor-pointer transition-all active:scale-95 text-xs tracking-wide animate-fade-in flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(255,255,255,0.82)', 
              color: '#374151',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              borderRadius: '14px',
              boxshadow: '0 4px 12px rgba(15,23,42,0.08)',
            }}
          >
            {/* 🌐 自由瀏覽：極簡線性地球 Icon */}
            <svg className="w-[1.3em] h-[1.3em]" style={{ marginRight: '6px', strokeWidth: '2.2', color: '#6B7280'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>恢復全圖自由瀏覽</span>
          </button>
        )}
      </div>
      <div className="absolute bottom-10 right-5 z-[1000] flex flex-col gap-3">
        
        {/* ➕ 放大按鈕 */}
        <button
          onClick={() => map.zoomIn()} // 🚀 呼叫 Leaflet 的內建放大功能
          className="font-bold text-slate-800 border-slate-200/80 cursor-pointer transition-all active:scale-90 flex items-center justify-center text-lg"
          style={{
            width: '44px !important',
            height: '44px !important',
            minHeight: '44px',
            minWidth: '44px',
            backgroundColor: 'rgba(255,255,255,0.88)',
            color: '#4B5563',
            border: '0px solid #4B5563',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            borderRadius: '14px 14px 0 0', // 🎯 上圓角設計，與下方縮小按鈕形成視覺連結
          }}
        >
          ＋
        </button>

        {/* ➖ 縮小按鈕 */}
        <button
          onClick={() => map.zoomOut()} // 🚀 呼叫 Leaflet 的內建縮小功能
          className="text-slate-800 border-slate-200/80 cursor-pointer transition-all active:scale-90 flex items-center justify-center text-lg"
          style={{
            width: '44px !important',
            height: '44px !important',
            minWidth: '44px',
            minHeight: '44px',
            backgroundColor: 'rgba(255,255,255,0.88)',
            color: '#4B5563',
            border: '0px solid #4B5563',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            borderRadius: '0 0 14px 14px',
          }}
        >
          －
        </button>

      </div>
      {/* 🗺️ Leaflet 地圖主體容器 */}
      <MapContainer 
        center={[25.055, 121.523]} 
        zoom={15}
        zoomControl={false} 
        style={{ width: '100%', height: '100%' }}
        ref={setMap}
        whenReady={(mapInstance) => {
          setTimeout(() => {
            mapInstance.target.invalidateSize();
          }, 100);
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapEvents />

        {isRadiusMode && userLocation && (
          <React.Fragment>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={5} // 實體 8 公尺小圓點，當作中心指針
              pathOptions={{
                fillColor: '#E07A5F', // Tailwind Red 500
                fillOpacity: 1,
                color: '#FFFFFF',
                weight: 2,
              }}
            />

            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={500} // 📐 嚴格對齊後端 ST_Distance_Sphere 的 500 公尺！
              pathOptions={{
                fillColor: '#6366F1',   // Tailwind Blue 500
                fillOpacity: 0.08,     // 🌌 極致輕薄的半透明科技底色，絕對不遮擋馬路和圖標
                color: '#6366F1',
                opacity: '0.35~0.4',
                weight: 1,
                dashArray: '18, 12',     // ⚡ 讓圓形外框變虛線圈，視覺質感直接飛天！
              }}
              interactive={false}      // 🚀 關鍵：設為 false 讓滑鼠點擊可以完全「穿透」光圈，絕對不卡住底下的停車場 Popup！
            />
          </React.Fragment>
        )}
        <div 
          className="absolute bottom-24 right-5 z-[1000] flex flex-col gap-2.5 p-3 rounded-xl border-slate-200/80 tracking-wide animate-fade-in"
          style={{
            width: '180px',
            height: '180px',
            backgroundColor: 'rgba(255,255,255,0.82)',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            border: '1px solid #FFFFFF30',
            borderRadius: '14px',
            userSelect: 'none',
            bottom: '24px',
            right: '5px',
          }}
        >
          {/* 卡片標題 */}
          <div className="text-[16px] text-slate-400 uppercase tracking-widest mb-20" style={{ color: '#4B5563', marginLeft: '60px', marginBottom: '10px' }}>
            圖例說明
          </div>

          {/* ❶ 停車場 */}
          <div className="flex items-center gap-7 text-[14px] font-bold" style={{ color: '#4B5563' }}>
            <div className="flex items-center justify-center w-6 h-4">
              {/* 🟢 絕對不跑版正圓點：代表地圖上的點狀水滴 */}
              <div style={{ width: '20px', height: '20px', backgroundColor: '#4F46E5', borderRadius: '50% 50% 50% 15%', transform: 'rotate(-45deg)', marginLeft: '13.5px', marginBottom: '10px' }} />
            </div>
            <span style={{ fontSize: '16px', marginLeft: '14.5px', marginBottom: '10px' }}>停車場</span>
          </div>

          {/* ❸ 黃線 */}
          <div className="flex items-center gap-3 text-[14px] font-bold" style={{ color: '#4B5563' }}>
            <div className="flex items-center justify-center w-6 h-4">
              {/* 🟡 鮮明交通黃線 */}
              <div style={{ width: '24px', height: '4px', backgroundColor: '#C9A227', borderRadius: '2px', marginLeft: '12px', marginBottom: '10px' }} />
            </div>
            <span style={{ fontSize: '16px', marginLeft: '12px', marginBottom: '10px' }}>黃線 (時段臨停)</span>
          </div>

          {/* ❹ 路邊可停 */}
          <div className="flex items-center gap-3 text-[14px] font-bold" style={{ color: '#4B5563' }}>
            <div className="flex items-center justify-center w-6 h-4">
              {/* 🟢 自由瀏覽翠綠線 */}
              <div style={{ width: '24px', height: '4px', backgroundColor: '#6B9E78', borderRadius: '2px', marginLeft: '12px', marginBottom: '10px' }} />
            </div>
            <span style={{ fontSize: '16px', marginLeft: '12px', marginBottom: '10px' }}>路邊可停</span>
          </div>

          {/* ❺ 已滿 */}
          <div className="flex items-center gap-3 text-[14px] font-bold" style={{ color: '#4B5563' }}>
            <div className="flex items-center justify-center w-6 h-4">
              {/* ⚪ 飽和莫蘭迪灰線 */}
              <div style={{ width: '24px', height: '4px', backgroundColor: '#C96B5C', borderRadius: '2px', marginLeft: '12px', marginBottom: '10px' }} />
            </div>
            <span style={{ fontSize: '16px', marginLeft: '12px', marginBottom: '10px' }}>路邊已滿</span>
          </div>
        </div>

        {parkingItems.map((item, idx) => {
          if (!item || !item.type) return null;
          
          if (item.type === 'lot') {
            if (!item.latitude || !item.longitude) return null;
            const lat = parseFloat(item.latitude);
            const lng = parseFloat(item.longitude);
            if (isNaN(lat) || isNaN(lng)) return null;

            const getParkingIcon = (avaCar, carSpace) => {
              const isFull = avaCar <= 0 || avaCar === null || avaCar === undefined;
              
              const bgColor = isFull ? '#9CA3AF' : '#4338CA'; 
              const wdColor = isFull ? '#F3F4F6' : '#F8FAFC';
              const opacity = isFull ? 0.8 : 1;
              const displayText = isFull ? '滿' : avaCar;
              const fontSize = isFull ? '11px' : '13px'; // 「滿」字稍微縮小一點點比較精緻

              return L.divIcon({
                className: 'my-premium-p-icon', 
                html: `
                  <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 44px;
                    height: 44px;
                    background-color: ${bgColor} !important; /* 🎯 動態背景色 */
                    border: 1px solid #FFFFFF30 !important; 
                    border-radius: 50% 50% 50% 10%; transform: rotate(-45deg);
                    box-shadow: 0 2px 6px rgba(15,23,42,0.12); 
                    cursor: pointer;
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                  ">
                    <span style="
                      color: ${wdColor} !important;           
                      font-family: sans-serif !important;
                      font-weight: 500 !important;
                      font-style: normal !important;
                      transform: rotate(45deg) !important;
                      font-size: 10px !important;
                      line-height: 1 !important;
                      user-select: none;
                      margin: 0;
                      padding: 0;
                    ">${displayText}
                    </span>
                  </div>
                `,
                iconSize: [26, 26],   
                iconAnchor: [13, 13], 
                popupAnchor: [0, -13],
              });
            };    

            return (
              <Marker 
                position={[lat, lng]} 
                icon={getParkingIcon(item.ava_car, item.car_space)}
                key={`lot-p-style-secure-${item.lot_id || item.id}`} // 🔒 身份鎖死，絕不白屏
              >
                <Popup
                  maxWidth={220}
                  minWidth={220}
                  autoPanPadding={[50, 50]}
                >
                  <div className="font-sans p-1" style={{ minWidth: '190px' }}>
                    {/* 🅿️ 1. 停車場名稱標題（與大彈窗同款線性方框） */}
                    <h3 className="text-sm font-bold flex items-center gap-1.5 m-0 mb-2" style={{ color: '#090d16', lineHeight: '1.4' }}>
                      <svg className="w-[1em] h-[1em] flex-shrink-0 inline-block align-text-bottom" style={{ color: '#4F46E5', marginRight: '2px' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="4" />
                        <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
                      </svg>
                      <span>{item.lot_name || '未命名停車場'}</span>
                    </h3>

                    {/* 📍 2. 地址（極簡線性大頭針，微調對齊） */}
                    <p className="text-xs m-0 mb-1.5 flex items-center gap-1.5" style={{ color: '#6b7280' }}>
                      <svg className="w-[1.1em] h-[1.1em] flex-shrink-0" style={{ color: '#9ca3af', marginBottom: '-0.02em', marginRight: '2px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="block truncat" title={item.addr}>{item.addr || '暫無地址資料'}</span>
                    </p>

                    {/* ⏱️ 3. 營運時間（極簡線性時鐘） */}
                    <p className="text-xs m-0 mb-2.5 flex items-center gap-1.5" style={{ color: '#6b7280' }}>
                      <svg className="w-[1.1em] h-[1.1em] flex-shrink-0" style={{ color: '#9ca3af', marginBottom: '0.02em', marginRight: '4px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{item.service_time || '未提供資料'}</span>
                    </p>

                    {/* 📊 區塊分隔線與剩餘車位列表 */}
                    <div className="flex flex-col gap-1.5 pt-2.5 border-t border-slate-100">
                      
                      {/* 🚗 一般車位 */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1.5">
                          {/* 線性小汽車 Icon */}
                          <svg className="w-[1.2em] h-[1.2em] flex-shrink-0" style={{ color: '#9ca3af', marginRight: '2px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                            <circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />
                          </svg>
                          一般剩餘
                        </span>
                        <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                          {item.ava_car ?? '0'} <span className="text-[10px] text-blue-400 font-normal">/{item.car_space ?? 0}</span>
                        </span>
                      </div>

                      {/* ♿ 身障車位 */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1.5">
                          {/* 線性無障礙 Icon */}
                          <svg className="w-[1.2em] h-[1.2em] flex-shrink-0" style={{ color: '#9ca3af', marginRight: '2px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="4" r="1.5" />
                            <path d="M9 8h4.5l1.5 5h3.5" />
                            <path d="M16 16.5A4.5 4.5 0 1 1 11.5 12" />
                          </svg>
                          身障剩餘
                        </span>
                        <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                          {item.ava_handicap ?? '0'} <span className="text-[10px] text-blue-400 font-normal">/{item.handicap_space ?? 0}</span>
                        </span>
                      </div>

                      {/* 🤰 孕婦車位 */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-1">
                          
                          {/* 🚀 關鍵改動：換上極簡流線心形（母子意象） */}
                          <svg 
                            className="w-[1.2em] h-[1.2em] flex-shrink-0" 
                            style={{ color: '#9ca3af', marginBottom: '-0.3em', marginRight: '2px'}} // 莫蘭迪灰维持一致
                            xmlns="http://www.w3.org/2000/svg" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            {/* 🚀 這個公式畫出一個大心形包著一個小心形，象徵母嬰流線，變小也絕對清晰 */}
                            <path d="M21 8a6 6 0 0 1-12 0 6 6 0 0 1 12 0Z" />
                            <path d="M12.5 12.5a3 3 0 0 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                          孕婦剩餘：
                        </span>
                        <span className="font-bold text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded text-xs">
                          {item.ava_pregnancy ?? '0'} <span className="text-gray-400 font-normal">/{item.pregnancy_space ?? 0}</span>
                        </span>
                      </div>

                    </div>

                    {/* 🔗 4. 查看詳細收費按鈕（完美整合你的 onClick 防禦邏輯 + iOS 微感灰） */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); 
                        console.log("按鈕有被點到！目前的資料是：", item); 
                        setActiveFeeItem(item);
                      }}
                      className="w-full font-bold text-xs tracking-wide transition-colors block text-center mt-3"
                      style={{ 
                        backgroundColor: '#e5e7eb', // 🚀 套用跟你大彈窗一模一樣的 iOS 微感灰
                        color: '#4b5563', 
                        border: 'none', 
                        padding: '1px 0', 
                        borderRadius: '8px',       // 配合小彈窗比例，圓角 8px 最精緻
                        cursor: 'pointer'
                      }}
                    >
                      查看詳細收費標準
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          }
                
          // 🔵 情境 B：路邊停車格 (road)
          if (item.type === 'road' && item.geometry_wkt) {
            const coords = parseWKTToLatLng(item.geometry_wkt);
            if (!coords || coords.length < 2) return null; 
            
            const lineColor = getAvailabilityColor(item.ava_car);
            const textOpacity = getAvailabilityTextOpacity(item.ava_car);
            
            return (
              <FeatureGroup key={`road-secure-id-${item.road_id || item.id}`}>
                
                {/* 🛡️ 第一層：隱形觸控盾牌（寬度 25px，專門負責滑鼠靈敏點擊） */}
                <Polyline
                  positions={coords}
                  color="transparent"       
                  weight={30}               
                  opacity={0}               
                  lineCap="round"
                  lineJoin="round"
                  noClip={true}
                >
                  <Popup
                    maxWidth={220}
                    minWidth={220}
                    autoPanPadding={[50, 50]}
                  >
                    <div className="p-1 text-slate-800 font-sans">
                      <h3 className="text-sm font-bold m-0 mb-1 text-slate-900">路邊停車路段</h3>
                        <p className="text-xs m-0 mb-1.5 flex items-center gap-1.5" style={{ color: '#6b7280' }}>
                          <svg className="w-[1.1em] h-[1.1em] flex-shrink-0" style={{ color: '#9ca3af', marginBottom: '-0.02em', marginRight: '2px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span className="block truncat" title={item.road_name}>
                            {item.road_name || '暫無路名資料'}
                          </span>
                        </p> 
                        <div className="flex flex-col gap-1.5 pt-2.5 border-t border-slate-100">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 flex items-center gap-1.5">
                              {/* 線性小汽車 Icon */}
                              <svg className="w-[1.2em] h-[1.2em] flex-shrink-0" style={{ color: '#9ca3af', marginRight: '2px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                                <circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />
                              </svg>
                              一般剩餘
                            </span>
                            <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                              {item.ava_car ?? '0'} <span className="text-[10px] text-blue-400 font-normal">/{item.total_car ?? 0}</span>
                            </span>
                          </div>
                          {/* ♿ 身障車位 */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 flex items-center gap-1.5">
                              {/* 線性無障礙 Icon */}
                              <svg className="w-[1.2em] h-[1.2em] flex-shrink-0" style={{ color: '#9ca3af', marginRight: '2px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="4" r="1.5" />
                                <path d="M9 8h4.5l1.5 5h3.5" />
                                <path d="M16 16.5A4.5 4.5 0 1 1 11.5 12" />
                              </svg>
                              身障剩餘
                            </span>
                            <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                              {item.ava_handicap ?? '0'} <span className="text-[10px] text-blue-400 font-normal">/{item.total_handicap ?? 0}</span>
                            </span>
                          </div>
                          {/* 🤰 孕婦車位 */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 flex items-center gap-1">
                              
                              {/* 🚀 關鍵改動：換上極簡流線心形（母子意象） */}
                              <svg 
                                className="w-[1.2em] h-[1.2em] flex-shrink-0" 
                                style={{ color: '#9ca3af', marginBottom: '-0.3em', marginRight: '2px'}} // 莫蘭迪灰维持一致
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                              >
                                {/* 🚀 這個公式畫出一個大心形包著一個小心形，象徵母嬰流線，變小也絕對清晰 */}
                                <path d="M21 8a6 6 0 0 1-12 0 6 6 0 0 1 12 0Z" />
                                <path d="M12.5 12.5a3 3 0 0 1-6 0 3 3 0 0 1 6 0Z" />
                              </svg>
                              孕婦剩餘：
                            </span>
                            <span className="font-bold text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded text-xs">
                              {item.ava_pregnancy ?? '0'} <span className="text-gray-400 font-normal">/{item.total_pregnancy ?? 0}</span>
                            </span>
                          </div>
                        </div>
                    </div>
                    {/* 🔗 4. 查看詳細收費按鈕（完美整合你的 onClick 防禦邏輯 + iOS 微感灰） */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); 
                        console.log("按鈕有被點到！目前的資料是：", item); 
                        setActiveFeeItem(item);
                      }}
                      className="w-full font-bold text-xs tracking-wide transition-colors block text-center mt-3"
                      style={{ 
                        width: '200px',
                        backgroundColor: '#e5e7eb', // 🚀 套用跟你大彈窗一模一樣的 iOS 微感灰
                        color: '#4b5563', 
                        border: 'none', 
                        padding: '1px 0', 
                        borderRadius: '8px',       // 配合小彈窗比例，圓角 8px 最精緻
                        cursor: 'pointer'
                      }}
                    >
                      查看詳細收費標準
                    </button>
                  </Popup>
                </Polyline>

                <Polyline 
                  positions={coords} 
                  color={lineColor}
                  weight={2}                
                  opacity={textOpacity} 
                  lineCap="round" 
                  lineJoin="round" 
                  interactive={false}       
                  noClip={true}
                />

              </FeatureGroup>
            );
          }

          // 🟡 情境 C：黃線管制 (yellow_line)
          if (item.type === 'yellow_line' && item.geometry_wkt) {
            const coords = parseWKTToLatLng(item.geometry_wkt);
            if (!coords || coords.length < 2) return null;

            return (
              <FeatureGroup key={`yl-secure-group-${item.yl_id || item.id}`}>
                {/* 🛡️ 第一層：隱形觸控盾牌（寬度 25px，完全透明，負責抓滑鼠點擊） */}
                <Polyline
                  positions={coords}
                  pathOptions={{
                    color: '#C9A227',
                    weight: 25,
                    opacity: 0,
                  }}
                >
                  <Popup>
                    <div className="p-1 text-slate-800 font-sans min-w-[200px]">
                      <h3 className="text-sm font-bold text-orange-700 m-0 mb-1 flex items-center gap-1">
                        ⚠️ 黃線管制路段
                      </h3>
                      <p className="text-xs m-0 text-slate-900 font-semibold mb-1">
                        🛣️ 路名：{item.road_name || '無特定路名'}
                      </p>
                      <p className="text-xs m-0 text-gray-500 mb-2">
                        🏙️ 行政區：{item.area_name || '未標示'}
                      </p>
                      
                      <div className="pt-1.5 border-t border-slate-100 text-xs">
                        <span className="text-gray-500 font-medium">🚫 管制禁停時間：</span>
                        <p className="m-0 mt-1 text-red-600 font-bold bg-red-50 px-1.5 py-1 rounded">
                          {item.control_time || '無資料'}
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Polyline>

                {/* 🎨 第二層：視覺實線外框（寬度 2px，純視覺，滑鼠直接穿透） */}
                <Polyline
                  positions={coords}
                  pathOptions={{
                    color: '#F1C40F',
                    weight: 1.5,
                    opacity: 0.6,
                    lineCap: 'butt',
                    lineJoin: 'round',
                  }}
                  interactive={false} // 🚀 關鍵：讓滑鼠完全穿透，點擊會直接穿過去觸發第一層的 25px 盾牌
                  noClip={true}
                />
              </FeatureGroup>
            );
          }
          return null;
        })}
      </MapContainer>
      {activeFeeItem && createPortal(
        <div 
          className="fixed inset-0"
          style={{ 
            zIndex: 9999999,
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.25)', // 🌑 這裡直接灌黑色半透明底
            backdropFilter: 'blur(2px)'
          }}
          // 🚀 點擊黑色背景，百分之百直接觸發關閉！
          onClick={() => setActiveFeeItem(null)} 
        >
          {/* ⬜ 視窗主體：鎖死寬度、絕對置中、物理防禦 */}
          <div 
            className="font-sans shadow-[0_25px_60px_rgba(0,0,0,0.3)]"
            style={{ 
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)', 
              width: '432px',
              minWidth: '320px',
              backgroundColor: '#F9FAFB', // 100% 實心白底
              borderRadius: '16px',
              border: '1px solid #e5e7eb',
              color: '#000000',
              padding: '24px',
              boxSizing: 'border-box',
              cursor: 'default'
            }}
            // 🚀 點擊白色視窗內部時，阻斷它，不要觸發外層的關閉
            onClick={(e) => e.stopPropagation()} 
          >
            
            {/* 1. 標頭區 */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-base font-bold m-0 mb-1 flex items-center gap-2" style={{ color: '#111827' }}>
                  {/* 🅿️ 這是全新的純線性高質感 🅿️ Icon */}
                  <svg 
                    className="w-[1em] h-[1em] flex-shrink-0 inline-block align-text-bottom" // 🚀 1. 鎖定文字比例，並設定行內對齊
                    style={{ color: '#4F46E5', marginBottom: '0.00em' }} // 🚀 2. 微調下邊距，確保它跟中文字的水平線完美貼齊
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.8" // 🚀 3. 縮小到跟字一樣大時，線條要加粗到 2.8 左右，看起來才不會太虛
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    {/* 內部的畫畫公式 */}
                    <rect x="2" y="2" width="20" height="20" rx="4" /> 
                    <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
                  </svg>

                  {/* 停車場或路段名稱 */}
                  <span>{activeFeeItem.lot_name || activeFeeItem.road_name || '未命名場站'}</span>
                </h3>
                {activeFeeItem.addr && (
                  <p 
                    className="text-xs m-0 mb-1 flex items-center gap-2.5" 
                    style={{ color: '#6b7280', paddingLeft: '0px' }} // 🚀 微調左邊距，讓它跟上面的標題完美對齊
                  >
                    {/* 🔲 這是全新的地址專用：微型線性圓角方框 📍 Icon */}
                    <svg 
                      className="w-[1.1em] h-[1.1em] flex-shrink-0 inline-block align-text-bottom" 
                      style={{ color: '#9ca3af', marginBottom: '-0.03em' }} // 質感低調灰
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.2" // 🚀 降低一點線條粗細，變小也絕對不糊、超精細
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      {/* 🚀 關鍵改動：拿掉死板的外框！改用單純、優雅的經典線性大頭針幾何線條 */}
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>

                    {/* 真正的地址文字 */}
                    <span>{activeFeeItem.addr}</span>
                  </p>
                )}
              </div>
              <button 
                onClick={() => setActiveFeeItem(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg font-light p-1 leading-none"
              >
                ✕
              </button>
            </div>

            {/* 2. 營運時間 */}
            <p className="text-xs m-0 mb-2 flex items-center gap-2" style={{ color: '#4b5563' }}>
              {/* 🕒 全新極簡線性時鐘 Icon */}
              <svg 
                className="w-[1.1em] h-[1.1em] flex-shrink-0 inline-block align-text-bottom" 
                style={{ color: '#9ca3af', marginBottom: '-0.01em' }} 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" /> {/* 🚀 這行畫出時針與分針 */}
              </svg>

              {/* 營業時間文字 */}
              <span>營運時間：{activeFeeItem.tw_open_info || '24 小時營業'}</span>
            </p>
            
            {/* 3. 核心內容區 */}
            <div className="flex flex-col gap-3 pt-3 border-t border-slate-100" style={{ borderTop: '1px solid #e5e7eb' }}>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="text-xs font-bold mb-1 flex items-center gap-1.5" style={{ color: '#1f2937' }}>
                  {/* 🪙 全新極簡線性錢幣 Icon */}
                  <svg 
                    className="w-[1.1em] h-[1.1em] flex-shrink-0 inline-block align-text-bottom" 
                    style={{ color: '#9ca3af', marginBottom: '0.00em' }} // 低調灰色維持一致
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.2" // 輕量化精細線條
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    {/* 🚀 關鍵改動：拿掉死板的字體符號，改用優雅的「雙層層疊硬幣」幾何線條 */}
                    {/* 後方硬幣的邊緣弧線 */}
                    <path d="M17 12A5 5 0 0 1 12 17M17 12a5 5 0 0 0-5-5" /> 
                    
                    {/* 前方主體硬幣 */}
                    <circle cx="9" cy="12" r="5" />
                    
                    {/* 硬幣中央高質感的極簡十字，隱喻錢幣刻紋，變小也極度清晰 */}
                    <path d="M9 10v4M7 12h4" />
                  </svg>
                  {/* 收費標準標題文字 */}
                  <span>收費標準</span>
                </div>                
                {/* 核心費率文字框 */}
                <div 
                  className="font-bold rounded text-xs leading-relaxed whitespace-pre-wrap"
                  style={{ backgroundColor: '#f3f4f6', color: '#495a74', border: '1px solid #eceff3', padding: '10px', borderRadius: '8px' }}
                >
                  {activeFeeItem.charge_fee || activeFeeItem.charge || '每小時 40 元。當日最高收費 200 元。'}
                </div>
              </div>

              {/* 更新時間小字 */}
              <div className="text-[10px] pt-1 flex items-center justify-between" style={{ color: '#9ca3af' }}>
                {/* 🚀 讓 Icon 和文字用 flex 水平置中，並用 gap-1 控制它們的橫向間距 */}
                <span className="flex items-center gap-2">
                  
                  {/* 全新高質感微型線性 ⓘ Icon */}
                  <svg 
                    className="w-[1.2em] h-[1.2em] flex-shrink-0" 
                    style={{ 
                      color: '#9ca3af', 
                      // 🎯 垂直位置微調彈簧：
                      // 如果覺得 Icon 太高就調小（如 0em 或 -0.01em）
                      // 如果覺得 Icon 太低就調大（如 0.05em 或 0.08em）
                      marginBottom: '0.02em' 
                    }} 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" // 線條粗細
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>

                  {/* 提示文字本體 */}
                  實際費率請以現場公告為準
                </span>
              </div>
            </div>

            {/* 4. 底部大按鈕 */}
            <div className="mt-4">
              <button
                onClick={() => setActiveFeeItem(null)}
                className="w-full text-white text-xs font-bold py-2 px-4 rounded shadow text-center cursor-pointer"
                style={{ backgroundColor: '#e5e7eb', color: '#4b5563', border: 'none', borderRadius: '12px', padding: '2px' }}
              >
                確認並關閉
              </button>
            </div>

          </div>
        </div>,
        document.body // 🚀 降維打擊：強行拔出地圖，直接塞進 HTML 最外層的 body！
      )}
    </div>
  );
}

export default App;