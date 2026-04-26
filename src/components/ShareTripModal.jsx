import React, { useState } from 'react';

const TRIP_URL = 'https://trip-planner-ab5a9.web.app/';
const QR_URL = '/qr/trip-planner.png';

export default function ShareTripModal({ onClose }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(TRIP_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      window.prompt('複製 Trip Planner 連結', TRIP_URL);
    }
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay share-modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-card share-modal-card">
        <div className="modal-header share-modal-header">
          <div>
            <h2>📱 分享 Trip Planner</h2>
            <p className="share-modal-subtitle">掃描 QR code 或複製連結，快速在手機或朋友裝置開啟。</p>
          </div>
          <button className="map-modal-close" onClick={onClose} aria-label="關閉分享視窗">
            ✕
          </button>
        </div>

        <div className="share-modal-body">
          <div className="share-qr-frame">
            <img src={QR_URL} alt="Trip Planner QR Code" className="share-qr-image" />
          </div>
          <code className="share-url">{TRIP_URL}</code>
          <div className="share-actions">
            <button className="btn btn-export" onClick={copyLink}>
              {copied ? '✅ 已複製' : '📋 複製連結'}
            </button>
            <a className="btn btn-clone share-open-link" href={TRIP_URL} target="_blank" rel="noreferrer">
              🔗 開啟
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TRIP_URL };
