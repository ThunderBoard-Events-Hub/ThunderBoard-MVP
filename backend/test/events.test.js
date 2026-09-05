import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/database.js";
import { eventsContainerClient } from "../src/config/storage.js";
import { mockAuth0, bearer } from "./helpers/testAuth.js";

const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
);

const unique = randomUUID();
const orgSub = `auth0|${randomUUID()}`;
let organizerId;
let tagId;
let createdEventId;

// Deleting the organizer cascades to its events (and event_tags rows),
// so tests only need to clean up the tag and the organization itself.
// cascades mean that if you delete the organizer, all events associated with that organizer will also be deleted automatically, and any tags associated with those events will also be removed from the event_tags table. This ensures that there are no orphaned records left in the database after the tests run.
before(async () => {
    mockAuth0();

    const orgRes = await request(app).post("/api/organizations").set("Authorization", bearer(orgSub)).send({
        name: `Event Test Org ${unique}`,
        email: `event-test-org-${unique}@example.com`,
    });
    organizerId = orgRes.body.id;

    const tagRes = await request(app).post("/api/tags").send({ name: `Test Tag ${unique}` });
    tagId = tagRes.body.id;
});

test("POST /api/events requires an Authorization header", async () => {
    const res = await request(app).post("/api/events").send({ title: "Missing auth" });
    assert.equal(res.status, 401);
});

test("POST /api/events 403s for an account with no organization profile", async () => {
    const res = await request(app)
        .post("/api/events")
        .set("Authorization", bearer(`auth0|${randomUUID()}`))
        .send({ title: "Orphan event", start_date: "2026-10-01" });
    assert.equal(res.status, 403);
});

test("POST /api/events requires title and start_date", async () => {
    const res = await request(app)
        .post("/api/events")
        .set("Authorization", bearer(orgSub))
        .send({ title: "Missing fields" });
    assert.equal(res.status, 400);
});

test("POST /api/events rejects an invalid status", async () => {
    const res = await request(app).post("/api/events").set("Authorization", bearer(orgSub)).send({
        title: "Bad status event",
        start_date: "2026-10-01",
        status: "not_a_real_status",
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /draft, published, expired/);
});

test("POST /api/events creates an event under the authenticated organizer, defaulting to status 'published'", async () => {
    const res = await request(app).post("/api/events").set("Authorization", bearer(orgSub)).send({
        title: `Test Event ${unique}`,
        start_date: "2026-10-01",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "published");
    assert.equal(res.body.organizer_id, organizerId);
    createdEventId = res.body.id;
});

test("POST /api/events ignores a client-supplied organizer_id", async () => {
    const res = await request(app).post("/api/events").set("Authorization", bearer(orgSub)).send({
        organizer_id: 999999999,
        title: `Spoofed Organizer Event ${unique}`,
        start_date: "2026-10-01",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.organizer_id, organizerId);
    await request(app).delete(`/api/events/${res.body.id}`).set("Authorization", bearer(orgSub));
});

test("POST /api/events with an attached image uploads it to Azure and sets image_url", async () => {
    const res = await request(app)
        .post("/api/events")
        .set("Authorization", bearer(orgSub))
        .field("title", `Test Event With Image ${randomUUID()}`)
        .field("start_date", "2026-10-01")
        .attach("image", pngBuffer, { filename: "event.png", contentType: "image/png" });

    assert.equal(res.status, 201);
    assert.match(res.body.image_url, /event-images\/.*\.png$/);

    const blobName = res.body.image_url.split("/").pop();
    const exists = await eventsContainerClient.getBlockBlobClient(blobName).exists();
    assert.equal(exists, true);

    await request(app).delete(`/api/events/${res.body.id}`).set("Authorization", bearer(orgSub));
    await eventsContainerClient.deleteBlob(blobName);
});

test("PUT /api/events/:id with a new image deletes the old blob and keeps the new one", async () => {
    const created = await request(app)
        .post("/api/events")
        .set("Authorization", bearer(orgSub))
        .field("title", `Replace Image Event ${randomUUID()}`)
        .field("start_date", "2026-10-01")
        .attach("image", pngBuffer, { filename: "first.png", contentType: "image/png" });
    const firstBlobName = created.body.image_url.split("/").pop();

    const updated = await request(app)
        .put(`/api/events/${created.body.id}`)
        .set("Authorization", bearer(orgSub))
        .attach("image", pngBuffer, { filename: "second.png", contentType: "image/png" });
    const secondBlobName = updated.body.image_url.split("/").pop();

    assert.equal(updated.status, 200);
    assert.notEqual(secondBlobName, firstBlobName);
    assert.equal(await eventsContainerClient.getBlockBlobClient(firstBlobName).exists(), false);
    assert.equal(await eventsContainerClient.getBlockBlobClient(secondBlobName).exists(), true);

    await request(app).delete(`/api/events/${created.body.id}`).set("Authorization", bearer(orgSub));
    await eventsContainerClient.deleteBlob(secondBlobName);
});

test("PUT /api/events/:id without a new image leaves the existing image untouched", async () => {
    const created = await request(app)
        .post("/api/events")
        .set("Authorization", bearer(orgSub))
        .field("title", `Keep Image Event ${randomUUID()}`)
        .field("start_date", "2026-10-01")
        .attach("image", pngBuffer, { filename: "keep.png", contentType: "image/png" });
    const blobName = created.body.image_url.split("/").pop();

    const updated = await request(app)
        .put(`/api/events/${created.body.id}`)
        .set("Authorization", bearer(orgSub))
        .send({ location: "text-only update" });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.image_url, created.body.image_url);
    assert.equal(await eventsContainerClient.getBlockBlobClient(blobName).exists(), true);

    await request(app).delete(`/api/events/${created.body.id}`).set("Authorization", bearer(orgSub));
    await eventsContainerClient.deleteBlob(blobName);
});

test("GET /api/events includes the created event", async () => {
    const res = await request(app).get("/api/events");
    assert.equal(res.status, 200);
    assert.ok(res.body.some((e) => e.id === createdEventId));
});

test("GET /api/events/search?title= finds it by partial match", async () => {
    const res = await request(app).get("/api/events/search").query({ title: "Test Event" });
    assert.equal(res.status, 200);
    assert.ok(res.body.some((e) => e.id === createdEventId));
});

test("GET /api/events/organizer/:organizer_id returns only that organizer's events", async () => {
    const res = await request(app).get(`/api/events/organizer/${organizerId}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.every((e) => e.organizer_id === organizerId));
    assert.ok(res.body.some((e) => e.id === createdEventId));
});

test("GET /api/events/:id returns the event", async () => {
    const res = await request(app).get(`/api/events/${createdEventId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, createdEventId);
});

test("GET /api/events/:id 404s for a missing id", async () => {
    const res = await request(app).get("/api/events/999999999");
    assert.equal(res.status, 404);
});

test("PUT /api/events/:id requires an Authorization header", async () => {
    const res = await request(app).put(`/api/events/${createdEventId}`).send({ location: "Nest" });
    assert.equal(res.status, 401);
});

test("PUT /api/events/:id rejects a caller who doesn't own the event", async () => {
    const res = await request(app)
        .put(`/api/events/${createdEventId}`)
        .set("Authorization", bearer(`auth0|${randomUUID()}`))
        .send({ location: "Nest" });
    assert.equal(res.status, 403);
});

test("PUT /api/events/:id updates fields", async () => {
    const res = await request(app)
        .put(`/api/events/${createdEventId}`)
        .set("Authorization", bearer(orgSub))
        .send({ location: "Nest" });
    assert.equal(res.status, 200);
    assert.equal(res.body.location, "Nest");
    assert.ok(res.body.updated_at);
});

test("PUT /api/events/:id rejects an invalid status", async () => {
    const res = await request(app)
        .put(`/api/events/${createdEventId}`)
        .set("Authorization", bearer(orgSub))
        .send({ status: "nonsense" });
    assert.equal(res.status, 400);
});

test("POST /api/events/:id/tags attaches a tag", async () => {
    const res = await request(app)
        .post(`/api/events/${createdEventId}/tags`)
        .set("Authorization", bearer(orgSub))
        .send({ tag_id: tagId });
    assert.equal(res.status, 204);
});

test("POST /api/events/:id/tags is idempotent", async () => {
    const res = await request(app)
        .post(`/api/events/${createdEventId}/tags`)
        .set("Authorization", bearer(orgSub))
        .send({ tag_id: tagId });
    assert.equal(res.status, 204);
});

test("POST /api/events/:id/tags rejects a non-numeric tag_id", async () => {
    const res = await request(app)
        .post(`/api/events/${createdEventId}/tags`)
        .set("Authorization", bearer(orgSub))
        .send({ tag_id: "not_a_number" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /tag_id must be a number/);
});

test("GET /api/events/:id/tags returns the attached tag", async () => {
    const res = await request(app).get(`/api/events/${createdEventId}/tags`);
    assert.equal(res.status, 200);
    assert.ok(res.body.some((t) => t.id === tagId));
});

test("GET /api/events/tags?tag_ids= finds the event by tag", async () => {
    const res = await request(app).get("/api/events/tags").query({ tag_ids: String(tagId) });
    assert.equal(res.status, 200);
    assert.ok(res.body.some((e) => e.id === createdEventId));
});

test("GET /api/events/tags?tag_ids= rejects non-numeric ids", async () => {
    const res = await request(app).get("/api/events/tags").query({ tag_ids: "abc" });
    assert.equal(res.status, 400);
});

test("DELETE /api/events/:id/tags/:tag_id rejects a non-numeric tag_id", async () => {
    const res = await request(app)
        .delete(`/api/events/${createdEventId}/tags/not_a_number`)
        .set("Authorization", bearer(orgSub));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /tag_id must be a number/);
});

test("DELETE /api/events/:id/tags/:tag_id detaches the tag", async () => {
    const res = await request(app)
        .delete(`/api/events/${createdEventId}/tags/${tagId}`)
        .set("Authorization", bearer(orgSub));
    assert.equal(res.status, 204);

    const tags = await request(app).get(`/api/events/${createdEventId}/tags`);
    assert.equal(tags.body.some((t) => t.id === tagId), false);
});

test("DELETE /api/events/:id requires ownership", async () => {
    const res = await request(app)
        .delete(`/api/events/${createdEventId}`)
        .set("Authorization", bearer(`auth0|${randomUUID()}`));
    assert.equal(res.status, 403);
});

test("DELETE /api/events/:id deletes the event", async () => {
    const res = await request(app).delete(`/api/events/${createdEventId}`).set("Authorization", bearer(orgSub));
    assert.equal(res.status, 200);

    const after = await request(app).get(`/api/events/${createdEventId}`);
    assert.equal(after.status, 404);
});

after(async () => {
    await request(app).delete(`/api/tags/${tagId}`);
    await request(app).delete(`/api/organizations/${organizerId}`).set("Authorization", bearer(orgSub));
    await pool.end();
});
