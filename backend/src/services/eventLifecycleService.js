import cron from "node-cron";
import * as eventModel from "../models/eventModel.js";

// Runs the expiry sweep once, immediately and safely callable on its own (e.g. from a test).
export const runEventExpirySweep = async () => {
    try {
        const expiredIds = await eventModel.expireOverdueEvents();
        if (expiredIds.length > 0) {
            console.log(`Expired ${expiredIds.length} event(s): ${expiredIds.join(", ")}`);
        }
        return expiredIds;
    } catch (error) {
        console.error("Error running event expiry sweep:", error);
        return [];
    }
};

// Starts the recurring sweep (every 5 minutes) and runs one immediately so nothing
// sits overdue from before the server started. Not called from app.js/tests — only
// from the real server entrypoint (src/index.js) — so test runs never spin up a timer.
export const startEventLifecycleScheduler = () => {
    runEventExpirySweep();
    return cron.schedule("*/5 * * * *", runEventExpirySweep);
};
