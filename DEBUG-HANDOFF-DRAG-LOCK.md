# Debug Handoff — Cards cannot be dragged / CUD appears locked

Date: 2026-04-24
Repo: `jonesandjay123/trip-planner`
Local path on Jarvis machine: `~/Downloads/code/trip-planner`
Related ops repo: `~/Downloads/code/jarvis-firebase-ops`
Firebase project: `trip-planner-ab5a9`
Main Firestore doc: `trips/main`

## Short version

The Trip Planner UI loads and Google login/logout works, but cards cannot be dragged. Jones also observed CUD actions feel locked/non-functional. This happens both on deployed Hosting and when running locally after pulling latest code.

Important: Jones confirmed drag/drop worked earlier today during mobile UI testing. Later, after a Firestore recovery/backup sequence, cards stopped being draggable. Jones also checked out an older commit from ~6 hours earlier and still could not drag locally, which suggests the issue is not a simple code regression in the latest commit.

Several hypotheses were tested and are either unlikely or still unproven. The next debugging pass should avoid repeating them blindly and should instrument the actual drag/auth runtime path.

## Current symptom

- App renders normally.
- Google login and logout UI work normally.
- Cards are visible.
- Cards cannot be dragged.
- Jones says local dev also cannot drag, not only deployed Firebase Hosting.
- Latest attempted fix `f95ed31` did not solve it.

## Context / timeline

### Earlier today

- Trip Planner had working drag/drop while Jones and Jarvis were adjusting mobile UI and button layout.
- Jones remembers successfully dragging cards.

### Later incident

- Jones manually deleted some cards, forgetting cards are shared by the real plans.
- This caused Default and Jarvis Suggest plans to lose many card references.
- Jarvis restored the trip data from recovery/session-derived snapshot.
- After restore, Firestore `trips/main` regained:
  - `cardCount`: 72
  - `planCount`: 3
  - `Default`: 45 scheduled cards
  - `Jarvis Suggest`: 72 scheduled cards
  - `test`: 0 scheduled cards
- A Firestore backup baseline was created:
  - `trips/backup_20260424-211218_pre-map-feature-firestore-test`
- A later safety backup was also created before metadata investigation:
  - `trips/backup_20260424-213755_before-owner-metadata-fix`

### Backup / restore implementation notes

- Backup docs are stored under the same Firestore collection:
  - `trips/main` = live app data
  - `trips/backup_*` = Jarvis/manual backups, not loaded by the app frontend
- Restore callable writes the backup `trip` payload over `trips/main` and adds audit metadata.
- Restore / Jarvis operations wrote metadata like:
  - `updatedByEmail: "jarvis@local"`
  - `updatedByUid: "jarvis-shared-secret"`
- Jones suspected this metadata might make the app treat the document as not owned by `jonesandjay123@gmail.com`.

## Important facts already checked

### Firestore rules are probably not the issue

Jones checked Firebase Console directly. Current rules are still:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Jones also said the rules were last updated yesterday, and drag worked earlier today. So do **not** start by redeploying rules unless new evidence appears.

These rules do **not** check `updatedByEmail`, `actorEmail`, or owner email. Under these rules, `jarvis@local` metadata should not block writes as long as Firebase Auth is non-null.

### Live Firestore main document shape was inspected and looked normal

Jarvis inspected `trips/main` directly via Firestore REST read. Findings:

- Top-level keys include:
  - `_version`
  - `activityLog`
  - `cardOrder`
  - `cards`
  - `planOrder`
  - `plans`
  - `tripMeta`
- `_version`: `7`
- `cards`: object, 72 entries
- `cardOrder`: array, 72 ids
- `plans`: object, 3 plans
- `planOrder`: `['default', 'plan_1777054282117', 'plan_1777055367645']`
- Each plan has normal `dayOrder` arrays.
- Each plan day has normal zone arrays:
  - `morning`
  - `afternoon`
  - `evening`
  - `flexible`
- Missing card refs from plans: `0`
- Non-string card refs: none observed
- Duplicate refs: no obvious blocker reported

So the main data shape does **not** look obviously broken for dnd-kit.

## Failed / inconclusive fixes already pushed

These commits were made while investigating. They may be harmless, but did not solve the reported issue.

### `6eb0065 fix: show signed-in editor state`

Changed signed-in non-owner label from `Viewer` to `Editor`, because the UI previously showed `Viewer` for any signed-in user who was not the configured owner email.

Also updated login handler to set React `user` immediately after `signInWithGoogle()` resolves.

Result: Jones deployed; issue persisted.

### `5f626e2 fix: use current Firebase auth user for edit gate`

Changed edit gate from only React state `user` to:

```js
const signedInUser = user || auth.currentUser;
const isOwner = Boolean(signedInUser?.email && signedInUser.email.toLowerCase() === ownerEmail.toLowerCase());
const canEdit = Boolean(signedInUser);
```

Header receives `signedInUser`.

Rationale: all CUD/drag handlers gate on `canEdit`; maybe Auth SDK had a user but React state missed it.

Result: Jones pulled and ran locally; issue persisted.

### `f95ed31 fix: register card drag handle activator`

In `src/components/Card.jsx`, custom drag handle received dnd-kit `attributes/listeners` but did not set activator node ref.

Changed:

```js
const {
  attributes,
  listeners,
  setNodeRef,
  setActivatorNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id: card.id });

return children({
  shellProps: { ref: setNodeRef, style, className: 'sortable-card-shell' },
  dragHandleProps: { ref: setActivatorNodeRef, ...attributes, ...listeners },
});
```

Result: Jones tested; still no drag.

## Key code paths to inspect

### DnD setup

File: `src/App.jsx`

Imports:

```js
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
```

Sensors currently:

```js
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  useSensor(KeyboardSensor)
);
```

DndContext:

```jsx
<DndContext
  sensors={sensors}
  collisionDetection={pointerWithin}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
>
```

### Shared edit gate

File: `src/App.jsx`

The common gate is currently:

```js
const signedInUser = user || auth.currentUser;
const canEdit = Boolean(signedInUser);
```

DnD handlers still early-return if `!canEdit`:

```js
function handleDragStart(event) {
  if (!canEdit) return;
  setActiveId(event.active.id);
  setDragging(true);
}

function handleDragOver(event) {
  if (!canEdit) return;
  ...
}

function handleDragEnd(event) {
  if (!canEdit) {
    setActiveId(null);
    setDragging(false);
    return;
  }
  ...
}
```

Most CUD actions also go through `requireEditable()`.

### Card sortable setup

File: `src/components/Card.jsx`

`SortableCardShell` wraps each card using `useSortable({ id: card.id })`. The drag handle button receives `dragHandleProps`.

Search for:

```js
function SortableCardShell({ card, children })
```

### Drop targets / sortable contexts

Files:

- `src/components/DropZone.jsx`
- `src/components/CandidatePool.jsx`

`DropZone` creates container ids like:

```js
const containerId = `${date}::${zone}`;
```

`CandidatePool` droppable id is:

```js
'unscheduled'
```

### Firestore sync interaction with drag

File: `src/hooks/useFirestore.js`

This hook has a drag pause mechanism:

```js
const dragging = useRef(false);
const pendingWrite = useRef(false);
...
const setDragging = useCallback((isDragging) => {
  dragging.current = isDragging;
  if (!isDragging && pendingWrite.current) {
    ... flush latest localStorage state to Firestore ...
  }
}, []);
```

`App.jsx` calls `setDragging(true)` on drag start and `setDragging(false)` on drag end.

This probably affects persistence, not drag start itself, but should be kept in mind.

## Strong next debugging recommendation

Do not guess another fix first. Add temporary instrumentation and reproduce locally.

Add a small debug panel or console logs showing:

- `authLoading`
- `Boolean(user)`
- `user?.email`
- `Boolean(auth.currentUser)`
- `auth.currentUser?.email`
- `canEdit`
- active pointer / drag events

Instrument these handlers:

```js
function handleDragStart(event) {
  console.log('[dnd] start', {
    activeId: event.active?.id,
    canEdit,
    userEmail: user?.email,
    authEmail: auth.currentUser?.email,
  });
  ...
}

function handleDragOver(event) {
  console.log('[dnd] over', {
    activeId: event.active?.id,
    overId: event.over?.id,
    canEdit,
  });
  ...
}

function handleDragEnd(event) {
  console.log('[dnd] end', {
    activeId: event.active?.id,
    overId: event.over?.id,
    canEdit,
  });
  ...
}
```

Also log inside `SortableCardShell` or on the drag handle pointer down:

```jsx
<button
  onPointerDownCapture={(e) => console.log('[dnd] handle pointerdown', card.id, e.pointerType)}
  ...
/>
```

This will answer the key question:

1. Does pointerdown happen on the drag handle?
2. Does dnd-kit fire `onDragStart`?
3. If `onDragStart` fires, is it returning early because `canEdit=false`?
4. If drag start fires and `canEdit=true`, is `over` missing because collision/droppables are not registered?

## Possible next fixes depending on debug result

### If pointerdown does not log

Likely DOM/CSS overlay or event interception issue.

Inspect CSS around:

- `.card`
- `.sortable-card-shell`
- `.card-drag-handle`
- `.pool-cards .card::after`
- mobile media query around `.pool-cards .card::after`
- any `pointer-events: none` / overlays / z-index

Current relevant CSS includes:

```css
.card {
  user-select: none;
  touch-action: pan-y;
}

.sortable-card-shell {
  touch-action: pan-y;
}

.card-drag-handle {
  cursor: grab;
  touch-action: none;
}
```

### If pointerdown logs but `onDragStart` does not

Likely dnd-kit sensor / activator issue.

Try simplifying sensors temporarily:

```js
const sensors = useSensors(
  useSensor(PointerSensor)
);
```

Or remove activation constraints:

```js
useSensor(PointerSensor)
```

Also try dragging from the whole card instead of a custom handle, by passing listeners/attributes to the sortable shell/card temporarily.

### If `onDragStart` logs but `canEdit=false`

Auth/edit gate is still false. Then continue auth instrumentation, not dnd-kit.

Check whether the UI says logged in but Firebase SDK has `auth.currentUser === null`.

### If `onDragStart` logs and `canEdit=true`, but no movement / no over

Investigate droppable registration and collision detection.

Try changing collision detection:

```js
import { closestCenter } from '@dnd-kit/core';
...
collisionDetection={closestCenter}
```

or temporarily remove custom `pointerWithin`.

Inspect `DropZone.jsx` / `CandidatePool.jsx` `useDroppable` refs and `SortableContext items`.

### If drag works but does not persist

Then issue is in `handleDragEnd`, `setItemsInPlan`, `updateActivePlan`, or `useFirestore` write path. Different problem from current symptom.

## Dependencies / versions

From current package-lock:

- `@dnd-kit/core`: `6.3.1`
- `@dnd-kit/sortable`: `8.0.0`
- `@dnd-kit/utilities`: `3.2.2`
- `firebase`: `12.10.0`
- React: `18.3.1`

Note: `package.json` allows `@dnd-kit/core: ^6.1.0`, but lockfile currently has 6.3.1. Earlier working state may have had the same version after `npm audit fix`; verify if needed.

## Current commits of interest

Recent trip-planner commits:

```text
f95ed31 fix: register card drag handle activator   # did not fix
5f626e2 fix: use current Firebase auth user for edit gate   # did not fix
6eb0065 fix: show signed-in editor state   # did not fix
ccd1e0b functions: trim backup helpers and docs
2858068 functions: avoid backup list composite index
718d135 functions: add Jarvis trip backups
ceae39e fix: simplify plan rename button
ded85ee fix: restore plan rename and clear actions
1a9168c docs: document mobile UX and future trip model
68033b9 chore: run npm audit fix
2fba11a fix: replace global reset with active plan delete
5b0efeb feat: compact mobile header menu
d5fddb9 feat: add mobile day paging and candidate panel
```

Jones says checking out a commit from ~6 hours earlier still could not drag, so do not assume `f95ed31/5f626e2/6eb0065` introduced the bug.

## Related work not directly part of drag bug

Map feature discussion is paused until drag/CUD is fixed.

Map MVP plan remains:

- Leaflet + OpenStreetMap tile
- optional `card.location`
- Card modal manual lat/lng/address
- Day map modal
- no Google Maps / Mapbox first
- no large Firestore migration

Research report exists at:

```text
https://github.com/jonesandjay123/thinking_with_ai/tree/main/projects/trip-planner-map-api-research
```

## What not to waste time on first

- Do not redeploy Firestore rules as the first move; Jones already checked rules and they are permissive.
- Do not assume `jarvis@local` metadata blocks writes under current rules; no rule checks that field.
- Do not assume `trips/main` is structurally broken without new evidence; direct inspection found normal shape and zero missing card refs.
- Do not keep making blind fixes without instrumenting drag/auth runtime.

## Recommended immediate next command flow

```bash
cd ~/Downloads/code/trip-planner
git pull
npm install
npm run dev
```

Then add temporary debug logs / debug badge as described above and reproduce locally in browser devtools.

If this is handed to ChatGPT or a new agent session, ask it to focus on:

1. Why dnd-kit `onDragStart` is not resulting in visible dragging.
2. Whether `canEdit` is false at drag time.
3. Whether pointer events reach `.card-drag-handle`.
4. Whether droppable containers are registered and collision detection returns `over`.
