import { serve } from "tradjs";

await serve({
  port: parseInt(process.env.BUN_PORT || "3000"),
  defaultTitle: "SolCraft",
});