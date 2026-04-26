import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
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

function createNumberIcon(index, active = false) {
  return L.divIcon({
    className: `map-number-marker ${active ? 'active' : ''}`,
    html: `<span><b>${index + 1}</b></span>`,
    iconSize: active ? [42, 42] : [30, 30],
    iconAnchor: active ? [21, 42] : [15, 30],
    popupAnchor: [0, active ? -38 : -28],
  });
}

function formatDay(dateStr) {
  if (!dateStr) return '';
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})`;
}

function stripEmoji(text) {
  return String(text || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\p{Emoji_Presentation}/gu, '')
    .replace(/[\uFE0E\uFE0F\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildGoogleMapsUrl(card) {
  const location = getCardLocation(card);
  const queryParts = [card?.location?.placeName, card?.title, card?.location?.address, card?.area]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  // Prefer keyword/address search because it is more likely to open the real Google Maps place page.
  // Fall back to coordinates for low-information cards.
  const query = queryParts.length > 0
    ? queryParts.join(' ')
    : location
      ? `${location.lat},${location.lng}`
      : card?.title || '';

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function MapAutoViewport({ positions, selectedEntry }) {
  const map = useMap();

  useEffect(() => {
    if (selectedEntry?.location) {
      map.flyTo([selectedEntry.location.lat, selectedEntry.location.lng], Math.max(map.getZoom(), 16), {
        animate: true,
        duration: 0.55,
      });
      return;
    }

    if (positions.length > 1) {
      map.fitBounds(positions, {
        padding: [42, 42],
        maxZoom: 15,
        animate: false,
      });
    } else if (positions.length === 1) {
      map.setView(positions[0], 15, { animate: false });
    }
  }, [map, positions, selectedEntry]);

  return null;
}

export default function DayMapModal({ date, label, zones, cardMap, onClose, titleOverride, subtitleOverride }) {
  const [copiedCardId, setCopiedCardId] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');

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

  const selectedEntry = cardsWithLocation.find(({ card }) => card.id === selectedCardId) || null;
  const positions = cardsWithLocation.map(({ location }) => [location.lat, location.lng]);
  const center = positions[0] || [35.6762, 139.6503];
  const tileUrl = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttribution = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSelectCard(card) {
    setSelectedCardId(card.id);
  }

  async function handleCopyTitle(card) {
    const text = stripEmoji(card?.title || '');
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedCardId(card.id);
      window.setTimeout(() => setCopiedCardId((current) => (current === card.id ? '' : current)), 1400);
    } catch {
      window.prompt('複製景點名稱', text);
    }
  }

  function renderMapActions(card, compact = false) {
    return (
      <div className={`map-card-actions ${compact ? 'compact' : ''}`}>
        <a
          className="map-card-action"
          href={buildGoogleMapsUrl(card)}
          target="_blank"
          rel="noreferrer"
          title="用 Google Maps 搜尋這個景點"
          onClick={(e) => e.stopPropagation()}
        >
          Google Maps
        </a>
        <button
          className="map-card-action"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCopyTitle(card);
          }}
          title="複製景點標題"
        >
          {copiedCardId === card.id ? '已複製' : '複製標題'}
        </button>
      </div>
    );
  }

  return (
    <div className="modal-overlay map-modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-card map-modal-card">
        <div className="modal-header map-modal-header">
          <div>
            <h2>{titleOverride || `🗺️ ${formatDay(date)} 地圖`}</h2>
            <p className="map-modal-subtitle">{subtitleOverride || `${label || '今日行程'} · ${cardsWithLocation.length} 個已定位景點`}</p>
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
              scrollWheelZoom
            >
              <TileLayer attribution={tileAttribution} url={tileUrl} />
              <MapAutoViewport positions={positions} selectedEntry={selectedEntry} />
              {cardsWithLocation.map(({ card, zone, order, location }) => {
                const isActive = selectedCardId === card.id;
                return (
                  <Marker
                    key={card.id}
                    position={[location.lat, location.lng]}
                    icon={createNumberIcon(order, isActive)}
                    zIndexOffset={isActive ? 1000 : 0}
                    eventHandlers={{ click: () => handleSelectCard(card) }}
                  >
                    <Popup>
                      <div className="map-popup">
                        <strong>{order + 1}. {card.title}</strong>
                        {card.subtitle && <span>{card.subtitle}</span>}
                        <small>{ZONE_LABELS[zone]} · {card.area || '未填區域'}</small>
                        {card.location?.placeName && <small>📍 {card.location.placeName}</small>}
                        {card.location?.address && <small>{card.location.address}</small>}
                        {renderMapActions(card)}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
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
                const isActive = selectedCardId === card.id;
                return (
                  <button
                    key={`${card.id}-${index}`}
                    className={`map-list-item ${location ? 'has-location' : 'missing-location'} ${isActive ? 'active' : ''}`}
                    type="button"
                    onClick={() => handleSelectCard(card)}
                    disabled={!location}
                  >
                    <span className="map-list-number">{index + 1}</span>
                    <div className="map-list-content">
                      <strong>{card.title}</strong>
                      <small>{ZONE_LABELS[zone]} · {card.area || '未填區域'} {location ? '· 已定位' : '· 尚未定位'}</small>
                      {renderMapActions(card, true)}
                    </div>
                  </button>
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
