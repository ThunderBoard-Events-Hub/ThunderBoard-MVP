import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/database.js";
import { organizationContainerClient } from "../src/config/storage.js";
import { mockAuth0, bearer } from "./helpers/testAuth.js";

const adminSub = `auth0|admin-${randomUUID()}`;

before(() => {
    mockAuth0();
    process.env.ADMIN_AUTH0_IDS = adminSub;
});

const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
);

const unique = randomUUID();
const orgSub = `auth0|${randomUUID()}`;
const testOrg = {
    name: `Test Org ${unique}`,
    email: `test-org-${unique}@example.com`,
    description: "Created by automated tests",
};

let createdId;

test("POST /api/organizations requires an Authorization header", async () => {
    const res = await request(app).post("/api/organizations").send(testOrg);
    assert.equal(res.status, 401);
});

test("POST /api/organizations requires name and email", async () => {
    const res = await request(app)
        .post("/api/organizations")
        .set("Authorization", bearer(orgSub))
        .send({ name: "Missing fields" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /required/);
});

test("POST /api/organizations rejects a malformed email", async () => {
    const res = await request(app)
        .post("/api/organizations")
        .set("Authorization", bearer(orgSub))
        .send({ name: "Bad Email Org", email: "not-an-email" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /valid email/);
});

test("POST /api/organizations rejects a malformed image_url", async () => {
    const res = await request(app)
        .post("/api/organizations")
        .set("Authorization", bearer(orgSub))
        .send({ name: "Bad Image Org", email: `bad-image-${randomUUID()}@example.com`, image_url: "not a url" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /valid http/);
});

test("POST /api/organizations creates an organization pending review, and never returns auth0_id or approval_status", async () => {
    const res = await request(app).post("/api/organizations").set("Authorization", bearer(orgSub)).send(testOrg);
    assert.equal(res.status, 201);
    assert.equal(res.body.name, testOrg.name);
    assert.equal(res.body.followers_count, 0);
    assert.equal("auth0_id" in res.body, false);
    assert.equal("approval_status" in res.body, false);
    createdId = res.body.id;
});

test("POST /api/organizations rejects a second organization for the same account", async () => {
    const res = await request(app).post("/api/organizations").set("Authorization", bearer(orgSub)).send({
        name: `Another Org ${randomUUID()}`,
        email: `another-${randomUUID()}@example.com`,
    });
    assert.equal(res.status, 409);
});

test("POST /api/organizations rejects a duplicate email under a different account", async () => {
    const res = await request(app)
        .post("/api/organizations")
        .set("Authorization", bearer(`auth0|${randomUUID()}`))
        .send(testOrg);
    assert.equal(res.status, 409);
});

test("GET /api/organizations/me returns the caller's own org, pending status included, while awaiting review", async () => {
    const res = await request(app).get("/api/organizations/me").set("Authorization", bearer(orgSub));
    assert.equal(res.status, 200);
    assert.equal(res.body.id, createdId);
    assert.equal(res.body.approval_status, "pending");
    assert.equal("auth0_id" in res.body, false);
});

test("GET /api/organizations/me 404s for an account with no organization yet", async () => {
    const res = await request(app).get("/api/organizations/me").set("Authorization", bearer(`auth0|${randomUUID()}`));
    assert.equal(res.status, 404);
});

test("GET /api/organizations does not include a still-pending organization", async () => {
    const res = await request(app).get("/api/organizations");
    assert.equal(res.status, 200);
    assert.ok(!res.body.some((org) => org.id === createdId));
});

test("GET /api/organizations/:id 404s while the organization is pending review", async () => {
    const res = await request(app).get(`/api/organizations/${createdId}`);
    assert.equal(res.status, 404);
});

test("GET /api/organizations/:id 404s for a missing id", async () => {
    const res = await request(app).get("/api/organizations/999999999");
    assert.equal(res.status, 404);
});

test("GET /api/organizations/pending requires an Authorization header", async () => {
    const res = await request(app).get("/api/organizations/pending");
    assert.equal(res.status, 401);
});

test("GET /api/organizations/pending rejects a non-admin caller", async () => {
    const res = await request(app).get("/api/organizations/pending").set("Authorization", bearer(orgSub));
    assert.equal(res.status, 403);
});

test("GET /api/organizations/pending includes the pending organization for an admin", async () => {
    const res = await request(app).get("/api/organizations/pending").set("Authorization", bearer(adminSub));
    assert.equal(res.status, 200);
    assert.ok(res.body.some((org) => org.id === createdId && org.approval_status === "pending"));
});

test("POST /api/organizations/:id/approve rejects a non-admin caller", async () => {
    const res = await request(app)
        .post(`/api/organizations/${createdId}/approve`)
        .set("Authorization", bearer(orgSub));
    assert.equal(res.status, 403);
});

test("POST /api/organizations/:id/approve approves a pending organization", async () => {
    const res = await request(app)
        .post(`/api/organizations/${createdId}/approve`)
        .set("Authorization", bearer(adminSub));
    assert.equal(res.status, 200);
    assert.equal(res.body.approval_status, "approved");
});

test("POST /api/organizations/:id/approve 404s for an organization that's already been decided", async () => {
    const res = await request(app)
        .post(`/api/organizations/${createdId}/approve`)
        .set("Authorization", bearer(adminSub));
    assert.equal(res.status, 404);
});

test("GET /api/organizations includes the organization once approved", async () => {
    const res = await request(app).get("/api/organizations");
    assert.equal(res.status, 200);
    assert.ok(res.body.some((org) => org.id === createdId));
});

test("GET /api/organizations/search?name= finds it by partial match", async () => {
    const res = await request(app).get("/api/organizations/search").query({ name: "Test Org" });
    assert.equal(res.status, 200);
    assert.ok(res.body.some((org) => org.id === createdId));
});

test("GET /api/organizations/search without name is a 400", async () => {
    const res = await request(app).get("/api/organizations/search");
    assert.equal(res.status, 400);
});

test("GET /api/organizations/:id returns the organization now that it's approved", async () => {
    const res = await request(app).get(`/api/organizations/${createdId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, createdId);
});

test("PUT /api/organizations/:id requires an Authorization header", async () => {
    const res = await request(app).put(`/api/organizations/${createdId}`).send({ description: "nope" });
    assert.equal(res.status, 401);
});

test("PUT /api/organizations/:id rejects a caller who doesn't own the organization", async () => {
    const res = await request(app)
        .put(`/api/organizations/${createdId}`)
        .set("Authorization", bearer(`auth0|${randomUUID()}`))
        .send({ description: "nope" });
    assert.equal(res.status, 403);
});

test("PUT /api/organizations/:id updates fields", async () => {
    const res = await request(app)
        .put(`/api/organizations/${createdId}`)
        .set("Authorization", bearer(orgSub))
        .send({ description: "Updated by automated tests" });
    assert.equal(res.status, 200);
    assert.equal(res.body.description, "Updated by automated tests");
});

test("PUT /api/organizations/:id rejects a malformed image_url", async () => {
    const res = await request(app)
        .put(`/api/organizations/${createdId}`)
        .set("Authorization", bearer(orgSub))
        .send({ image_url: "not a url" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /valid http/);
});

test("POST /api/organizations/:id/follow increments followers_count", async () => {
    const before = await request(app).get(`/api/organizations/${createdId}`);
    const res = await request(app).post(`/api/organizations/${createdId}/follow`);
    assert.equal(res.status, 200);
    assert.equal(res.body.followers_count, before.body.followers_count + 1);
});

test("POST /api/organizations/:id/follow 404s for a missing id", async () => {
    const res = await request(app).post("/api/organizations/999999999/follow");
    assert.equal(res.status, 404);
});

test("POST /api/organizations/:id/unfollow decrements followers_count", async () => {
    const before = await request(app).get(`/api/organizations/${createdId}`);
    const res = await request(app).post(`/api/organizations/${createdId}/unfollow`);
    assert.equal(res.status, 200);
    assert.equal(res.body.followers_count, before.body.followers_count - 1);
});

test("POST /api/organizations/:id/unfollow floors followers_count at 0", async () => {
    // createdId's followers_count is 0 at this point (one follow, one unfollow above)
    const res = await request(app).post(`/api/organizations/${createdId}/unfollow`);
    assert.equal(res.status, 200);
    assert.equal(res.body.followers_count, 0);
});

test("POST /api/organizations/:id/unfollow 404s for a missing id", async () => {
    const res = await request(app).post("/api/organizations/999999999/unfollow");
    assert.equal(res.status, 404);
});

test("POST /api/organizations/:id/decline rejects a non-admin caller", async () => {
    const sub = `auth0|${randomUUID()}`;
    const created = await request(app)
        .post("/api/organizations")
        .set("Authorization", bearer(sub))
        .send({ name: `Decline Test Org ${randomUUID()}`, email: `decline-${randomUUID()}@example.com` });

    const res = await request(app).post(`/api/organizations/${created.body.id}/decline`).set("Authorization", bearer(sub));
    assert.equal(res.status, 403);

    await request(app).delete(`/api/organizations/${created.body.id}`).set("Authorization", bearer(sub));
});

test("POST /api/organizations/:id/decline declines a pending organization, which then stays invisible and can't be re-decided", async () => {
    const sub = `auth0|${randomUUID()}`;
    const created = await request(app)
        .post("/api/organizations")
        .set("Authorization", bearer(sub))
        .send({ name: `Decline Test Org 2 ${randomUUID()}`, email: `decline2-${randomUUID()}@example.com` });

    const declined = await request(app)
        .post(`/api/organizations/${created.body.id}/decline`)
        .set("Authorization", bearer(adminSub));
    assert.equal(declined.status, 200);
    assert.equal(declined.body.approval_status, "rejected");

    const stillHidden = await request(app).get(`/api/organizations/${created.body.id}`);
    assert.equal(stillHidden.status, 404);

    const redecide = await request(app)
        .post(`/api/organizations/${created.body.id}/approve`)
        .set("Authorization", bearer(adminSub));
    assert.equal(redecide.status, 404);

    await request(app).delete(`/api/organizations/${created.body.id}`).set("Authorization", bearer(sub));
});

test("POST /api/organizations with an attached image uploads it to Azure and sets image_url", async () => {
    const sub = `auth0|${randomUUID()}`;
    const res = await request(app)
        .post("/api/organizations")
        .set("Authorization", bearer(sub))
        .field("name", `Test Org With Image ${randomUUID()}`)
        .field("email", `test-org-image-${randomUUID()}@example.com`)
        .attach("image", pngBuffer, { filename: "logo.png", contentType: "image/png" });

    assert.equal(res.status, 201);
    assert.match(res.body.image_url, /organization-logos\/.*\.png$/);

    const blobName = res.body.image_url.split("/").pop();
    const exists = await organizationContainerClient.getBlockBlobClient(blobName).exists();
    assert.equal(exists, true);

    // cleanup: the org's DB row and its uploaded blob
    await request(app).delete(`/api/organizations/${res.body.id}`).set("Authorization", bearer(sub));
    await organizationContainerClient.deleteBlob(blobName);
});

test("PUT /api/organizations/:id with a new image deletes the old blob and keeps the new one", async () => {
    const sub = `auth0|${randomUUID()}`;
    const created = await request(app)
        .post("/api/organizations")
        .set("Authorization", bearer(sub))
        .field("name", `Replace Image Org ${randomUUID()}`)
        .field("email", `replace-image-${randomUUID()}@example.com`)
        .attach("image", pngBuffer, { filename: "first.png", contentType: "image/png" });
    const firstBlobName = created.body.image_url.split("/").pop();

    const updated = await request(app)
        .put(`/api/organizations/${created.body.id}`)
        .set("Authorization", bearer(sub))
        .attach("image", pngBuffer, { filename: "second.png", contentType: "image/png" });
    const secondBlobName = updated.body.image_url.split("/").pop();

    assert.equal(updated.status, 200);
    assert.notEqual(secondBlobName, firstBlobName);
    assert.equal(await organizationContainerClient.getBlockBlobClient(firstBlobName).exists(), false);
    assert.equal(await organizationContainerClient.getBlockBlobClient(secondBlobName).exists(), true);

    await request(app).delete(`/api/organizations/${created.body.id}`).set("Authorization", bearer(sub));
    await organizationContainerClient.deleteBlob(secondBlobName);
});

test("PUT /api/organizations/:id without a new image leaves the existing image untouched", async () => {
    const sub = `auth0|${randomUUID()}`;
    const created = await request(app)
        .post("/api/organizations")
        .set("Authorization", bearer(sub))
        .field("name", `Keep Image Org ${randomUUID()}`)
        .field("email", `keep-image-${randomUUID()}@example.com`)
        .attach("image", pngBuffer, { filename: "keep.png", contentType: "image/png" });
    const blobName = created.body.image_url.split("/").pop();

    const updated = await request(app)
        .put(`/api/organizations/${created.body.id}`)
        .set("Authorization", bearer(sub))
        .send({ description: "text-only update" });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.image_url, created.body.image_url);
    assert.equal(await organizationContainerClient.getBlockBlobClient(blobName).exists(), true);

    await request(app).delete(`/api/organizations/${created.body.id}`).set("Authorization", bearer(sub));
    await organizationContainerClient.deleteBlob(blobName);
});

test("DELETE /api/organizations/:id cascades to its events", async () => {
    const sub = `auth0|${randomUUID()}`;
    const org = await request(app)
        .post("/api/organizations")
        .set("Authorization", bearer(sub))
        .send({ name: `Cascade Test Org ${randomUUID()}`, email: `cascade-${randomUUID()}@example.com` });
    await request(app).post(`/api/organizations/${org.body.id}/approve`).set("Authorization", bearer(adminSub));

    const event = await request(app)
        .post("/api/events")
        .set("Authorization", bearer(sub))
        .send({ title: `Cascade Test Event ${randomUUID()}`, start_date: "2026-10-01" });
    assert.equal(event.status, 201);

    const res = await request(app).delete(`/api/organizations/${org.body.id}`).set("Authorization", bearer(sub));
    assert.equal(res.status, 200);

    const eventAfter = await request(app).get(`/api/events/${event.body.id}`);
    assert.equal(eventAfter.status, 404);
});

test("DELETE /api/organizations/:id requires ownership", async () => {
    const res = await request(app)
        .delete(`/api/organizations/${createdId}`)
        .set("Authorization", bearer(`auth0|${randomUUID()}`));
    assert.equal(res.status, 403);
});

test("DELETE /api/organizations/:id deletes the organization", async () => {
    const res = await request(app).delete(`/api/organizations/${createdId}`).set("Authorization", bearer(orgSub));
    assert.equal(res.status, 200);

    const after = await request(app).get(`/api/organizations/${createdId}`);
    assert.equal(after.status, 404);
});

after(async () => {
    await pool.end();
});
