import React from 'react';

export default function PlanSelector({ plans, activePlanId, onSwitch, onClone, onResetPlan }) {
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
