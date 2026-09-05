import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/database.js";
import { mockAuth0, bearer } from "./helpers/testAuth.js";
import { runEventExpirySweep } from "../src/services/eventLifecycleService.js";

const toDateStr = (d) => d.toISOString().slice(0, 10);
const DAY = 24 * 60 * 60 * 1000;
const twoDaysAgo = toDateStr(new Date(Date.now() - 2 * DAY));
const tomorrow = toDateStr(new Date(Date.now() + DAY));

const orgSub = `auth0|${randomUUID()}`;
const adminSub = `auth0|admin-${randomUUID()}`;
let organizerId;
let pastWithEndTimeId;
let pastNoEndTimeId;
let futureEventId;
let pastDraftId;

before(async () => {
    mockAuth0();
    process.env.ADMIN_AUTH0_IDS = adminSub;

    const orgRes = await request(app).post("/api/organizations").set("Authorization", bearer(orgSub)).send({
        name: `Lifecycle Test Org ${randomUUID()}`,
        email: `lifecycle-test-org-${randomUUID()}@example.com`,
    });
    organizerId = orgRes.body.id;
    await request(app).post(`/api/organizations/${organizerId}/approve`).set("Authorization", bearer(adminSub));

    const create = (body) =>
        request(app).post("/api/events").set("Authorization", bearer(orgSub)).send(body).then((r) => r.body.id);

    pastWithEndTimeId = await create({
        title: "Past event with end_time",
        start_date: twoDaysAgo,
        end_time: "10:00:00",
    });
    pastNoEndTimeId = await create({
        title: "Past event with no end_time",
        start_date: twoDaysAgo,
    });
    futureEventId = await create({
        title: "Future event",
        start_date: tomorrow,
    });
    pastDraftId = await create({
        title: "Past draft event",
        start_date: twoDaysAgo,
        end_time: "10:00:00",
        status: "draft",
    });
});

test("runEventExpirySweep expires a published event whose start_date + end_time has passed", async () => {
    const expiredIds = await runEventExpirySweep();
    assert.ok(expiredIds.includes(pastWithEndTimeId));

    const res = await request(app).get(`/api/events/${pastWithEndTimeId}`);
    assert.equal(res.body.status, "expired");
});

test("runEventExpirySweep expires a published event with no end_time once its start_date has fully passed", async () => {
    const res = await request(app).get(`/api/events/${pastNoEndTimeId}`);
    assert.equal(res.body.status, "expired");
});

test("runEventExpirySweep leaves a future published event alone", async () => {
    const res = await request(app).get(`/api/events/${futureEventId}`);
    assert.equal(res.body.status, "published");
});

test("runEventExpirySweep does not touch a draft event, even one that's overdue", async () => {
    const res = await request(app).get(`/api/events/${pastDraftId}`);
    assert.equal(res.body.status, "draft");
});

test("runEventExpirySweep is idempotent — a second run doesn't re-flag already-expired events", async () => {
    const expiredIds = await runEventExpirySweep();
    assert.ok(!expiredIds.includes(pastWithEndTimeId));
    assert.ok(!expiredIds.includes(pastNoEndTimeId));
});

after(async () => {
    // The events -> organizations FK isn't reliably ON DELETE CASCADE in every
    // environment (see backend/migrations comments) — delete events explicitly
    // rather than relying on cascade.
    for (const id of [pastWithEndTimeId, pastNoEndTimeId, futureEventId, pastDraftId]) {
        await request(app).delete(`/api/events/${id}`).set("Authorization", bearer(orgSub));
    }
    await request(app).delete(`/api/organizations/${organizerId}`).set("Authorization", bearer(orgSub));
    await pool.end();
});
