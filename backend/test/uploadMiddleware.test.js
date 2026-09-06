import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { parseImage } from "../src/middleware/uploadMiddleware.js";

const buildApp = (fieldName = "image") => {
    const app = express();
    app.use(express.json());
    app.post("/upload", parseImage(fieldName), (req, res) => {
        res.json({
            body: req.body,
            file: req.file
                ? {
                    fieldname: req.file.fieldname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    isBuffer: Buffer.isBuffer(req.file.buffer),
                }
                : null,
        });
    });
    return app;
};

// 1x1 transparent PNG
const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
);

test("parseImage accepts a valid image file and populates req.file", async () => {
    const app = buildApp("image");
    const res = await request(app)
        .post("/upload")
        .attach("image", pngBuffer, { filename: "test.png", contentType: "image/png" });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.file, {
        fieldname: "image",
        mimetype: "image/png",
        size: pngBuffer.length,
        isBuffer: true,
    });
});

test("parseImage rejects a non-image file with a 400", async () => {
    const app = buildApp("image");
    const res = await request(app)
        .post("/upload")
        .attach("image", Buffer.from("just some text"), { filename: "notes.txt", contentType: "text/plain" });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /image/i);
});

test("parseImage rejects a file over 5MB with a 400", async () => {
    const app = buildApp("image");
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 1);
    const res = await request(app)
        .post("/upload")
        .attach("image", bigBuffer, { filename: "big.png", contentType: "image/png" });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /5MB/);
});

test("parseImage passes through untouched when no file is attached", async () => {
    const app = buildApp("image");
    const res = await request(app).post("/upload").field("name", "no file here");

    assert.equal(res.status, 200);
    assert.equal(res.body.file, null);
});

test("parseImage leaves a plain JSON request's body untouched", async () => {
    const app = buildApp("image");
    const res = await request(app).post("/upload").send({ name: "plain json client" });

    assert.equal(res.status, 200);
    assert.equal(res.body.file, null);
    assert.deepEqual(res.body.body, { name: "plain json client" });
});

test("parseImage respects a custom field name", async () => {
    const app = buildApp("logo");
    const res = await request(app)
        .post("/upload")
        .attach("logo", pngBuffer, { filename: "logo.png", contentType: "image/png" });

    assert.equal(res.status, 200);
    assert.equal(res.body.file.fieldname, "logo");
});
