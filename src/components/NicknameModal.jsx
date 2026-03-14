import React, { useState } from 'react';

export default function NicknameModal({ randomName, onConfirm }) {
  const [draft, setDraft] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onConfirm(draft.trim() || randomName);
  }

  return (
    <div className="modal-backdrop">
      <div className="nickname-modal">
        <h2>👋 歡迎！你的暱稱是？</h2>
        <form onSubmit={handleSubmit}>
          <input
            className="nickname-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={randomName}
            autoFocus
            maxLength={20}
          />
          <p className="nickname-hint">
            留空會自動取名為「{randomName}」
          </p>
          <button className="nickname-btn" type="submit">
            ✈️ 開始規劃！
          </button>
        </form>
      </div>
    </div>
  );
}
