// Copies the agent's generated protocol types into the editor.
// Usage: node scripts/sync-protocol.mjs [path to agent/schema/protocol.ts]
import { readFileSync, writeFileSync } from "node:fs";

const source = process.argv[2] ?? "../agent/schema/protocol.ts";
const header = "// Copied from vibefork-me/agent schema/protocol.ts by scripts/sync-protocol.mjs. Do not edit.\n";
writeFileSync("src/client/protocol.generated.ts", header + readFileSync(source, "utf8"));
console.log(`synced from ${source}`);
