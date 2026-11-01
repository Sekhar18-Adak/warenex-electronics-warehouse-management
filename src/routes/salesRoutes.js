import express from "express";
import {
  renderSalesDashboard,
  renderSalesHistory,
  submitSalesEntry,
  updateSalesEntry,
  renderSalesAnnouncements,
  markSalesAnnouncementAsRead,
  renderSalesAnnouncementDetails,
  renderSalesProducts,
  renderSalesProductDetails,
  updateSalesProductPrice,
  renderCustomers,
  renderCustomerDetails,
  createCustomer,
  updateCustomer,
  renderSalesProfile,
  updateSalesProfileImage,
  uploadProfileImage,
} from "../controllers/salesController.js";
import {
  renderSalesReports,
  submitSalesReport,
  uploadReportAttachment,
} from "../controllers/reportController.js";
import { verifyAuth, loadUserAnnouncements } from "../middlewares/auth.middleware.js";
import { allowRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/dashboard", verifyAuth, allowRoles("Sales"), loadUserAnnouncements, renderSalesDashboard);
router.get("/reports", verifyAuth, allowRoles("Sales"), renderSalesReports);
router.post("/reports", verifyAuth, allowRoles("Sales"), uploadReportAttachment.single("attachment"), submitSalesReport);
router.get("/profile", verifyAuth, allowRoles("Sales"), loadUserAnnouncements, renderSalesProfile);
router.post("/profile/image", verifyAuth, allowRoles("Sales"), uploadProfileImage.single("profileImage"), updateSalesProfileImage);
router.get("/announcements", verifyAuth, allowRoles("Sales"), loadUserAnnouncements, renderSalesAnnouncements);
router.post("/announcements/:id/done", verifyAuth, allowRoles("Sales"), markSalesAnnouncementAsRead);
router.get("/announcements/:id", verifyAuth, allowRoles("Sales"), renderSalesAnnouncementDetails);
router.get("/products", verifyAuth, allowRoles("Sales"), renderSalesProducts);
router.get("/products/view/:id", verifyAuth, allowRoles("Sales"), renderSalesProductDetails);
router.post("/products/update/:id", verifyAuth, allowRoles("Sales"), updateSalesProductPrice);
router.get("/history", verifyAuth, allowRoles("Sales"), renderSalesHistory);
router.post("/history", verifyAuth, allowRoles("Sales"), submitSalesEntry);
router.post("/history/:id/update", verifyAuth, allowRoles("Sales"), updateSalesEntry);
router.get("/customers", verifyAuth, allowRoles("Sales"), renderCustomers);
router.post("/customers/add", verifyAuth, allowRoles("Sales"), createCustomer);
router.post("/customers/:id/update", verifyAuth, allowRoles("Sales"), updateCustomer);
router.get("/customers/view/:id", verifyAuth, allowRoles("Sales"), renderCustomerDetails);

export default router;
