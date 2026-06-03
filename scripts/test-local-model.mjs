// Dev-only: load the configured embedding model from public/models (no network)
// to verify the self-hosted files are complete. Reveals any missing file.
import { env } from "@xenova/transformers";
import { embed, MODEL } from "../src/engine/cluster.js";

// In Node, read the self-hosted files from the filesystem path.
env.localModelPath = "./public/models/";

console.log("Loading", MODEL, "from", env.localModelPath, "...");
const [v] = await embed(["hello world"]);
console.log("OK — embedding length:", v.length);
