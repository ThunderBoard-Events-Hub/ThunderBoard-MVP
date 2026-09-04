import { Router } from "express";
import * as eventController from "../controllers/eventController.js";

const router = Router();

router.post("/", eventController.createEvent);
router.get("/", eventController.getAllEvents);
router.get("/search", eventController.searchEventsByTitle);
router.get("/tags", eventController.getEventsByAnyTags);
router.get("/organizer/:organizer_id", eventController.getEventsByOrganizer);
router.get("/:id", eventController.getEventById);
router.put("/:id", eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

router.get("/:id/tags", eventController.getTagsForEvent);
router.post("/:id/tags", eventController.addTagToEvent);
router.delete("/:id/tags/:tag_id", eventController.removeTagFromEvent);

export default router;
