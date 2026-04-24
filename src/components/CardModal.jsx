import React, { useState, useEffect } from 'react';

const ZONE_OPTIONS = [
  { value: 'morning', label: '☀️ 早上佳' },
  { value: 'afternoon', label: '🌤️ 下午佳' },
  { value: 'evening', label: '🌙 晚上佳' },
  { value: 'flexible', label: '🔄 彈性' },
];

export default function CardModal({ card, onSave, onClose }) {
  const isNew = !card;

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    area: '',
    duration: '',
    zone: 'flexible',
    note: '',
    tags: '',
    placeName: '',
    address: '',
    lat: '',
    lng: '',
  });

  useEffect(() => {
    if (card) {
      setForm({
        title: card.title || '',
        subtitle: card.subtitle || '',
        area: card.area || '',
        duration: card.duration || '',
        zone: card.zone || 'flexible',
        note: card.note || '',
        tags: Array.isArray(card.tags) ? card.tags.join(', ') : '',
        placeName: card.location?.placeName || '',
        address: card.location?.address || '',
        lat: Number.isFinite(Number(card.location?.lat)) ? String(card.location.lat) : '',
        lng: Number.isFinite(Number(card.location?.lng)) ? String(card.location.lng) : '',
      });
    } else {
      setForm({
        title: '',
        subtitle: '',
        area: '',
        duration: '',
        zone: 'flexible',
        note: '',
        tags: '',
        placeName: '',
        address: '',
        lat: '',
        lng: '',
      });
    }
  }, [card]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSave() {
    if (!form.title.trim()) {
      alert('標題為必填欄位');
      return;
    }

    const latText = form.lat.trim();
    const lngText = form.lng.trim();
    const lat = latText === '' ? null : Number(latText);
    const lng = lngText === '' ? null : Number(lngText);

    if ((latText || lngText) && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
      alert('如果要填座標，latitude / longitude 都必須是有效數字。');
      return;
    }

    if (Number.isFinite(lat) && (lat < -90 || lat > 90)) {
      alert('Latitude 必須介於 -90 到 90。');
      return;
    }

    if (Number.isFinite(lng) && (lng < -180 || lng > 180)) {
      alert('Longitude 必須介於 -180 到 180。');
      return;
    }

    const location = Number.isFinite(lat) && Number.isFinite(lng)
      ? {
          ...(card?.location || {}),
          placeName: form.placeName.trim(),
          address: form.address.trim(),
          lat,
          lng,
          source: card?.location?.source || 'manual',
          updatedAt: new Date().toISOString(),
        }
      : undefined;

    const updatedCard = {
      ...(card || {}),
      id: card?.id || `custom_${Date.now()}`,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      area: form.area.trim(),
      duration: form.duration.trim(),
      zone: form.zone,
      note: form.note.trim(),
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      comments: card?.comments || [],
      source: card?.source || 'custom',
    };

    if (location) {
      updatedCard.location = location;
    } else if (card?.location) {
      delete updatedCard.location;
    }

    onSave(updatedCard, isNew);
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>{isNew ? '➕ 新增行程' : '✏️ 編輯行程'}</h2>
        </div>

        <div className="modal-body">
          <label className="modal-field">
            <span className="modal-label">標題 *</span>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="行程名稱"
              autoFocus
            />
          </label>

          <label className="modal-field">
            <span className="modal-label">副標題</span>
            <input
              type="text"
              name="subtitle"
              value={form.subtitle}
              onChange={handleChange}
              placeholder="英文名稱或別名"
            />
          </label>

          <label className="modal-field">
            <span className="modal-label">區域</span>
            <input
              type="text"
              name="area"
              value={form.area}
              onChange={handleChange}
              placeholder="例：Shibuya"
            />
          </label>

          <label className="modal-field">
            <span className="modal-label">時長</span>
            <input
              type="text"
              name="duration"
              value={form.duration}
              onChange={handleChange}
              placeholder="例：1-2 hr"
            />
          </label>

          <label className="modal-field">
            <span className="modal-label">建議時段</span>
            <select name="zone" value={form.zone} onChange={handleChange}>
              {ZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="modal-field">
            <span className="modal-label">備註</span>
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="任何備註..."
              rows={3}
            />
          </label>

          <label className="modal-field">
            <span className="modal-label">標籤</span>
            <input
              type="text"
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="逗號分隔，例：美食, 購物, 打卡"
            />
          </label>

          <div className="modal-section-title">📍 地圖座標（optional）</div>

          <label className="modal-field">
            <span className="modal-label">地點名稱</span>
            <input
              type="text"
              name="placeName"
              value={form.placeName}
              onChange={handleChange}
              placeholder="例：Senso-ji Temple"
            />
          </label>

          <label className="modal-field">
            <span className="modal-label">地址</span>
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="例：2 Chome-3-1 Asakusa, Taito City, Tokyo"
            />
          </label>

          <div className="modal-field-row">
            <label className="modal-field">
              <span className="modal-label">Latitude</span>
              <input
                type="number"
                name="lat"
                value={form.lat}
                onChange={handleChange}
                placeholder="35.7148"
                step="any"
              />
            </label>

            <label className="modal-field">
              <span className="modal-label">Longitude</span>
              <input
                type="number"
                name="lng"
                value={form.lng}
                onChange={handleChange}
                placeholder="139.7967"
                step="any"
              />
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn modal-btn-save" onClick={handleSave}>
            💾 儲存
          </button>
          <button className="btn modal-btn-cancel" onClick={onClose}>
            ❌ 取消
          </button>
        </div>
      </div>
    </div>
  );
}
