import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/database.js";

test("allows requests from the configured dev frontend origin", async () => {
    const res = await request(app).get("/api/tags").set("Origin", "http://localhost:5173");
    assert.equal(res.status, 200);
    assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
});

test("blocks requests from an origin that isn't allow-listed", async () => {
    const res = await request(app).get("/api/tags").set("Origin", "http://evil.example.com");
    assert.equal(res.status, 403);
    assert.equal(res.body.error, "Not allowed by CORS");
    assert.equal(res.headers["access-control-allow-origin"], undefined);
});

test("allows requests with no Origin header (non-browser clients)", async () => {
    const res = await request(app).get("/api/tags");
    assert.equal(res.status, 200);
});

test("handles a CORS preflight request from an allowed origin", async () => {
    const res = await request(app)
        .options("/api/organizations")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "POST");
    assert.equal(res.status, 204);
    assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
});

test("blocks a CORS preflight request from a disallowed origin", async () => {
    const res = await request(app)
        .options("/api/organizations")
        .set("Origin", "http://evil.example.com")
        .set("Access-Control-Request-Method", "POST");
    assert.equal(res.status, 403);
});

after(async () => {
    await pool.end();
});
