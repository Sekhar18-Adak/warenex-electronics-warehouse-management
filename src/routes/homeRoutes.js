import express from "express";
import { renderLandingPage } from "../controllers/homeController.js";

const router = express.Router();

router.get("/", renderLandingPage);

export default router;
