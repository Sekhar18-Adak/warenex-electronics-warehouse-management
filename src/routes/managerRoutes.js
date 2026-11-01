import express from "express";
import {
  renderManagerDashboard,
  renderManagerProducts,
  renderManagerAnnouncements,
  markManagerAnnouncementAsRead,
  renderManagerAnnouncementDetails,
  renderManagerProfile,
  updateManagerProfileImage,
  uploadProfileImage,
  renderManagerTaskAssignments,
  assignEmployeeTask,
} from "../controllers/managerController.js";
import {
  renderManagerReports,
  submitManagerReport,
  uploadReportAttachment,
} from "../controllers/reportController.js";
import { verifyAuth, loadUserAnnouncements } from "../middlewares/auth.middleware.js";
import { allowRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/dashboard", verifyAuth, allowRoles("Manager"), loadUserAnnouncements, renderManagerDashboard);
router.get("/tasks", verifyAuth, allowRoles("Manager"), renderManagerTaskAssignments);
router.post("/tasks/assign", verifyAuth, allowRoles("Manager"), assignEmployeeTask);
router.get("/reports", verifyAuth, allowRoles("Manager"), renderManagerReports);
router.post("/reports", verifyAuth, allowRoles("Manager"), uploadReportAttachment.single("attachment"), submitManagerReport);
router.get("/profile", verifyAuth, allowRoles("Manager"), loadUserAnnouncements, renderManagerProfile);
router.post("/profile/image", verifyAuth, allowRoles("Manager"), uploadProfileImage.single("profileImage"), updateManagerProfileImage);
router.get("/products", verifyAuth, allowRoles("Manager"), loadUserAnnouncements, renderManagerProducts);
router.get("/announcements", verifyAuth, allowRoles("Manager"), renderManagerAnnouncements);
router.post("/announcements/:id/done", verifyAuth, allowRoles("Manager"), markManagerAnnouncementAsRead);
router.get("/announcements/:id", verifyAuth, allowRoles("Manager"), renderManagerAnnouncementDetails);

export default router;
