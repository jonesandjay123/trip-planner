import React from 'react';

export default function PlanSelector({ plans, activePlanId, onSwitch, onClone, onDelete, canDeletePlan }) {
  return (
    <div className="plan-selector">
      <label className="plan-selector-label" htmlFor="plan-selector-native">📋 方案：</label>
      <select
        id="plan-selector-native"
        className="plan-selector-native"
        value={activePlanId || ''}
        onChange={(event) => onSwitch(event.target.value)}
        disabled={plans.length === 0}
      >
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>

      <button className="btn btn-clone" onClick={onClone} title="複製當前方案" aria-label="複製當前方案">
        <span className="desktop-action-text">📑 Clone</span>
        <span className="mobile-action-icon">📑</span>
      </button>
      <button
        className="btn btn-clone btn-delete-plan"
        onClick={() => onDelete?.(activePlanId)}
        disabled={!canDeletePlan}
        title={canDeletePlan ? '刪除目前方案' : '只剩一個方案，不能刪除'}
        aria-label="刪除目前方案"
      >
        <span className="desktop-action-text">🗑️ 刪方案</span>
        <span className="mobile-action-icon">🗑️</span>
      </button>

      {plans.length > 1 && (
        <span className="plan-count">{plans.length} 個方案</span>
      )}
    </div>
  );
}
