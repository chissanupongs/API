# Case Management System – Manual & README

> **Version:** June 27 2025

---

## 📚 Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Directory Structure](#directory-structure)
4. [First‑Time Setup](#first-time-setup)

   * 4.1 [Server `.env`](#server-env)
   * 4.2 [Client `.env`](#client-env)
5. [Running the Project](#running-the-project)
6. [API Reference](#api-reference)
7. [Common Error Messages & Fixes](#common-error-messages--fixes)
8. [Troubleshooting Checklist](#troubleshooting-checklist)
9. [Extending & Customising](#extending--customising)

---

## 1  Introduction <a id="introduction"></a>

This repository contains a **full‑stack incident & user‑management tool** consisting of:

* **Server** (Express API + Apollo GraphQL client)
* **Client** (Vite + React 18 + Tailwind CSS + React‑Toastify)

Key features:

* Authenticate staff by email (header `user_email`).
* Batch update *Alert Status* & *Case Result* via `alert_id`.
* Append immutable JSON history for every change.
* Unlock disabled user accounts.
* Real‑time UI with auto‑logout after inactivity.

---

## 2  Architecture Overview <a id="architecture-overview"></a>

```text
root
│
├── server/            ← Express API (ESM)
│   ├── config/        ← Apollo + environment config
│   ├── middleware/    ← authMiddleware.js (email validation)
│   ├── routes/        ← auth, case, lookup, user
│   ├── graphql/       ← queries.js & mutation.js
│   ├── utils/         ← history.js (appendHistory)
│   └── data/          ← history‑*.json files
│
└── client/            ← React (front‑end)
    ├── src/
    │   ├── CaseForm.jsx   ← Main UI component (uses alert_id)
    │   └── ...
    └── vite.config.js
```

The **backend** connects to your existing GraphQL endpoint (e.g. *OpenCTI*). The **frontend** communicates only with the Express API, never directly with GraphQL.

---

## 3  Directory Structure <a id="directory-structure"></a>

A condensed view of important files:

| Path                                  | Purpose                                                              |
| ------------------------------------- | -------------------------------------------------------------------- |
| `server/config/apollo.config.js`      | Reads `GRAPHQL_ENDPOINT` & `TOKEN` into Apollo client.               |
| `server/middleware/authMiddleware.js` | Validates `user_email`, enriches `req.user`, normalises IP.          |
| `server/routes/auth.routes.js`        | `POST /login` – verifies user exists.                                |
| `server/routes/case.routes.js`        | Update alert status & case result, fetch history.                    |
| `server/routes/lookup.routes.js`      | Batch lookup incidents & users.                                      |
| `server/routes/user.routes.js`        | Unlock user accounts.                                                |
| `server/utils/history.js`             | `appendHistory(type, payload, actor)` writes to rotating JSON files. |
| `client/src/CaseForm.jsx`             | Main dashboard, fully synchronised with latest API.                  |

---

## 4  First‑Time Setup <a id="first-time-setup"></a>

### 4.1  Server `.env` <a id="server-env"></a>

Create `server/.env` (copy `.env.example` if present):

```bash
# GraphQL
PORT=4000
HOST=0.0.0.0
DISPLAY_HOST=0.0.0.0
GRAPHQL_ENDPOINT=http://0.0.0.0:0000/graphql
TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXX

**Notes**

* `GRAPHQL_ENDPOINT` **must** be reachable from the server container.
* `TOKEN` is the *user‑token* generated in OpenCTI (or your GraphQL backend).

### 4.2  Client `.env` <a id="client-env"></a>

Create `client/.env`:

```bash
# Express API base
VITE_API_BASE_URL=http://localhost:4000
# Auto‑logout (minutes)
VITE_IDLE_LOGOUT_MINUTES=10
```

---

## 5  Running the Project <a id="running-the-project"></a>

```bash
# 1. install deps
bun install   # or npm install 

# 2. start the server
cd server
bun .\index.js
# → http://localhost:4000

# 3. start the client
cd ../client
bun dev
# → http://localhost:5173 (default Vite port)
```

> **Tip:** Use `docker compose up --build` if you prefer containerised deploy; see `docker-compose.yml` (optional).

---

## 6  API Reference <a id="api-reference"></a>

> All requests **require** header `user_email: your.name@example.com` except `/login`.

| Method | Route                | Description                                        | Body (JSON)                                                                                            |
| ------ | -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `POST` | `/login`             | Verify that the email exists. Returns user object. | `{ "user_email": "..." }`                                                                              |
| `PUT`  | `/closedAlertStatus` | Batch close alerts.                                | `{ "incidents": [{ "alert_id": "ALERT123", "alert_status": "Closed" }] }`                              |
| `PUT`  | `/updateCaseResult`  | Batch set case result with reason.                 | `{ "incidents": [{ "alert_id": "ALERT123", "case_result": "TruePositives", "reason": "Verified." }] }` |
| `GET`  | `/history`           | Fetch merged history across all `history-*.json`.  | –                                                                                                      |
| `POST` | `/lookup/incidents`  | Resolve alert IDs → incident metadata.             | `{ "alert_ids": ["ALERT123", "ALERT456"] }`                                                            |
| `POST` | `/lookup/users`      | Resolve emails → user metadata.                    | `{ "user_emails": ["a@x", "b@y"] }`                                                                    |
| `PUT`  | `/accounts/unlock`   | Unlock user(s).                                    | `{ "users": [{ "user_email": "a@x" }] }`                                                               |

#### Sample Success Response – `/closedAlertStatus`

```json
{
  "results": [
    {
      "alert_id": "ALERT123",
      "updated": true,
      "alert_status": "Closed",
      "note": {
        "id": "note--...",
        "action": "Closed",
        "content": "Incident was Closed",
        "created_at": "2025-06-27T02:12:45.000Z"
      }
    }
  ]
}
```

---

## 7  Common Error Messages & Fixes <a id="common-error-messages--fixes"></a>

| HTTP Code | Message                                            | Meaning / Fix                                                                                            |
| --------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **400**   | `Missing or invalid 'user_email'`                  | Header not present or not a string. Add `user_email` header in request.                                  |
| **401**   | `Missing or invalid user_email in header`          | Same as above (caught earlier in middleware).                                                            |
| **403**   | `Unauthorized user_email` / `User email not found` | Email not in GraphQL list or `account_status` not allowed. Ensure the account exists & spelling correct. |
| **404**   | `No incident found for alert_id: ...`              | GraphQL returned zero results. Double‑check alert\_id.                                                   |
| **409**   | `Multiple incidents found for alert_id: ...`       | Duplicate alert IDs in GraphQL; manual clean‑up required.                                                |
| **207**   | Mixed status (Multi‑Status)                        | Batch contained both successes & failures—inspect each entry.                                            |
| **500**   | `Failed to authenticate` / `Internal server error` | GraphQL unreachable, wrong TOKEN, or unhandled exception—check server logs.                              |

*Frontend Toasts*

* `Incident lookup failed` → Network error or Express error above.
* `Reason required for case result` → User attempted to change case result without filling **Reason** field.

---

## 8  Troubleshooting Checklist <a id="troubleshooting-checklist"></a>

1. **Cannot login**  → Verify `server/.env` TOKEN & that the user exists in GraphQL.
2. **CORS issues**   → Add `VITE_API_BASE_URL` to `server/index.js` CORS whitelist or use proxy.
3. **OpenCTI 403**   → Token revoked; generate new API token.
4. **Docker → localhost**  → Use `host.docker.internal` when client runs outside the Docker network.
5. **History not written** → Check `server/data/` permissions; container user must have write access.

---

## 9  Extending & Customising <a id="extending--customising"></a>

### Add a new route

1. Create file in `server/routes/` (e.g. `stats.routes.js`).
2. Register it in `server/index.js`: `app.use("/stats", statsRoutes)`.
3. Implement GraphQL calls with `request({...})` and reuse `requireUserEmail` & `appendHistory`.

### Rotate history files

`utils/history.js` writes daily `history-YYYY-MM-DD.json`. Adjust the filename pattern or rotation interval in that helper.

### Change auto‑logout duration

Update `VITE_IDLE_LOGOUT_MINUTES` in `client/.env` **and restart Vite**.

---

Enjoy! 🎉
