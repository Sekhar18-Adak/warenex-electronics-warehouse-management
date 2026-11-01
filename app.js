import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import homeRoutes from "./src/routes/homeRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import managerRoutes from "./src/routes/managerRoutes.js";
import salesRoutes from "./src/routes/salesRoutes.js";
import employeeRoutes from "./src/routes/employeeRoutes.js";
import inventoryRoutes from "./src/routes/inventory/inventoryRoutes.js";
import supplierRoutes from "./src/routes/supplier/supplierRoutes.js";
import purchaseRoutes from "./src/routes/purchase/purchaseRoutes.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/", homeRoutes);
app.use("/", authRoutes);
app.use("/admin", adminRoutes);
app.use("/manager", managerRoutes);
app.use("/manager", inventoryRoutes);
app.use("/manager", supplierRoutes);
app.use("/manager", purchaseRoutes);
app.use("/sales", salesRoutes);
app.use("/employee", employeeRoutes);

export default app;