import dotenv from "dotenv";
import app from "./app.js";
import { testConnection } from "./src/config/db.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "localhost";

const startServer = async () => {
    try {
        const isConnected = await testConnection();

        app.listen(PORT, () => {
            console.log(
                `🚀 Server running at http://${HOST}:${PORT}`
            );

            if (!isConnected) {
                console.log("⚠️ Database connection unavailable; the landing page is still available.");
            }
        });
    } catch (error) {
        console.error(error);
    }
};

startServer();