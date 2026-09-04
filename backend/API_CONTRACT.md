# ThunderBoard API

REST contract for the Organizations, Events, and Tags resources. Built on Express 5 + node-postgres against the schema in `backend/migrations` — share this with anyone wiring up fetch calls on the frontend.

- **Base URL:** `http://localhost:8000/api`
- **Format:** `application/json`
- **Auth:** none yet
- **Contract version:** v0.1 — 2026-09-04

## Conventions

| | |
|---|---|
| **Requests** | JSON bodies only. Send `Content-Type: application/json` on every `POST`/`PUT`. |
| **Errors** | Every non-2xx response is `{ "error": "message" }` — no exceptions. |
| **Timestamps** | ISO 8601 with timezone, e.g. `2026-09-04T19:23:18.034Z`. |
| **IDs** | All resource ids are integers, serialized as JSON numbers. |

**Status codes used:** `200` OK · `201` Created · `204` No Content · `400` Bad request/validation · `404` Not found · `409` Conflict (unique constraint) · `500` Server error

> **Not implemented yet — don't build against these**
> - No auth/session layer. Every endpoint below is currently open.
> - `password_hash` sent to `POST /organizations` is stored as-is — hashing happens on the backend before this contract is final, not on the client. #backend-TODO: encryption

---

## Organizations

Base path: `/api/organizations`

Clubs and student orgs that host events (e.g. AMS clubs, faculty societies). `password_hash` is write-only — it is never present in a response.

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create an organization |
| `GET` | `/` | List all organizations |
| `GET` | `/search?name=` | Search by name (partial, case-insensitive) |
| `GET` | `/:id` | Get one organization |
| `PUT` | `/:id` | Update name / description / image_url |
| `POST` | `/:id/follow` | Increment follower count by 1 |
| `DELETE` | `/:id` | Delete an organization |

### `POST /api/organizations`

Create a new organization.

Request body:

```jsonc
{
  "name": "Engineering Undergraduate Society",
  "email": "eus@ubc.ca",
  "password_hash": "...",
  "description": "Faculty society for Applied Science",  // optional
  "image_url": "https://.../eus-logo.png"                // optional
}
```

| Field | Notes |
|---|---|
| `name` | **required** · unique |
| `email` | **required** · unique |
| `password_hash` | **required** |
| `description` | optional |
| `image_url` | optional |

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

**400 / 409**
```json
{ "error": "name, email and password_hash are required" }
{ "error": "An organization with that name or email already exists" }
```

### `GET /api/organizations`

List every organization.

**200 OK**
```json
[
  { "id": 1, "name": "ThunderBoard", "email": "...", "followers_count": 0, "..." : "..." },
  { "id": 2, "name": "Fake AMS", "...": "..." }
]
```

### `GET /api/organizations/search?name=`

Case-insensitive partial match on `name` (used for the org search bar).

| Param | Notes |
|---|---|
| `name` | **required** |

**200 OK** → array of matching organizations
**400** → `{ "error": "Query param 'name' is required" }`

### `GET /api/organizations/:id`

Fetch one organization by id.

**200 OK**
```json
{ "id": 1, "name": "ThunderBoard", "email": "...", "description": null, "image_url": null, "followers_count": 0, "created_at": "..." }
```

**404 Not Found**
```json
{ "error": "Organization not found" }
```

### `PUT /api/organizations/:id`

Partial update — omitted fields are left unchanged. Cannot change `email` here.

Request body (all optional):
```json
{ "name": "...", "description": "...", "image_url": "..." }
```

**200 OK** → updated organization object
**404 / 409** → `{ "error": "Organization not found" }`

### `POST /api/organizations/:id/follow`

Increments `followers_count` by 1, atomically at the DB level. No request body. **Not idempotent** — calling it twice adds 2.

**200 OK**
```json
{ "id": 1, "name": "ThunderBoard", "...": "...", "followers_count": 1 }
```

**404 Not Found**
```json
{ "error": "Organization not found" }
```

### `DELETE /api/organizations/:id`

Deletes the organization. Cascades to its events (and their tag links) via the FK.

**200 OK** → deleted organization object
**404 Not Found** → `{ "error": "Organization not found" }`

---

## Events

Base path: `/api/events`

Events belong to one organizer and carry zero or more tags via the `event_tags` join table.

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create an event |
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

Create an event under an organizer.

Request body:
```jsonc
{
  "organizer_id": 3,
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
| `organizer_id` | **required** · must reference an existing organization |
| `title` | **required** |
| `start_date` | **required** |
| `status` | optional · one of `draft` / `published` / `expired` (DB-enforced check constraint) · defaults to `published` |

**201 Created** → created event object

**400**
```json
{ "error": "organizer_id, title and start_date are required" }
{ "error": "organizer_id does not reference an existing organization" }
{ "error": "status must be one of: draft, published, expired" }
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

Partial update. Omitted fields are unchanged; `updated_at` is set automatically. `organizer_id` cannot be changed here.

Request body (all optional):
```json
{ "title": "...", "description": "...", "start_date": "...", "start_time": "...", "end_time": "...", "location": "...", "image_url": "...", "status": "..." }
```

`status`, if included, must be one of `draft` / `published` / `expired` (DB-enforced check constraint).

**200 OK** → updated event object
**400** → `{ "error": "status must be one of: draft, published, expired" }`
**404 Not Found** → `{ "error": "Event not found" }`

### `DELETE /api/events/:id`

Deletes the event and its `event_tags` rows (cascade).

**200 OK** → deleted event object
**404 Not Found** → `{ "error": "Event not found" }`

### `GET /api/events/:id/tags`

Tags currently attached to this event.

**200 OK**
```json
[ { "id": 1, "name": "Engineering" }, { "id": 5, "name": "Socials" } ]
```

### `POST /api/events/:id/tags`

Attach a tag to an event. Idempotent — attaching the same tag twice is a no-op.

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

### `DELETE /api/events/:id/tags/:tag_id`

Detach a tag from an event.

**204 No Content**

---

## Tags

Base path: `/api/tags`

Flat, org-independent tag vocabulary (e.g. `Engineering`, `Socials`) attached to events via `event_tags`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create a tag |
| `GET` | `/` | List all tags |
| `GET` | `/:id` | Get one tag |
| `DELETE` | `/:id` | Delete a tag |

### `POST /api/tags`

Create a tag.

Request body:
```json
{ "name": "Networking" }
```

**201 Created**
```json
{ "id": 6, "name": "Networking" }
```

**400 / 409**
```json
{ "error": "name is required" }
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

Deletes the tag and its `event_tags` links (cascade). Does not delete events.

**200 OK** → deleted tag object
**404 Not Found** → `{ "error": "Tag not found" }`

---

*ThunderBoard backend · Express 5 + node-postgres · Questions → #thunderboard-backend*
