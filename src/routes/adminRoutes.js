import express from "express";
import { renderAdminLoginPage, loginAdmin, logoutAdmin, createEmployeeAccount } from "../controllers/authController.js";
import {
  renderAdminDashboard,
  renderEmployeeManagementPage,
  updateEmployeeStatus,
  deleteEmployee,
  renderAdminTasks,
  renderAdminAnnouncements,
  assignTaskAnnouncement,
  deleteTaskAnnouncement,
  renderAdminReports,
  renderAdminReportDetails,
  renderAdminSuppliers,
  renderAdminSupplierDetails,
} from "../controllers/adminController.js";
import {
  renderAddSupplierForm,
  createSupplier,
  renderSupplierDetails,
  renderEditSupplierForm,
  updateSupplier,
} from "../controllers/supplier/supplierController.js";
import { renderAdminInventory, notifyManagerForProduct, notifyAllLowStockProducts } from "../controllers/inventory/inventoryController.js";
import { verifyAuth } from "../middlewares/auth.middleware.js";
import { allowRoles } from "../middlewares/role.middleware.js";
import { revokeRefreshToken } from "../middlewares/logout.middleware.js";

const router = express.Router();

router.get("/", renderAdminLoginPage);
router.post("/login", loginAdmin);
router.post("/logout", revokeRefreshToken, logoutAdmin);
router.post("/createemployee", verifyAuth, allowRoles("Admin"), createEmployeeAccount);
router.get("/employee", verifyAuth, allowRoles("Admin"), renderEmployeeManagementPage);
router.post("/employee/:id/status", verifyAuth, allowRoles("Admin"), updateEmployeeStatus);
router.post("/employee/:id/delete", verifyAuth, allowRoles("Admin"), deleteEmployee);
router.get("/inventory", verifyAuth, allowRoles("Admin"), renderAdminInventory);
router.post("/inventory/notify-all", verifyAuth, allowRoles("Admin"), notifyAllLowStockProducts);
router.post("/inventory/notify/:id", verifyAuth, allowRoles("Admin"), notifyManagerForProduct);
router.get("/tasks", verifyAuth, allowRoles("Admin"), renderAdminTasks);
router.get("/announcements", verifyAuth, allowRoles("Admin"), renderAdminAnnouncements);
router.post("/announcements/task", verifyAuth, allowRoles("Admin"), assignTaskAnnouncement);
router.post("/announcements/delete/:id", verifyAuth, allowRoles("Admin"), deleteTaskAnnouncement);
router.get("/reports", verifyAuth, allowRoles("Admin"), renderAdminReports);
router.get("/reports/:id", verifyAuth, allowRoles("Admin"), renderAdminReportDetails);
router.get("/suppliers", verifyAuth, allowRoles("Admin"), renderAdminSuppliers);
router.get("/suppliers/add", verifyAuth, allowRoles("Admin"), renderAddSupplierForm);
router.post("/suppliers/add", verifyAuth, allowRoles("Admin"), createSupplier);
router.get("/suppliers/:id", verifyAuth, allowRoles("Admin"), renderAdminSupplierDetails);
router.get("/suppliers/view/:id", verifyAuth, allowRoles("Admin"), renderSupplierDetails);
router.get("/suppliers/edit/:id", verifyAuth, allowRoles("Admin"), renderEditSupplierForm);
router.post("/suppliers/edit/:id", verifyAuth, allowRoles("Admin"), updateSupplier);
router.get("/dashboard", verifyAuth, allowRoles("Admin"), renderAdminDashboard);

export default router;
