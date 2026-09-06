import { Router } from "express";
import * as organizationController from "../controllers/organizationController.js";
import { parseImage } from "../middleware/uploadMiddleware.js";
import { checkJwt, requireOwnOrganization, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.post("/", checkJwt, parseImage("image"), organizationController.createOrganization);
router.get("/", organizationController.getAllOrganizations);
router.get("/search", organizationController.searchOrganizationsByName);
router.get("/me", checkJwt, organizationController.getMyOrganization);
router.get("/pending", checkJwt, requireAdmin, organizationController.getPendingOrganizations);
router.get("/:id", organizationController.getOrganizationById);
router.put("/:id", checkJwt, requireOwnOrganization, parseImage("image"), organizationController.updateOrganization);
router.post("/:id/follow", organizationController.incrementFollowersCount);
router.post("/:id/unfollow", organizationController.decrementFollowersCount);
router.post("/:id/approve", checkJwt, requireAdmin, organizationController.approveOrganization);
router.post("/:id/decline", checkJwt, requireAdmin, organizationController.declineOrganization);
router.delete("/:id", checkJwt, requireOwnOrganization, organizationController.deleteOrganization);

export default router;
