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
  onDeleteActivePlan,
  canDeletePlan,
  activePlanName,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function runMobileAction(action) {
    action?.();
    closeMobileMenu();
  }

  return (
    <header className="header">
      <div className="header-main">
        <div className="header-title-block">
          <span className="header-icon">✈️</span>
          <div className="header-title-text">
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
            <span className="date-range mobile-inline-date">
              {formatDate(startDate)} → {formatDate(endDate)}
            </span>
          </div>
        </div>

        <span className="date-range desktop-date-range">
          {formatDate(startDate)} → {formatDate(endDate)}
        </span>

        <div className="header-actions desktop-header-actions">
          <button className="theme-toggle" onClick={onToggleDark} title={darkMode ? '切換淺色模式' : '切換深色模式'}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-export" onClick={onExport}>
            📋 匯出
          </button>
          <button
            className="btn btn-reset"
            onClick={onDeleteActivePlan}
            disabled={!canDeletePlan}
            title={canDeletePlan ? `刪除目前方案：${activePlanName || ''}` : '只剩一個方案，不能刪除'}
          >
            🗑️ 刪方案
          </button>
        </div>

        <div className="header-plan-row">
          {planSelector}
        </div>

        <div className="mobile-header-status">
          {authLoading ? (
            <span className="auth-mode viewer">Checking</span>
          ) : user ? (
            <span className={`auth-mode ${isOwner ? 'owner' : 'editor'}`}>{isOwner ? 'Owner' : 'Editor'}</span>
          ) : (
            <span className="auth-mode viewer">Viewer</span>
          )}
          <button className="mobile-menu-trigger" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="更多操作">
            ⋯
          </button>
        </div>
      </div>

      <div className="header-auth-status compact desktop-auth-status">
        {authLoading ? (
          <>
            <span className="auth-mode viewer">Checking</span>
          </>
        ) : user ? (
          <>
            <span className={`auth-mode ${isOwner ? 'owner' : 'editor'}`}>{isOwner ? 'Owner' : 'Editor'}</span>
            <span className="auth-email compact" title={user.email || 'unknown user'}>{user.email || 'unknown user'}</span>
            <button className="btn btn-auth compact" onClick={onLogout}>登出</button>
          </>
        ) : (
          <>
            <span className="auth-mode viewer">Viewer</span>
            <button className="btn btn-auth compact" onClick={onLogin}>登入</button>
          </>
        )}
      </div>

      {mobileMenuOpen && (
        <div className="mobile-header-menu">
          <button onClick={() => runMobileAction(onToggleDark)}>{darkMode ? '☀️ 淺色模式' : '🌙 深色模式'}</button>
          <button onClick={() => runMobileAction(onExport)}>📋 匯出行程</button>
          <button disabled={!canDeletePlan} onClick={() => runMobileAction(onDeleteActivePlan)}>
            🗑️ {canDeletePlan ? `刪除方案${activePlanName ? `：${activePlanName}` : ''}` : '只剩一個方案，不能刪除'}
          </button>
          {user ? (
            <button onClick={() => runMobileAction(onLogout)}>🚪 登出</button>
          ) : (
            <button onClick={() => runMobileAction(onLogin)}>🔐 登入</button>
          )}
        </div>
      )}
    </header>
  );
}
