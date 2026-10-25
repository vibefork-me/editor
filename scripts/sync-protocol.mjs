// Copies the agent's generated protocol types into the editor.
// Usage: node scripts/sync-protocol.mjs [path to agent/schema/protocol.ts]
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const fallback = ["../agent/schema/protocol.ts", "../../agent/schema/protocol.ts"].find(existsSync);
const source = process.argv[2] ?? fallback ?? "../agent/schema/protocol.ts";
const header = "// Copied from vibefork-me/agent schema/protocol.ts by scripts/sync-protocol.mjs. Do not edit.\n";
writeFileSync("src/client/protocol.generated.ts", header + readFileSync(source, "utf8"));
console.log(`synced from ${source}`);
