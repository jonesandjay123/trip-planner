import React, { useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ZONE_LABELS = {
  morning: '早上',
  afternoon: '下午',
  evening: '晚上',
  flexible: '彈性',
};

const ZONE_ORDER = ['morning', 'afternoon', 'evening', 'flexible'];

function getCardLocation(card) {
  const lat = Number(card?.location?.lat);
  const lng = Number(card?.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function createNumberIcon(index) {
  return L.divIcon({
    className: 'map-number-marker',
    html: `<span><b>${index + 1}</b></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

function formatDay(dateStr) {
  if (!dateStr) return '';
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})`;
}

export default function DayMapModal({ date, label, zones, cardMap, onClose }) {
  const scheduledCards = useMemo(() => {
    return ZONE_ORDER.flatMap((zone) =>
      (zones?.[zone] || [])
        .map((cardId) => ({ card: cardMap?.[cardId], zone }))
        .filter(({ card }) => Boolean(card))
    );
  }, [zones, cardMap]);

  const cardsWithLocation = useMemo(
    () => scheduledCards
      .map((entry, index) => ({ ...entry, order: index, location: getCardLocation(entry.card) }))
      .filter((entry) => entry.location),
    [scheduledCards]
  );

  const missingLocationCards = useMemo(
    () => scheduledCards.filter(({ card }) => !getCardLocation(card)),
    [scheduledCards]
  );

  const positions = cardsWithLocation.map(({ location }) => [location.lat, location.lng]);
  const center = positions[0] || [35.6762, 139.6503];
  const bounds = positions.length > 1 ? positions : null;
  const tileUrl = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttribution = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay map-modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-card map-modal-card">
        <div className="modal-header map-modal-header">
          <div>
            <h2>🗺️ {formatDay(date)} 地圖</h2>
            <p className="map-modal-subtitle">{label || '今日行程'} · {cardsWithLocation.length} 個已定位景點</p>
          </div>
          <button className="map-modal-close" onClick={onClose} aria-label="關閉地圖">
            ✕
          </button>
        </div>

        <div className="map-modal-body">
          {cardsWithLocation.length > 0 ? (
            <MapContainer
              className="day-map"
              center={center}
              zoom={13}
              bounds={bounds || undefined}
              boundsOptions={{ padding: [36, 36] }}
              scrollWheelZoom
            >
              <TileLayer attribution={tileAttribution} url={tileUrl} />
              {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#ff7043', weight: 3, opacity: 0.72 }} />}
              {cardsWithLocation.map(({ card, zone, order, location }) => (
                <Marker
                  key={card.id}
                  position={[location.lat, location.lng]}
                  icon={createNumberIcon(order)}
                >
                  <Popup>
                    <div className="map-popup">
                      <strong>{order + 1}. {card.title}</strong>
                      {card.subtitle && <span>{card.subtitle}</span>}
                      <small>{ZONE_LABELS[zone]} · {card.area || '未填區域'}</small>
                      {card.location?.placeName && <small>📍 {card.location.placeName}</small>}
                      {card.location?.address && <small>{card.location.address}</small>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="map-empty-state">
              <div className="map-empty-icon">📍</div>
              <strong>這一天還沒有可顯示在地圖上的座標</strong>
              <span>在卡片編輯視窗補上 latitude / longitude 後，marker 就會出現在這裡。</span>
            </div>
          )}

          <div className="map-itinerary-list">
            <div className="map-list-title">行程順序</div>
            {scheduledCards.length === 0 ? (
              <p className="map-muted">這一天尚未排入卡片。</p>
            ) : (
              scheduledCards.map(({ card, zone }, index) => {
                const location = getCardLocation(card);
                return (
                  <div key={`${card.id}-${index}`} className={`map-list-item ${location ? 'has-location' : 'missing-location'}`}>
                    <span className="map-list-number">{index + 1}</span>
                    <div>
                      <strong>{card.title}</strong>
                      <small>{ZONE_LABELS[zone]} · {card.area || '未填區域'} {location ? '· 已定位' : '· 尚未定位'}</small>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {missingLocationCards.length > 0 && (
            <div className="map-missing-box">
              <strong>尚未定位</strong>
              <span>{missingLocationCards.map(({ card }) => card.title).join('、')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
