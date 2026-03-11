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
          <h2>{isNew ? '➕ 新增景點' : '✏️ 編輯景點'}</h2>
        </div>

        <div className="modal-body">
          <label className="modal-field">
            <span className="modal-label">標題 *</span>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="景點名稱"
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
