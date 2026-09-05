import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/database.js";

const unique = randomUUID();
const tagName = `Test Tag ${unique}`;
let createdId;

test("POST /api/tags requires a name", async () => {
    const res = await request(app).post("/api/tags").send({});
    assert.equal(res.status, 400);
});

test("POST /api/tags creates a tag", async () => {
    const res = await request(app).post("/api/tags").send({ name: tagName });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, tagName);
    createdId = res.body.id;
});

test("POST /api/tags rejects a duplicate name", async () => {
    const res = await request(app).post("/api/tags").send({ name: tagName });
    assert.equal(res.status, 409);
});

test("GET /api/tags includes the created tag", async () => {
    const res = await request(app).get("/api/tags");
    assert.equal(res.status, 200);
    assert.ok(res.body.some((t) => t.id === createdId));
});

test("GET /api/tags/:id returns the tag", async () => {
    const res = await request(app).get(`/api/tags/${createdId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.name, tagName);
});

test("GET /api/tags/:id 404s for a missing id", async () => {
    const res = await request(app).get("/api/tags/999999999");
    assert.equal(res.status, 404);
});

test("DELETE /api/tags/:id deletes the tag", async () => {
    const res = await request(app).delete(`/api/tags/${createdId}`);
    assert.equal(res.status, 200);

    const after = await request(app).get(`/api/tags/${createdId}`);
    assert.equal(after.status, 404);
});

after(async () => {
    await pool.end();
});
