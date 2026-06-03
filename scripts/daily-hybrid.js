import "dotenv/config";
import { runHybridRefresh } from "./hybrid-refresh.js";

await runHybridRefresh();
await import("./post-wordpress.js");
