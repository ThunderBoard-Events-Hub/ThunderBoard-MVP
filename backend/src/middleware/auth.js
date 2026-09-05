import dotenv from "dotenv";
import { auth } from "express-oauth2-jwt-bearer";
import * as organizationModel from "../models/organizationModel.js";
import * as eventModel from "../models/eventModel.js";

dotenv.config();

// Verifies the Auth0-issued access token (RS256, checked against the tenant's JWKS)
// and populates req.auth.payload with its claims (sub, aud, exp, ...).
export const checkJwt = auth({
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
    audience: process.env.AUTH0_AUDIENCE,
});

// Must run after checkJwt. Loads the organization owned by the authenticated
// Auth0 user and attaches it as req.organization, or 403s if that Auth0 user
// hasn't created an organization profile yet, or if it's still awaiting admin
// review — a pending/rejected org can't create or manage events.
export const attachOrganization = async (req, res, next) => {
    try {
        const organization = await organizationModel.getOrganizationByAuth0Id(req.auth.payload.sub);
        if (!organization) {
            return res.status(403).json({ error: "No organization profile exists for this account yet" });
        }
        if (organization.approval_status !== "approved") {
            return res.status(403).json({ error: "Your organization is awaiting admin approval" });
        }
        req.organization = organization;
        next();
    } catch (error) {
        console.error("Error loading organization for authenticated user:", error);
        res.status(500).json({ error: "Failed to authenticate organization" });
    }
};

// Must run after checkJwt. 404s if :id doesn't exist, 403s if the authenticated
// Auth0 user doesn't own that organization, otherwise attaches it as req.organization.
export const requireOwnOrganization = async (req, res, next) => {
    try {
        const organization = await organizationModel.getOrganizationByIdWithAuth0Id(req.params.id);
        if (!organization) {
            return res.status(404).json({ error: "Organization not found" });
        }
        if (organization.auth0_id !== req.auth.payload.sub) {
            return res.status(403).json({ error: "You do not own this organization" });
        }
        req.organization = organization;
        next();
    } catch (error) {
        console.error("Error checking organization ownership:", error);
        res.status(500).json({ error: "Failed to authenticate organization" });
    }
};

// Checks the ADMIN_AUTH0_IDS allowlist (comma-separated sub values, see .env.example).
// Read live from process.env on every call rather than cached at import time, so it
// can't go stale and tests can set it per-case without reloading modules.
export const isAdminSub = (sub) => {
    const adminIds = (process.env.ADMIN_AUTH0_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    return adminIds.includes(sub);
};

// Must run after checkJwt. 403s unless the caller's Auth0 account is an admin.
export const requireAdmin = (req, res, next) => {
    if (!isAdminSub(req.auth.payload.sub)) {
        return res.status(403).json({ error: "Admin access required" });
    }
    next();
};

// Must run after checkJwt + attachOrganization. 404s if :id doesn't exist, 403s if
// the authenticated organization isn't the event's organizer.
export const requireOwnEvent = async (req, res, next) => {
    try {
        const event = await eventModel.getEventById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        if (event.organizer_id !== req.organization.id) {
            return res.status(403).json({ error: "You do not own this event" });
        }
        req.event = event;
        next();
    } catch (error) {
        console.error("Error checking event ownership:", error);
        res.status(500).json({ error: "Failed to authenticate organization" });
    }
};
