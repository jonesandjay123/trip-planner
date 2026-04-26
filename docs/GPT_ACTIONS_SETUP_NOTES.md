# GPT Actions setup notes — Trip Planner Ops GPT

> Date: 2026-04-26

## Custom GPT link

Trip Planner Ops GPT:

<https://chatgpt.com/g/g-69ee212546d08191b1b36ff457ea3357-trip-planner-ops-gpt>

## GPT Builder result so far

Jones created a ChatGPT Custom GPT named Trip Planner Ops GPT and pasted `openapi/gpt-trip-planner-actions.yaml` into the GPT Builder Actions editor.

Observed result:

- The OpenAPI schema can be parsed.
- GPT Builder shows one available action: `gptTripPlannerAction`.
- Method: `POST`.
- Path: `/gptTripPlannerAction`.

Current red validation message came from the placeholder server URL:

```text
None of the provided servers is under the root origin <https://region-project.cloudfunctions.net>
Server URL <https://REGION-PROJECT.cloudfunctions.net> is not under the root origin <https://region-project.cloudfunctions.net>; ignoring it
```

Root cause: the placeholder used uppercase `REGION-PROJECT`. GPT Builder appears to normalize or compare against the lowercase root origin and rejects the uppercase placeholder as not being under the same root origin.

## Server URL rule for Firebase Functions v2

Do not invent or commit a fake production endpoint. Replace the placeholder only after the HTTPS function is actually deployed.

There are two valid OpenAPI shapes, depending on which URL is copied from Firebase / Cloud Run.

### Option A: Firebase Functions base origin

Use this shape if the deployed endpoint is addressed as a Firebase Functions base origin plus the function path:

```yaml
servers:
  - url: https://<region>-<project-id>.cloudfunctions.net
paths:
  /gptTripPlannerAction:
    post:
      operationId: gptTripPlannerAction
```

In this shape, keep `paths./gptTripPlannerAction` because the server URL is only the origin/base.

### Option B: complete function URL

Use this shape if Firebase / Cloud Run gives a complete function URL that already includes or routes directly to `gptTripPlannerAction`:

```yaml
servers:
  - url: https://<complete-deployed-function-url>
paths:
  /:
    post:
      operationId: gptTripPlannerAction
```

In this shape, change the OpenAPI path to `/` because the server URL already points at the function itself.

## ChatGPT Actions auth shape

The current schema uses HTTP Bearer auth:

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
```

and the operation declares:

```yaml
security:
  - bearerAuth: []
```

This is appropriate for a ChatGPT Actions API-key style setup where GPT Builder is configured to send:

```http
Authorization: Bearer <GPT_ACTIONS_API_KEY>
```

Implementation notes:

- Use a dedicated Firebase Functions secret named `GPT_ACTIONS_API_KEY`.
- Do not reuse `JARVIS_SHARED_SECRET`.
- Do not commit the key.
- Compare bearer tokens server-side with timing-safe comparison.

## Operation ID

`operationId: gptTripPlannerAction` is suitable for ChatGPT Actions. It is stable, simple, and matches the action GPT Builder already surfaced.

## Next implementation steps

1. Deploy a new HTTPS `gptTripPlannerAction` function.
2. Set `GPT_ACTIONS_API_KEY` in Firebase Functions secrets.
3. Start with read-only dispatch only:
   - `inspectTrip`
   - `inspectDay`
4. Test the deployed endpoint with `curl` using `Authorization: Bearer ...`.
5. Replace `servers.url` with the real deployed URL.
6. Re-import or refresh the schema in GPT Builder.
7. Test in ChatGPT: “幫我看 5/2 下午有什麼？”
8. Only after read-only flow works, consider enabling low-risk mutations such as `addCandidateCard`.

## Safety boundary for first endpoint stub

The first `gptTripPlannerAction` code stub should not perform mutations. It should only prepare dispatch for `inspectTrip` and `inspectDay`, and return explicit `ACTION_NOT_ENABLED` errors for mutation actions until intentionally enabled later.

## 2026-04-26 read-only MVP implementation

Implemented `gptTripPlannerAction` as a read-only Custom GPT gateway:

- Auth uses dedicated Firebase Functions secret `GPT_ACTIONS_API_KEY` via `Authorization: Bearer <key>`.
- Enabled actions: `inspectTrip`, `inspectDay`.
- Disabled actions return `ACTION_NOT_ENABLED`, including `addCandidateCard`, `appendCommentToCard`, `moveCardToSlot`, `renameDayLabel`, `createBackup`, reset, restore, delete, repair, bulk import, and full-document overwrite style actions.
- `inspectTrip` uses Firestore `trips/main.tripMeta.activePlanId` when `planId` is omitted.
- `inspectDay` uses the same active-plan fallback and accepts short dates such as `5/2` by matching against the active plan's `dayOrder`.
- Each authenticated action writes a compact audit record to `tripPlannerActionLogs/{logId}` rather than growing `trips/main`.

Validated locally:

```bash
npm --prefix functions run lint -- --fix=false
npm run build
```

Deployment status:

Deployed successfully on 2026-04-26 after granting the deploy account `roles/cloudfunctions.admin` and setting the HTTPS function invoker to public. The function itself still enforces `Authorization: Bearer <GPT_ACTIONS_API_KEY>` before reading Firestore.

Endpoint:

```text
https://us-central1-trip-planner-ab5a9.cloudfunctions.net/gptTripPlannerAction
```

Verification passed:

- `inspectTrip` returned HTTP 200, active plan `plan_1777054282117`, trip `Tokyo Trip 2026`, 3 plans, 83 cards.
- `inspectDay` with `date: "5/2"`, `zone: "afternoon"` returned HTTP 200, normalized date `2026-05-02`, label `🥩 肉屋橫町＋秋葉原`, 10 afternoon cards.
- `addCandidateCard` returned HTTP 400 with `ACTION_NOT_ENABLED`.

## 2026-04-26 full planner ops unlock

Enabled private ops actions for Jones's travel-use Custom GPT:

- `inspectTrip`
- `inspectDay`
- `inspectCard`
- `addCandidateCard`
- `appendCommentToCard`
- `moveCardToSlot`
- `renameDayLabel`
- `createBackup`

Safety boundaries retained:

- Requires `Authorization: Bearer <GPT_ACTIONS_API_KEY>`.
- No arbitrary Firestore path/collection/document writes.
- No bulk import, repair from unknown source, reset, restore, delete, or silent full-document overwrite through GPT Actions.
- Mutations write compact audit logs to `tripPlannerActionLogs/{logId}`.
- Missing required fields return explicit errors.
- `planId` defaults to `trips/main.tripMeta.activePlanId` when omitted.
- Short dates such as `5/2` and `5-2` are matched against the selected plan days.
- Server generates new card ids for `addCandidateCard`; client-provided card ids are ignored for creation.

Verification passed after deploy:

- `inspectTrip`: HTTP 200.
- `inspectDay` (`5/2`, `afternoon`): HTTP 200.
- `createBackup`: HTTP 200, backup `backup_20260426-195112_before-full-ops-final-curl-test`.
- `addCandidateCard`: HTTP 200, smoke-test card created on Testing Board.
- `inspectCard`: HTTP 200 for the smoke-test card.
- `appendCommentToCard`: HTTP 200 for the smoke-test card.
- `moveCardToSlot`: HTTP 200, smoke-test card moved to Testing Board 2026-05-07 evening.
- `renameDayLabel`: HTTP 200; Testing Board 2026-05-07 label was restored to blank afterward via Jarvis ops cleanup.
- `bulkImport`: HTTP 400 `ACTION_NOT_ENABLED`.
- no API key: HTTP 401 `UNAUTHORIZED`.

Cleanup note: smoke-test cards were removed from schedule placements after testing. Existing `jarvisDeleteCandidateCard` removes placements/cardOrder but does not fully delete nested `cards.{id}` because it merges the parent `cards` map; the orphan smoke-test card records remain in the candidate pool and can be cleaned in a later maintenance fix if desired.

## 2026-04-26 extra practical ops

Added the three high-leverage travel ops actions after real GPT Builder testing:

- `updateCandidateCard`: updates only whitelisted fields (`title`, `subtitle`, `area`, `duration`, `note`, `zone`, `tags`, `location`) and never changes card id or overwrites arbitrary metadata.
- `searchCards` / `findCards`: searches by `query`, `missingLocation`, `unscheduledOnly`, `tags`, `area`, `date`, `zone`, and `limit`.
- `removeCardFromSlot`: removes a card placement from one plan/date/zone while keeping the card in the candidate pool.

Verification passed after deploy:

- `addCandidateCard`: HTTP 200, created smoke-test card on Testing Board.
- `updateCandidateCard`: HTTP 200, updated subtitle/note/tags/location only.
- `searchCards`: HTTP 200 for query and missing-location filters.
- `removeCardFromSlot`: HTTP 200, removed the smoke-test placement while card remained inspectable with no placements.
- `deleteCandidateCard`: HTTP 400 `INVALID_ACTION`.
- no API key: HTTP 401 `UNAUTHORIZED`.

## 2026-04-26 batch move convenience action

Added `moveCardsToSlot` so the Custom GPT can apply an already-decided day optimization with fewer tool calls.

Safety shape:

- Requires explicit `cardIds: string[]`.
- Does not accept fuzzy queries for batch moves.
- Moves cards within one selected/default plan to one target `date` / `zone`.
- Does not delete cards or perform arbitrary writes.
- Writes normal `tripPlannerActionLogs` audit entries.

Verification passed after deploy:

- Created two smoke-test cards on Testing Board 2026-05-06 flexible.
- `moveCardsToSlot` moved both to Testing Board 2026-05-06 evening in one call.
- `inspectDay` confirmed both cards in the evening slot.
- Calling `moveCardsToSlot` without `cardIds` returned HTTP 400 `MISSING_CARD_IDS`.
- `bulkOverwrite` remained blocked with `ACTION_NOT_ENABLED`.
