import { Router } from "express";
import * as eventController from "../controllers/eventController.js";
import { parseImage } from "../middleware/uploadMiddleware.js";
import { checkJwt, attachOrganization, requireOwnEvent } from "../middleware/auth.js";

const router = Router();

//parseImage middleware is used to handle image upload before the createEvent controller is called
router.post("/", checkJwt, attachOrganization, parseImage("image"), eventController.createEvent);
router.get("/", eventController.getAllEvents);
router.get("/search", eventController.searchEventsByTitle);
router.get("/tags", eventController.getEventsByAnyTags);
router.get("/organizer/:organizer_id", eventController.getEventsByOrganizer);
router.get("/:id", eventController.getEventById);
router.put(
    "/:id",
    checkJwt,
    attachOrganization,
    requireOwnEvent,
    parseImage("image"),
    eventController.updateEvent
);
router.delete("/:id", checkJwt, attachOrganization, requireOwnEvent, eventController.deleteEvent);

router.get("/:id/tags", eventController.getTagsForEvent);
router.post("/:id/tags", checkJwt, attachOrganization, requireOwnEvent, eventController.addTagToEvent);
router.delete(
    "/:id/tags/:tag_id",
    checkJwt,
    attachOrganization,
    requireOwnEvent,
    eventController.removeTagFromEvent
);

export default router;
