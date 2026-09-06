import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidEmail, isValidDate, isValidTime, isValidUrl } from "../src/utils/validation.js";

test("isValidEmail accepts a normal address and rejects obviously malformed ones", () => {
    assert.equal(isValidEmail("eus@ubc.ca"), true);
    assert.equal(isValidEmail("not-an-email"), false);
    assert.equal(isValidEmail("missing-domain@"), false);
    assert.equal(isValidEmail("@missing-local.com"), false);
    assert.equal(isValidEmail("has spaces@ubc.ca"), false);
});

test("isValidDate accepts YYYY-MM-DD and rejects malformed or non-existent dates", () => {
    assert.equal(isValidDate("2026-09-20"), true);
    assert.equal(isValidDate("2026-1-5"), false); // not zero-padded
    assert.equal(isValidDate("09/20/2026"), false);
    assert.equal(isValidDate("2026-02-30"), false); // rolls over to March
    assert.equal(isValidDate("not-a-date"), false);
    assert.equal(isValidDate(""), false);
});

test("isValidTime accepts HH:MM and HH:MM:SS, rejects out-of-range or malformed values", () => {
    assert.equal(isValidTime("09:00"), true);
    assert.equal(isValidTime("23:59:59"), true);
    assert.equal(isValidTime("24:00"), false);
    assert.equal(isValidTime("12:60"), false);
    assert.equal(isValidTime("noon"), false);
});

test("isValidUrl accepts http(s) urls and rejects everything else", () => {
    assert.equal(isValidUrl("https://example.com/logo.png"), true);
    assert.equal(isValidUrl("http://example.com"), true);
    assert.equal(isValidUrl("javascript:alert(1)"), false);
    assert.equal(isValidUrl("not a url"), false);
    assert.equal(isValidUrl("ftp://example.com/file"), false);
});
