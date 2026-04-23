import React, { useState } from 'react';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_NAMES[d.getDay()];
  return `${m}/${day} (${dow})`;
}

export default function Header({
  tripName,
  startDate,
  endDate,
  onTripNameChange,
  onExport,
  onReset,
  darkMode,
  onToggleDark,
  planSelector,
  authLoading,
  user,
  isOwner,
  onLogin,
  onLogout,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tripName);

  function handleDoubleClick() {
    setDraft(tripName);
    setEditing(true);
  }

  function handleBlur() {
    setEditing(false);
    if (draft.trim()) {
      onTripNameChange(draft.trim());
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setDraft(tripName);
      setEditing(false);
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-title-row">
          <span className="header-icon">✈️</span>
          {editing ? (
            <input
              className="trip-name-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <h1 className="trip-name" onDoubleClick={handleDoubleClick} title="雙擊編輯">
              {tripName}
            </h1>
          )}
        </div>
        <div className="header-date-row">
          <span className="date-range">
            {formatDate(startDate)} → {formatDate(endDate)}
          </span>
          <div className="header-actions">
            <button className="theme-toggle" onClick={onToggleDark} title={darkMode ? '切換淺色模式' : '切換深色模式'}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button className="btn btn-export" onClick={onExport}>
              📋 匯出
            </button>
            <button className="btn btn-reset" onClick={onReset}>
              🔄 重置
            </button>
          </div>
        </div>
        <div className="header-bottom-row">
          {planSelector}
          <div className="header-auth-status">
            {authLoading ? (
              <>
                <span className="auth-email">正在確認登入狀態...</span>
                <span className="auth-mode viewer">Checking</span>
              </>
            ) : user ? (
              <>
                <span className="auth-email">{user.email || 'unknown user'}</span>
                <span className={`auth-mode ${isOwner ? 'owner' : 'viewer'}`}>{isOwner ? 'Owner mode' : 'View only mode'}</span>
                <button className="btn btn-auth" onClick={onLogout}>登出</button>
              </>
            ) : (
              <>
                <span className="auth-email">未登入</span>
                <span className="auth-mode viewer">View only mode</span>
                <button className="btn btn-auth" onClick={onLogin}>Google 登入</button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
