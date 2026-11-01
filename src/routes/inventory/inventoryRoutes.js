import express from "express";
import {
  renderInventory,
  renderAddProductForm,
  handleAddProduct,
  updateInventoryStock,
} from "../../controllers/inventory/inventoryController.js";
import { verifyAuth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.get("/inventory", verifyAuth, allowRoles("Manager"), renderInventory);
router.get("/inventory/add", verifyAuth, allowRoles("Manager"), renderAddProductForm);
router.post("/inventory/add", verifyAuth, allowRoles("Manager"), handleAddProduct);
router.post("/inventory/update/:id", verifyAuth, allowRoles("Manager"), updateInventoryStock);

export default router;
