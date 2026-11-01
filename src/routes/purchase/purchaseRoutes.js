import express from "express";
import {
  renderPurchasePage,
  renderPurchaseDetails,
  renderPurchaseEditPage,
  deletePurchaseOrder,
  updatePurchaseStatus,
} from "../../controllers/purchase/purchaseController.js";
import { verifyAuth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.get("/purchases", verifyAuth, allowRoles("Manager"), renderPurchasePage);
router.get("/purchases/view/:id", verifyAuth, allowRoles("Manager"), renderPurchaseDetails);
router.get("/purchases/edit/:id", verifyAuth, allowRoles("Manager"), renderPurchaseEditPage);
router.post("/purchases/delete/:id", verifyAuth, allowRoles("Manager"), deletePurchaseOrder);
router.post("/purchases/update-status/:id", verifyAuth, allowRoles("Manager"), updatePurchaseStatus);

export default router;
