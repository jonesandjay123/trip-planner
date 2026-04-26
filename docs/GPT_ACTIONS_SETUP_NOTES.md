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

Deployment note: `GPT_ACTIONS_API_KEY` was created in Firebase Secret Manager, but the first deploy attempt failed while granting the Cloud Functions service account access to that secret because the current Firebase CLI account lacked `secretmanager.secrets.setIamPolicy`. Grant `roles/secretmanager.secretAccessor` on `GPT_ACTIONS_API_KEY` to `715210543670-compute@developer.gserviceaccount.com` (or temporarily grant the deployer enough Secret Manager IAM to let Firebase CLI do it), then run:

```bash
npx -y firebase-tools@latest deploy --project trip-planner-ab5a9 --only functions:gptTripPlannerAction --non-interactive
```
