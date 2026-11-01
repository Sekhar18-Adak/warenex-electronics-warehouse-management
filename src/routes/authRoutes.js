import express from "express";
import { renderEmployeeLoginPage, loginEmployee, logoutUser } from "../controllers/authController.js";

const router = express.Router();

router.get("/login", renderEmployeeLoginPage);
router.post("/login", loginEmployee);
router.post("/logout", logoutUser);

export default router;
