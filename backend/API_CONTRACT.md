# ThunderBoard API

REST contract for the Organizations, Events, and Tags resources. Built on Express 5 + node-postgres against the schema in `backend/migrations` — share this with anyone wiring up fetch calls on the frontend.

- **Base URL:** `http://localhost:8000/api`
- **Format:** `application/json`, except image uploads (see below)
- **Auth:** Auth0. An organization *is* an Auth0 user — log in with the Auth0 SPA SDK, request an access token for this API's audience, and send it as `Authorization: Bearer <token>` on every write request. A small fixed set of admin accounts (see [Auth](#auth)) can review organization signups and manage tags.
- **Contract version:** v0.7 — 2026-09-05

## Conventions

| | |
|---|---|
| **Requests** | JSON bodies for everything except uploads. Send `Content-Type: application/json` on every `POST`/`PUT` unless you're attaching an image. |
| **Image uploads** | `POST`/`PUT` on `organizations` and `events` also accept `multipart/form-data` with a single file field named `image` (max 5MB, image mimetypes only). Send the other fields as regular form fields in the same request. When a file is attached, it replaces any `image_url` sent alongside it. Files are stored in Azure Blob Storage; the response's `image_url` is a public blob URL, directly loadable with a plain `<img src="...">` — no auth or SAS token needed. |
| **Errors** | Every non-2xx response is `{ "error": "message" }` — no exceptions. |
| **Timestamps** | ISO 8601 with timezone, e.g. `2026-09-04T19:23:18.034Z`. |
| **IDs** | All resource ids are integers, serialized as JSON numbers. |

**Status codes used:** `200` OK · `201` Created · `204` No Content · `400` Bad request/validation · `401` Missing/invalid token · `403` Forbidden (no org profile yet, or not the owner) · `404` Not found · `409` Conflict (unique constraint) · `500` Server error

## Auth

Organizations no longer have their own password — Auth0 is the only way to authenticate as one.

## Clone or download the sample app for reference
Clone the sample application with the following command.

```bash
git clone -b quickstart/login https://github.com/auth0-samples/auth0-javascript-samples --depth 1 auth0-javascript-samples

cd auth0-javascript-samples
```

- **Domain:** `annhasna.ca.auth0.com`
- **Audience:** `https://thunderboard-api` — pass this as `authorizationParams: { audience: 'https://thunderboard-api' }` in `createAuth0Client` (or on `loginWithRedirect`/`getTokenSilently`). Without it, Auth0 issues an opaque token this backend can't verify — it has to be a JWT access token scoped to this audience.
- **Client ID:** see `/index.html` for the current one, or the Auth0 dashboard (Applications → your SPA app).
- **Reference implementation:** `auth0-poc/` in this repo is a minimal working SPA login flow (signup/login/logout/profile) against this same tenant — copy its `createAuth0Client` call and add the `audience` param above.

1. **Log in** via the Auth0 SPA SDK (`loginWithRedirect` / `getTokenSilently`) with the `audience` above, so you get back a JWT access token (not an opaque one).
2. **First time only — create your organization profile:** `POST /api/organizations` with the token attached. This links the Auth0 account (its `sub` claim) to a new organization row, in `pending` status. One Auth0 account → at most one organization; a second `POST` from the same account is a `409`.
3. **Wait for admin approval.** A human admin manually verifies the org is a real, UBC-affiliated club before it goes live (see [Organization approval](#organization-approval) below). Until then, the org can view/edit its own profile (`GET/PUT /api/organizations/me`... i.e. `GET /api/organizations/me` then `PUT /api/organizations/:id`) but **cannot create events**, and doesn't show up in any public listing.
4. **Once approved**, every write — `PUT`/`DELETE` on your own organization, and creating/editing/deleting your own events — needs `Authorization: Bearer <token>` from that same Auth0 account. `organizer_id` for events is *always* derived from the token, never from the request body — you cannot create or edit another organization's events.
5. All `GET` endpoints stay public — no token needed to browse orgs/events/tags.

| Endpoint | Auth required |
|---|---|
| `POST /api/organizations` | Bearer token (any authenticated Auth0 user without an existing org) |
| `GET /api/organizations/me` | Bearer token (any authenticated org, any approval status) |
| `PUT /api/organizations/:id`, `DELETE /api/organizations/:id` | Bearer token, must own `:id` (allowed at any approval status) |
| `POST /api/organizations/:id/follow`, `POST /api/organizations/:id/unfollow` | none |
| `GET /api/organizations/pending`, `POST /api/organizations/:id/approve`, `POST /api/organizations/:id/decline` | Bearer token, admin only |
| `POST /api/events`, and creating/editing/deleting an event's tags | Bearer token, must have an **approved** organization profile |
| `PUT /api/events/:id`, `DELETE /api/events/:id` | Bearer token, must own the event |
| `POST /api/tags`, `DELETE /api/tags/:id` | Bearer token, admin only |
| `GET /api/admin/me` | Bearer token (any authenticated account — answers `false`, not `403`, for a non-admin) |
| Everything else (all `GET`s except `/organizations/me`, `/organizations/pending`, `/admin/me`) | none |

**401** (missing/invalid/expired token) and **403** (valid token, wrong owner, no org profile yet, org not yet approved, or not an admin) both use the standard `{ "error": "message" }` shape.

### Organization approval

Organizations don't go live the moment they sign up — a human admin checks each one is a real, UBC-affiliated club first.

- **`approval_status`** is one of `pending` (default on signup) / `approved` / `rejected`. It's never shown on public endpoints (`GET /api/organizations`, `/search`, `/:id`) — those only ever return `approved` orgs, full stop; a pending or rejected org simply isn't in the list and 404s if looked up by id directly. The owning account can always see its own status via `GET /api/organizations/me`.
- **Admins** are identified by a fixed allowlist of Auth0 account ids (not a role visible anywhere in this API) — ask backend if you need to know who currently has admin access.
- `GET /api/admin/me` — for deciding whether to show admin-only UI (e.g. a nav link) after login. Unlike every other admin endpoint, it never `403`s: any authenticated caller gets back `{ "isAdmin": true }` or `{ "isAdmin": false }`. Only `401` (missing/invalid token) is an error case here.
- `GET /api/organizations/pending` lists every org awaiting a decision (includes `approval_status` in the response, unlike public listings).
- `POST /api/organizations/:id/approve` / `POST /api/organizations/:id/decline` — both **404** if `:id` doesn't exist or isn't currently `pending` (i.e. a decision already made can't be redone through this endpoint).
- A `rejected` org can still log in and see/edit its own profile via `/me`, but stays invisible publicly and still can't create events — there's currently no "resubmit for review" flow; a declined org would need a human to flip it back to `pending` at the DB level.

---

## Organizations

Base path: `/api/organizations`

Clubs and student orgs that host events (e.g. AMS clubs, faculty societies). Each organization is tied 1:1 to an Auth0 account.

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create an organization (requires auth, see [Auth](#auth)) |
| `GET` | `/` | List all **approved** organizations |
| `GET` | `/search?name=` | Search by name among **approved** organizations |
| `GET` | `/me` | The authenticated account's own org, any approval status |
| `GET` | `/pending` | Admin only — orgs awaiting review |
| `GET` | `/:id` | Get one organization (**approved** only) |
| `PUT` | `/:id` | Update name / description / image_url |
| `POST` | `/:id/follow` | Increment follower count by 1 |
| `POST` | `/:id/unfollow` | Decrement follower count by 1 (floored at 0) |
| `POST` | `/:id/approve` | Admin only — approve a pending org |
| `POST` | `/:id/decline` | Admin only — decline a pending org |
| `DELETE` | `/:id` | Delete an organization |

### `POST /api/organizations`

Create a new organization for the authenticated Auth0 account. Requires `Authorization: Bearer <token>` (see [Auth](#auth)).

Request body:

```jsonc
{
  "name": "Engineering Undergraduate Society",
  "email": "eus@ubc.ca",
  "description": "Faculty society for Applied Science",  // optional
  "image_url": "https://.../eus-logo.png"                // optional
}
```

| Field | Notes |
|---|---|
| `name` | **required** · unique |
| `email` | **required** · unique · must look like a real email address (`x@y.z` shape — not verified as deliverable) |
| `description` | optional |
| `image_url` | optional · must be a valid `http(s)` URL if sent as a string · ignored if an `image` file is attached instead (see Conventions) |

**201 Created**
```json
{
  "id": 3,
  "name": "Engineering Undergraduate Society",
  "email": "eus@ubc.ca",
  "description": "Faculty society...",
  "image_url": null,
  "followers_count": 0,
  "created_at": "2026-09-04T19:58:13.615Z"
}
```

**400 / 401 / 409**
```json
{ "error": "name and email are required" }
{ "error": "email must be a valid email address" }
{ "error": "image_url must be a valid http(s) URL" }
{ "error": "An organization with that name or email already exists" }
{ "error": "An organization profile already exists for this account" }
```

The created org starts in `pending` — it won't appear in `GET /`, `/search`, or `GET /:id` until an admin approves it (see [Organization approval](#organization-approval)). Use `GET /api/organizations/me` to check on it in the meantime.

### `GET /api/organizations`

List every **approved** organization.

**200 OK**
```json
[
  { "id": 1, "name": "ThunderBoard", "email": "...", "followers_count": 0, "..." : "..." },
  { "id": 2, "name": "Fake AMS", "...": "..." }
]
```

### `GET /api/organizations/search?name=`

Case-insensitive partial match on `name` among **approved** organizations (used for the org search bar).

| Param | Notes |
|---|---|
| `name` | **required** |

**200 OK** → array of matching organizations
**400** → `{ "error": "Query param 'name' is required" }`

### `GET /api/organizations/me`

The authenticated account's own organization, **regardless of `approval_status`** — the one place that field is ever returned. Use this to tell "no org yet" (404, so show the signup form) apart from "pending"/"rejected"/"approved" (200, so show the right status banner) without guessing from a `POST /` 409. Requires `Authorization: Bearer <token>`.

**200 OK**
```json
{ "id": 3, "name": "...", "email": "...", "description": null, "image_url": null, "followers_count": 0, "created_at": "...", "approval_status": "pending" }
```

**401** → `{ "error": "..." }` (missing/invalid token)
**404 Not Found** → `{ "error": "No organization profile exists for this account yet" }`

### `GET /api/organizations/pending`

Admin only. Every organization currently awaiting a decision, oldest first — includes `approval_status` (always `"pending"` here) unlike the public listings.

**200 OK** → array of organization objects
**401** → `{ "error": "..." }` (missing/invalid token)
**403** → `{ "error": "Admin access required" }`

### `GET /api/organizations/:id`

Fetch one **approved** organization by id.

**200 OK**
```json
{ "id": 1, "name": "ThunderBoard", "email": "...", "description": null, "image_url": null, "followers_count": 0, "created_at": "..." }
```

**404 Not Found** — also returned for a real id that exists but isn't approved yet
```json
{ "error": "Organization not found" }
```

### `PUT /api/organizations/:id`

Partial update — omitted fields are left unchanged. Cannot change `email` here. Requires `Authorization: Bearer <token>` from the account that owns this organization.

Request body (all optional):
```json
{ "name": "...", "description": "...", "image_url": "..." }
```

As with create, you may send an `image` file (multipart) instead of `image_url` — if sent as a string, `image_url` must be a valid `http(s)` URL.

**200 OK** → updated organization object
**400** → `{ "error": "image_url must be a valid http(s) URL" }`
**401** → `{ "error": "..." }` (missing/invalid token)
**403** → `{ "error": "You do not own this organization" }`
**404 / 409** → `{ "error": "Organization not found" }`

### `POST /api/organizations/:id/follow`

Increments `followers_count` by 1, atomically at the DB level. No request body. **Not idempotent** — calling it twice adds 2.

Following/unfollowing is guest-driven — there's no server-side record of *who* follows an org, only the aggregate count. The frontend is responsible for tracking which orgs a given browser has followed (e.g. in `localStorage`) and calling `follow`/`unfollow` accordingly.

**200 OK**
```json
{ "id": 1, "name": "ThunderBoard", "...": "...", "followers_count": 1 }
```

**404 Not Found**
```json
{ "error": "Organization not found" }
```

### `POST /api/organizations/:id/unfollow`

Decrements `followers_count` by 1, atomically at the DB level, floored at 0 (never goes negative). No request body. **Not idempotent** below the floor — calling it twice on a count of 1 leaves it at 0, not -1.

**200 OK**
```json
{ "id": 1, "name": "ThunderBoard", "...": "...", "followers_count": 0 }
```

**404 Not Found**
```json
{ "error": "Organization not found" }
```

### `POST /api/organizations/:id/approve`

Admin only. Marks a pending organization `approved`, making it visible on all public endpoints. No request body.

**200 OK** → the organization, including `approval_status: "approved"`
**401** → `{ "error": "..." }` (missing/invalid token)
**403** → `{ "error": "Admin access required" }`
**404 Not Found** → `{ "error": "Organization not found or not pending review" }` (also returned if `:id` was already approved/declined)

### `POST /api/organizations/:id/decline`

Admin only. Marks a pending organization `rejected`. No request body, no reason field. There's no undo endpoint — a declined org would need to be reset at the database level to go through review again.

**200 OK** → the organization, including `approval_status: "rejected"`
**401** → `{ "error": "..." }` (missing/invalid token)
**403** → `{ "error": "Admin access required" }`
**404 Not Found** → `{ "error": "Organization not found or not pending review" }`

### `DELETE /api/organizations/:id`

Deletes the organization. Cascades to its events (and their tag links) via the FK. Requires `Authorization: Bearer <token>` from the account that owns this organization.

**200 OK** → deleted organization object
**401** → `{ "error": "..." }` (missing/invalid token)
**403** → `{ "error": "You do not own this organization" }`
**404 Not Found** → `{ "error": "Organization not found" }`

---

## Events

Base path: `/api/events`

Events belong to one organizer and carry zero or more tags via the `event_tags` join table.

**Automatic expiry:** a backend job sweeps every 5 minutes and flips any `published` event to `expired` once it's over — `start_date + end_time` if `end_time` is set, otherwise the end of `start_date` itself (an event with no `end_time` is treated as lasting through the rest of that day). `draft` events are left alone; only `published` ever auto-expires. This means `status` can change on its own between requests — don't assume a `published` event you fetched a while ago still is.

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create an event under your organization |
| `GET` | `/` | List all events (by start_date) |
| `GET` | `/search?title=` | Search by title (partial, case-insensitive) |
| `GET` | `/tags?tag_ids=1,2` | Events matching *any* of the given tag ids |
| `GET` | `/organizer/:organizer_id` | Events belonging to one organizer |
| `GET` | `/:id` | Get one event |
| `PUT` | `/:id` | Update an event |
| `DELETE` | `/:id` | Delete an event |
| `GET` | `/:id/tags` | Tags attached to an event |
| `POST` | `/:id/tags` | Attach a tag to an event |
| `DELETE` | `/:id/tags/:tag_id` | Detach a tag from an event |

### `POST /api/events`

Create an event under the authenticated organization. Requires `Authorization: Bearer <token>` from an account that already has an **approved** organization profile (see [Auth](#auth)) — a pending or rejected org gets a `403` here even though it can already log in and edit its own profile.

Request body:
```jsonc
{
  "title": "Design Team Showcase",
  "description": "...",          // optional
  "start_date": "2026-09-20",
  "start_time": "11:00:00",      // optional, HH:MM:SS
  "end_time": "13:00:00",        // optional
  "location": "...",             // optional
  "image_url": "...",            // optional
  "status": "published"          // optional, defaults to "published"
}
```

| Field | Notes |
|---|---|
| `title` | **required** |
| `start_date` | **required** · `YYYY-MM-DD`, must be a real calendar date (`2026-02-30` is rejected, not silently rolled over to March) |
| `start_time`, `end_time` | optional · `HH:MM` or `HH:MM:SS`, 24-hour |
| `status` | optional · one of `draft` / `published` / `expired` (DB-enforced check constraint) · defaults to `published` |
| `image_url` | optional · must be a valid `http(s)` URL if sent as a string · ignored if an `image` file is attached instead (see Conventions) |

`organizer_id` is **not** a request field — it's always the organization tied to your token. Sending one in the body is silently ignored.

**201 Created** → created event object

**400 / 401 / 403**
```json
{ "error": "title and start_date are required" }
{ "error": "start_date must be a valid date in YYYY-MM-DD format" }
{ "error": "start_time must be a valid time in HH:MM or HH:MM:SS format" }
{ "error": "end_time must be a valid time in HH:MM or HH:MM:SS format" }
{ "error": "image_url must be a valid http(s) URL" }
{ "error": "status must be one of: draft, published, expired" }
{ "error": "No organization profile exists for this account yet" }
{ "error": "Your organization is awaiting admin approval" }
```

### `GET /api/events`

List every event, ordered by `start_date`.

**200 OK**
```json
[
  { "id": 1, "organizer_id": 2, "title": "Imagine Day 2026", "start_date": "2026-09-08", "status": "published", "...": "..." }
]
```

### `GET /api/events/search?title=`

Case-insensitive partial match on `title`.

| Param | Notes |
|---|---|
| `title` | **required** |

**200 OK** → array of matching events
**400** → `{ "error": "Query param 'title' is required" }`

### `GET /api/events/tags?tag_ids=1,2,3`

Events tagged with *any* of the given tag ids (OR match, deduplicated). For tag-filter chips on the discovery page.

| Param | Notes |
|---|---|
| `tag_ids` | **required** · comma-separated integers |

**200 OK** → array of matching events
**400** → `{ "error": "tag_ids must be a comma-separated list of numbers" }`

### `GET /api/events/organizer/:organizer_id`

All events hosted by one organization — for an org's public profile page.

**200 OK** → array of events (empty array if the organizer has none)

### `GET /api/events/:id`

Fetch one event by id.

**200 OK** → event object
**404 Not Found** → `{ "error": "Event not found" }`

### `PUT /api/events/:id`

Partial update. Omitted fields are unchanged; `updated_at` is set automatically. `organizer_id` cannot be changed here. Requires `Authorization: Bearer <token>` from the event's own organizer.

Request body (all optional):
```json
{ "title": "...", "description": "...", "start_date": "...", "start_time": "...", "end_time": "...", "location": "...", "image_url": "...", "status": "..." }
```

`status`, if included, must be one of `draft` / `published` / `expired` (DB-enforced check constraint). `start_date`/`start_time`/`end_time`/`image_url`, if included, follow the same format rules as `POST /api/events` above. As with create, you may send an `image` file (multipart) instead of `image_url`.

**200 OK** → updated event object
**400**
```json
{ "error": "start_date must be a valid date in YYYY-MM-DD format" }
{ "error": "start_time must be a valid time in HH:MM or HH:MM:SS format" }
{ "error": "end_time must be a valid time in HH:MM or HH:MM:SS format" }
{ "error": "image_url must be a valid http(s) URL" }
{ "error": "status must be one of: draft, published, expired" }
```
**401** → `{ "error": "..." }` (missing/invalid token)
**403** → `{ "error": "You do not own this event" }`
**404 Not Found** → `{ "error": "Event not found" }`

### `DELETE /api/events/:id`

Deletes the event and its `event_tags` rows (cascade). Requires `Authorization: Bearer <token>` from the event's own organizer.

**200 OK** → deleted event object
**401** → `{ "error": "..." }` (missing/invalid token)
**403** → `{ "error": "You do not own this event" }`
**404 Not Found** → `{ "error": "Event not found" }`

### `GET /api/events/:id/tags`

Tags currently attached to this event.

**200 OK**
```json
[ { "id": 1, "name": "Engineering" }, { "id": 5, "name": "Socials" } ]
```

### `POST /api/events/:id/tags`

Attach a tag to an event. Idempotent — attaching the same tag twice is a no-op. Requires `Authorization: Bearer <token>` from the event's own organizer.

Request body:
```json
{ "tag_id": 5 }
```

**204 No Content**

**400**
```json
{ "error": "tag_id is required" }
{ "error": "event or tag does not exist" }
```
**401** → `{ "error": "..." }` (missing/invalid token)
**403** → `{ "error": "You do not own this event" }`

### `DELETE /api/events/:id/tags/:tag_id`

Detach a tag from an event. Requires `Authorization: Bearer <token>` from the event's own organizer.

**204 No Content**
**401** → `{ "error": "..." }` (missing/invalid token)
**403** → `{ "error": "You do not own this event" }`

---

## Tags

Base path: `/api/tags`

Flat, org-independent tag vocabulary (e.g. `Engineering`, `Socials`) attached to events via `event_tags`. The vocabulary itself is curated by admins only — an organization can attach/detach *existing* tags to its own events (see `POST/DELETE /api/events/:id/tags` above) but can't create or delete tags.

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Admin only — create a tag |
| `GET` | `/` | List all tags |
| `GET` | `/:id` | Get one tag |
| `DELETE` | `/:id` | Admin only — delete a tag |

### `POST /api/tags`

Admin only. Create a tag. Requires `Authorization: Bearer <token>` from an admin account.

Request body:
```json
{ "name": "Networking" }
```

**201 Created**
```json
{ "id": 6, "name": "Networking" }
```

**400 / 401 / 403 / 409**
```json
{ "error": "name is required" }
{ "error": "Admin access required" }
{ "error": "A tag with that name already exists" }
```

### `GET /api/tags`

List every tag — use this to populate a tag-filter UI.

**200 OK**
```json
[
  { "id": 1, "name": "Engineering" },
  { "id": 2, "name": "Science" },
  { "id": 3, "name": "Arts" }
]
```

### `GET /api/tags/:id`

Fetch one tag by id.

**200 OK**
```json
{ "id": 1, "name": "Engineering" }
```

**404 Not Found**
```json
{ "error": "Tag not found" }
```

### `DELETE /api/tags/:id`

Admin only. Deletes the tag and its `event_tags` links (cascade). Does not delete events. Requires `Authorization: Bearer <token>` from an admin account.

**200 OK** → deleted tag object
**401** → `{ "error": "..." }` (missing/invalid token)
**403** → `{ "error": "Admin access required" }`
**404 Not Found** → `{ "error": "Tag not found" }`

---

## Admin

Base path: `/api/admin`

Not tied to organizations — a home for admin-only utilities that aren't about a specific org or event. Today, just the one "am I an admin" check.

| Method | Path | Description |
|---|---|---|
| `GET` | `/me` | Whether the authenticated account is an admin |

### `GET /api/admin/me`

For deciding whether to show admin-only UI after login (e.g. a nav link to an admin panel). Requires `Authorization: Bearer <token>` — but unlike `/pending`, `/:id/approve`, `/:id/decline`, and the tag-mutation endpoints, a non-admin caller still gets a normal `200`, not a `403`. The only error case is a missing/invalid token.

**200 OK**
```json
{ "isAdmin": true }
```
```json
{ "isAdmin": false }
```

**401** → `{ "error": "..." }` (missing/invalid token)

---

*ThunderBoard backend · Express 5 + node-postgres · Questions → #thunderboard-backend*
