import React from 'react';

export default function PlanSelector({ plans, activePlanId, onSwitch, onClone, onResetPlan }) {
  const activePlan = plans.find((p) => p.id === activePlanId) || plans[0];

  return (
    <div className="plan-selector">
      <div className="plan-selector-label">📋 方案：</div>
      <select
        className="plan-selector-native"
        value={activePlan?.id || ''}
        onChange={(e) => onSwitch(e.target.value)}
      >
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>

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
