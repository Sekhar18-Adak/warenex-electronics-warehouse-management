import express from "express";
import {
  renderEmployeeDashboard,
  renderEmployeeInventory,
  renderEmployeeProfile,
  renderEmployeeTasks,
  updateEmployeeProfileImage,
  updateEmployeeTaskStatus,
  uploadProfileImage,
} from "../controllers/employeeController.js";
import { verifyAuth, loadUserAnnouncements } from "../middlewares/auth.middleware.js";
import { allowRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/dashboard", verifyAuth, allowRoles("Employee"), loadUserAnnouncements, renderEmployeeDashboard);
router.get("/inventory", verifyAuth, allowRoles("Employee"), loadUserAnnouncements, renderEmployeeInventory);
router.get("/tasks", verifyAuth, allowRoles("Employee"), loadUserAnnouncements, renderEmployeeTasks);
router.post("/tasks/:id/status", verifyAuth, allowRoles("Employee"), updateEmployeeTaskStatus);
router.get("/profile", verifyAuth, allowRoles("Employee"), loadUserAnnouncements, renderEmployeeProfile);
router.post("/profile/image", verifyAuth, allowRoles("Employee"), uploadProfileImage.single("profileImage"), updateEmployeeProfileImage);

export default router;
