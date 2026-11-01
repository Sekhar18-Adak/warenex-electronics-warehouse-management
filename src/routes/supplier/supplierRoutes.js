import express from "express";
import {
  renderSuppliers,
  renderAddSupplierForm,
  createSupplier,
  renderSupplierDetails,
  renderEditSupplierForm,
  updateSupplier,
} from "../../controllers/supplier/supplierController.js";
import { verifyAuth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.get("/suppliers", verifyAuth, allowRoles("Manager"), renderSuppliers);
router.get("/suppliers/add", verifyAuth, allowRoles("Manager"), renderAddSupplierForm);
router.post("/suppliers/add", verifyAuth, allowRoles("Manager"), createSupplier);
router.get("/suppliers/view/:id", verifyAuth, allowRoles("Manager"), renderSupplierDetails);
router.get("/suppliers/edit/:id", verifyAuth, allowRoles("Manager"), renderEditSupplierForm);
router.post("/suppliers/edit/:id", verifyAuth, allowRoles("Manager"), updateSupplier);

export default router;
