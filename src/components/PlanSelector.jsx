import React, { useState, useRef, useEffect } from 'react';

export default function PlanSelector({ plans, activePlanId, onSwitch, onClone, onRename, onDelete }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const activePlan = plans.find((p) => p.id === activePlanId) || plans[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setEditingId(null);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  // Auto-focus rename input
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function handleStartRename(plan) {
    setEditingId(plan.id);
    setEditDraft(plan.name);
  }

  function handleFinishRename() {
    if (editingId && editDraft.trim()) {
      onRename(editingId, editDraft.trim());
    }
    setEditingId(null);
  }

  function handleRenameKeyDown(e) {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  }

  function handleSelect(planId) {
    onSwitch(planId);
    setDropdownOpen(false);
  }

  function handleDelete(e, planId) {
    e.stopPropagation();
    const plan = plans.find((p) => p.id === planId);
    if (window.confirm(`確定要刪除「${plan?.name}」嗎？`)) {
      onDelete(planId);
    }
  }

  return (
    <div className="plan-selector" ref={dropdownRef}>
      <div className="plan-selector-label">📋 方案：</div>
      <div className="plan-selector-dropdown">
        <button
          className="plan-selector-trigger"
          onClick={() => setDropdownOpen((v) => !v)}
        >
          <span className="plan-selector-name">{activePlan?.name || 'Default'}</span>
          <span className="plan-selector-arrow">{dropdownOpen ? '▲' : '▼'}</span>
        </button>

        {dropdownOpen && (
          <div className="plan-selector-menu">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`plan-selector-item ${plan.id === activePlanId ? 'active' : ''}`}
                onClick={() => handleSelect(plan.id)}
              >
                {editingId === plan.id ? (
                  <input
                    ref={inputRef}
                    className="plan-rename-input"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={handleRenameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="plan-item-name">{plan.name}</span>
                )}
                <div className="plan-item-actions">
                  <button
                    className="plan-item-btn"
                    title="重新命名"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(plan);
                    }}
                  >
                    ✏️
                  </button>
                  {plan.id !== 'default' && (
                    <button
                      className="plan-item-btn plan-item-delete"
                      title="刪除"
                      onClick={(e) => handleDelete(e, plan.id)}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-clone" onClick={onClone} title="複製當前方案">
        📑 Clone
      </button>

      {plans.length > 1 && (
        <span className="plan-count">{plans.length} 個方案</span>
      )}
    </div>
  );
}
