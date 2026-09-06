// Format checks only — "is this shaped like an email/date/time/url", not whether
// it actually exists/resolves/is deliverable. Presence ("is it there") is still
// checked separately by each controller before these run.

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Strict YYYY-MM-DD, and rejects values that "roll over" to a different date
// (e.g. 2026-02-30 would otherwise silently become 2026-03-02).
export const isValidDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

// HH:MM or HH:MM:SS, 24-hour — matches what the DB's `time` columns accept.
export const isValidTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

export const isValidUrl = (value) => {
    if (typeof value !== "string") {
        return false;
    }
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
};
