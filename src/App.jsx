import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import seedCards from './data/cards.json';
import { useLocalStorage } from './hooks/useLocalStorage';
import Header from './components/Header';
import DayColumn from './components/DayColumn';
import CandidatePool from './components/CandidatePool';
import Card from './components/Card';
import CardModal from './components/CardModal';
import PlanSelector from './components/PlanSelector';

const STATE_VERSION = 6; // v6: unscheduled computed, not stored

function generateDays(startDate, endDate) {
  const days = {};
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    days[key] = { morning: [], afternoon: [], evening: [], flexible: [] };
  }
  return days;
}

function createInitialState() {
  const defaultDays = generateDays('2026-05-01', '2026-05-07');
  const defaultDayOrder = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'];
  return {
    _version: STATE_VERSION,

    // --- Trip metadata (→ Firestore: trips/{tripId} document) ---
    tripMeta: {
      id: 'tokyo-may-2026',
      title: 'Tokyo May 2026',
      startDate: '2026-05-01',
      endDate: '2026-05-07',
      activePlanId: 'default',
    },

    // --- Cards (→ Firestore: trips/{tripId}/cards/{cardId}) ---
    cards: Object.fromEntries(seedCards.map((c) => [c.id, { ...c, comments: [] }])),

    // --- Plans keyed by ID (→ Firestore: trips/{tripId}/plans/{planId}) ---
    plans: {
      default: {
        id: 'default',
        name: 'Default',
        dayOrder: defaultDayOrder,
        days: defaultDays,
      },
    },

    // --- Plan display order (→ Firestore: trips/{tripId}.planOrder) ---
    planOrder: ['default'],
  };
}

// ==================== Selectors ====================

function getActivePlan(state) {
  const id = state.tripMeta.activePlanId;
  return state.plans[id] || state.plans[state.planOrder[0]];
}

function getPlanDays(plan) {
  return plan?.days || {};
}

function getPlanDayOrder(plan) {
  return plan?.dayOrder || Object.keys(getPlanDays(plan)).sort();
}

// ==================== App ====================

export default function App() {
  const [state, setState, resetState] = useLocalStorage(createInitialState());
  const [activeId, setActiveId] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('trip-planner-dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('trip-planner-dark', darkMode);
  }, [darkMode]);

  const [modalCard, setModalCard] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isNewCard, setIsNewCard] = useState(false);

  const cardMap = state.cards || {};
  const activePlan = useMemo(() => getActivePlan(state), [state]);
  const activeDays = useMemo(() => getPlanDays(activePlan), [activePlan]);
  const activeDayOrder = useMemo(() => getPlanDayOrder(activePlan), [activePlan]);

  // Unscheduled = all cards − cards assigned in active plan (computed, not stored)
  const unscheduledCardIds = useMemo(() => {
    const assigned = new Set();
    Object.values(activeDays).forEach((zones) => {
      Object.values(zones).forEach((cards) => {
        cards.forEach((id) => assigned.add(id));
      });
    });
    return Object.keys(cardMap).filter((id) => !assigned.has(id));
  }, [cardMap, activeDays]);

  // ==================== Plan operations ====================

  function handleSwitchPlan(planId) {
    setState((prev) => ({
      ...prev,
      tripMeta: { ...prev.tripMeta, activePlanId: planId },
    }));
  }

  function handleClonePlan() {
    setState((prev) => {
      const source = getActivePlan(prev);
      const newId = `plan_${Date.now()}`;
      const cloned = {
        id: newId,
        name: `${source.name} (副本)`,
        dayOrder: [...source.dayOrder],
        days: JSON.parse(JSON.stringify(source.days)),
      };
      return {
        ...prev,
        plans: { ...prev.plans, [newId]: cloned },
        planOrder: [...prev.planOrder, newId],
        tripMeta: { ...prev.tripMeta, activePlanId: newId },
      };
    });
  }

  function handleRenamePlan(planId, newName) {
    if (!newName.trim()) return;
    setState((prev) => ({
      ...prev,
      plans: {
        ...prev.plans,
        [planId]: { ...prev.plans[planId], name: newName.trim() },
      },
    }));
  }

  function handleDeletePlan(planId) {
    setState((prev) => {
      if (prev.planOrder.length <= 1) return prev;
      const newPlanOrder = prev.planOrder.filter((id) => id !== planId);
      const { [planId]: removed, ...remainingPlans } = prev.plans;
      const newActive = prev.tripMeta.activePlanId === planId ? newPlanOrder[0] : prev.tripMeta.activePlanId;
      return {
        ...prev,
        plans: remainingPlans,
        planOrder: newPlanOrder,
        tripMeta: { ...prev.tripMeta, activePlanId: newActive },
      };
    });
  }

  function handleResetPlan() {
    if (!window.confirm('確定要清空當前方案的所有排程嗎？卡片會回到候選區。')) return;
    setState((prev) => {
      const plan = getActivePlan(prev);
      if (!plan) return prev;
      const emptyDays = generateDays(prev.tripMeta.startDate, prev.tripMeta.endDate);
      // No need to update unscheduledCardIds — it's computed from cards − assignments
      return {
        ...prev,
        plans: {
          ...prev.plans,
          [plan.id]: {
            ...plan,
            days: emptyDays,
            dayOrder: Object.keys(emptyDays).sort(),
          },
        },
      };
    });
  }

  // Helper: update active plan's data
  function updateActivePlan(updater) {
    setState((prev) => {
      const plan = getActivePlan(prev);
      const updated = updater(plan);
      return {
        ...prev,
        plans: { ...prev.plans, [plan.id]: updated },
      };
    });
  }

  // ==================== Drag & Drop ====================

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const cardLocations = useMemo(() => {
    const loc = {};
    unscheduledCardIds.forEach((id, idx) => {
      loc[id] = { containerId: 'unscheduled', index: idx };
    });
    Object.entries(activeDays).forEach(([date, zones]) => {
      Object.entries(zones).forEach(([zone, cards]) => {
        cards.forEach((id, idx) => {
          loc[id] = { containerId: `${date}::${zone}`, index: idx };
        });
      });
    });
    return loc;
  }, [unscheduledCardIds, activeDays]);

  const findContainer = useCallback(
    (id) => {
      if (id === 'unscheduled') return id;
      if (typeof id === 'string' && id.includes('::')) return id;
      return cardLocations[id]?.containerId || null;
    },
    [cardLocations]
  );

  const getContainerItems = useCallback(
    (containerId) => {
      if (containerId === 'unscheduled') return unscheduledCardIds;
      if (containerId && containerId.includes('::')) {
        const [date, zone] = containerId.split('::');
        return activeDays[date]?.[zone] || [];
      }
      return [];
    },
    [unscheduledCardIds, activeDays]
  );

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event) {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id);
    let overContainer = findContainer(over.id);
    if (!overContainer) overContainer = over.id;
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setState((prev) => {
      const plan = getActivePlan(prev);
      const activeItems = [...getItemsFromPlan(prev, plan, activeContainer)];
      const overItems = [...getItemsFromPlan(prev, plan, overContainer)];

      const activeIndex = activeItems.indexOf(active.id);
      const overIndex = overItems.indexOf(over.id);

      let newIndex;
      if (over.id === overContainer) {
        newIndex = overItems.length;
      } else {
        newIndex = overIndex >= 0 ? overIndex : overItems.length;
      }

      activeItems.splice(activeIndex, 1);
      overItems.splice(newIndex, 0, active.id);

      let next = setItemsInPlan(prev, plan, activeContainer, activeItems);
      const updatedPlan = next.plans[plan.id];
      next = setItemsInPlan(next, updatedPlan, overContainer, overItems);
      return next;
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeContainer = findContainer(active.id);
    let overContainer = findContainer(over.id);
    if (!overContainer) overContainer = over.id;
    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      const items = [...getContainerItems(activeContainer)];
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        if (activeContainer === 'unscheduled') {
          // Unscheduled is computed — reorder within pool is a no-op
          return;
        }
        const reordered = arrayMove(items, oldIndex, newIndex);
        const [date, zone] = activeContainer.split('::');
        updateActivePlan((plan) => ({
          ...plan,
          days: {
            ...plan.days,
            [date]: { ...plan.days[date], [zone]: reordered },
          },
        }));
      }
    }
  }

  // ==================== Card / Modal / Comment ====================

  function openEditModal(card) {
    setModalCard(card);
    setIsNewCard(false);
    setModalOpen(true);
  }

  function openNewCardModal() {
    setModalCard(null);
    setIsNewCard(true);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalCard(null);
    setIsNewCard(false);
  }

  function handleModalSave(updatedCard, isNew) {
    // Just add/update the card — if it's new, it'll auto-appear in unscheduled
    // because unscheduled = all cards − assigned cards (computed)
    setState((prev) => ({
      ...prev,
      cards: { ...prev.cards, [updatedCard.id]: updatedCard },
    }));
    closeModal();
  }

  function handleAddComment(cardId, text) {
    if (!text.trim()) return;
    const comment = {
      text: text.trim(),
      timestamp: new Date().toISOString(),
      author: 'Jones',
    };
    setState((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [cardId]: {
          ...prev.cards[cardId],
          comments: [...(prev.cards[cardId]?.comments || []), comment],
        },
      },
    }));
  }

  // ==================== Trip-level actions ====================

  function handleTripNameChange(name) {
    setState((prev) => ({
      ...prev,
      tripMeta: { ...prev.tripMeta, title: name },
    }));
  }

  function handleExport() {
    const exportData = {
      tripMeta: state.tripMeta,
      activePlan: activePlan?.name || 'Default',
      dayOrder: activeDayOrder,
      days: activeDays,
      cards: cardMap,
      unscheduledCardIds,
    };
    const json = JSON.stringify(exportData, null, 2);
    try {
      navigator.clipboard.writeText(json);
      alert(`已複製「${activePlan?.name}」方案到剪貼簿！`);
    } catch {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'trip-plan.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function handleReset() {
    if (window.confirm('確定要重置所有資料嗎？')) {
      resetState(createInitialState());
    }
  }

  function handleSwapDay(date, direction) {
    updateActivePlan((plan) => {
      const order = getPlanDayOrder(plan);
      const idx = order.indexOf(date);
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= order.length) return plan;
      const newOrder = [...order];
      [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
      return { ...plan, dayOrder: newOrder };
    });
  }

  // ==================== Render ====================

  const activeCard = activeId ? cardMap[activeId] : null;

  // Convert plans object to array for PlanSelector
  const plansArray = useMemo(
    () => (state.planOrder || []).map((id) => state.plans[id]).filter(Boolean),
    [state.plans, state.planOrder]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="app">
        <Header
          tripName={state.tripMeta.title}
          startDate={state.tripMeta.startDate}
          endDate={state.tripMeta.endDate}
          onTripNameChange={handleTripNameChange}
          onExport={handleExport}
          onReset={handleReset}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode((v) => !v)}
          planSelector={
            <PlanSelector
              plans={plansArray}
              activePlanId={state.tripMeta.activePlanId}
              onSwitch={handleSwitchPlan}
              onClone={handleClonePlan}
              onRename={handleRenamePlan}
              onDelete={handleDeletePlan}
              onResetPlan={handleResetPlan}
            />
          }
        />

        <div className="days-container">
          {activeDayOrder.map((date, idx) => (
            <DayColumn
              key={date}
              date={date}
              zones={activeDays[date]}
              cardMap={cardMap}
              onSwap={handleSwapDay}
              isFirst={idx === 0}
              isLast={idx === activeDayOrder.length - 1}
              onEditCard={openEditModal}
              onAddComment={handleAddComment}
            />
          ))}
        </div>

        <CandidatePool
          cardIds={unscheduledCardIds}
          cardMap={cardMap}
          onAddNew={openNewCardModal}
          onEdit={openEditModal}
          onAddComment={handleAddComment}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard ? <Card card={activeCard} isDragOverlay /> : null}
      </DragOverlay>

      {modalOpen && (
        <CardModal
          card={modalCard}
          onSave={handleModalSave}
          onClose={closeModal}
        />
      )}
    </DndContext>
  );
}

// ==================== Pure helpers ====================

function getItemsFromPlan(state, plan, containerId) {
  if (containerId === 'unscheduled') {
    // Compute unscheduled on the fly for drag operations
    const assigned = new Set();
    Object.values(plan.days).forEach((zones) => {
      Object.values(zones).forEach((cards) => {
        cards.forEach((id) => assigned.add(id));
      });
    });
    return Object.keys(state.cards || {}).filter((id) => !assigned.has(id));
  }
  const [date, zone] = containerId.split('::');
  return plan.days[date]?.[zone] || [];
}

function setItemsInPlan(state, plan, containerId, items) {
  if (containerId === 'unscheduled') {
    // Unscheduled is computed — dragging FROM pool means removing from unscheduled,
    // which happens automatically when the card is added to a plan zone.
    // No state change needed for the unscheduled side.
    return state;
  }
  const [date, zone] = containerId.split('::');
  const updatedPlan = {
    ...plan,
    days: {
      ...plan.days,
      [date]: { ...plan.days[date], [zone]: items },
    },
  };
  return {
    ...state,
    plans: { ...state.plans, [plan.id]: updatedPlan },
  };
}
