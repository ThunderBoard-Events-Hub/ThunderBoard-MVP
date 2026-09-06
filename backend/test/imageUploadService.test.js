import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadImage } from "../src/services/imageUploadService.js";
import { eventsContainerClient, organizationContainerClient } from "../src/config/storage.js";

// 1x1 transparent PNG
const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
);

const fakeMulterFile = (originalname) => ({
    originalname,
    mimetype: "image/png",
    buffer: pngBuffer,
});

test("uploadImage returns undefined when no file is given", async () => {
    const result = await uploadImage(eventsContainerClient, undefined);
    assert.equal(result, undefined);
});

test("uploadImage uploads to the events container and returns a working blob URL", async () => {
    const file = fakeMulterFile("test-event-image.png");
    const url = await uploadImage(eventsContainerClient, file);

    assert.match(url, /^https:\/\/.*\/event-images\/.*\.png$/);

    // the blob actually exists in the container under that name
    const blobName = url.split("/").pop();
    const exists = await eventsContainerClient.getBlockBlobClient(blobName).exists();
    assert.equal(exists, true);

    await eventsContainerClient.deleteBlob(blobName);
});

test("uploadImage uploads to the organization container and returns a working blob URL", async () => {
    const file = fakeMulterFile("test-org-logo.png");
    const url = await uploadImage(organizationContainerClient, file);

    assert.match(url, /^https:\/\/.*\/organization-logos\/.*\.png$/);

    const blobName = url.split("/").pop();
    const exists = await organizationContainerClient.getBlockBlobClient(blobName).exists();
    assert.equal(exists, true);

    await organizationContainerClient.deleteBlob(blobName);
});

test("uploadImage generates a unique blob name each time, even for the same original filename", async () => {
    const file1 = fakeMulterFile("same-name.png");
    const file2 = fakeMulterFile("same-name.png");

    const url1 = await uploadImage(eventsContainerClient, file1);
    const url2 = await uploadImage(eventsContainerClient, file2);

    assert.notEqual(url1, url2);

    await eventsContainerClient.deleteBlob(url1.split("/").pop());
    await eventsContainerClient.deleteBlob(url2.split("/").pop());
});
