import React from 'react';

export default function PlanSelector({ plans, activePlanId, onSwitch, onClone, onResetPlan }) {
  return (
    <div className="plan-selector">
      <div className="plan-selector-label">📋 方案：</div>
      <div className="plan-chip-list">
        {plans.map((plan) => (
          <button
            key={plan.id}
            className={`plan-chip ${plan.id === activePlanId ? 'active' : ''}`}
            onClick={() => onSwitch(plan.id)}
            type="button"
          >
            {plan.name}
          </button>
        ))}
      </div>

      <button className="btn btn-clone" onClick={onClone} title="複製當前方案">
        📑 Clone
      </button>
      <button className="btn btn-clone" onClick={onResetPlan} title="清空當前方案排程">
        🧹 清空
      </button>

      {plans.length > 1 && (
        <span className="plan-count">{plans.length} 個方案</span>
      )}
    </div>
  );
}
