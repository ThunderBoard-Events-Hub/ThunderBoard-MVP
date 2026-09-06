import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/database.js";
import { mockAuth0, bearer } from "./helpers/testAuth.js";

const adminSub = `auth0|admin-${randomUUID()}`;

before(() => {
    mockAuth0();
    process.env.ADMIN_AUTH0_IDS = adminSub;
});

test("GET /api/admin/me requires an Authorization header", async () => {
    const res = await request(app).get("/api/admin/me");
    assert.equal(res.status, 401);
});

test("GET /api/admin/me returns isAdmin: false for a non-admin caller, not a 403", async () => {
    const res = await request(app).get("/api/admin/me").set("Authorization", bearer(`auth0|${randomUUID()}`));
    assert.equal(res.status, 200);
    assert.equal(res.body.isAdmin, false);
});

test("GET /api/admin/me returns isAdmin: true for an admin caller", async () => {
    const res = await request(app).get("/api/admin/me").set("Authorization", bearer(adminSub));
    assert.equal(res.status, 200);
    assert.equal(res.body.isAdmin, true);
});

after(async () => {
    await pool.end();
});
