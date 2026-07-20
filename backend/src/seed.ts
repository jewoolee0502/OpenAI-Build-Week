import "dotenv/config";
import { AuthService } from "./auth.js";
import { loadConfig } from "./config.js";
import { Database } from "./database.js";
import { PostgresStore } from "./store.js";

const config = loadConfig();
const database = new Database(config.databaseUrl);

try {
  await database.migrate();
  const store = new PostgresStore(database);
  const existing = await store.findGuardianCredentials("parent@imaginelab.local");
  if (existing) {
    console.log("Local demo guardian already exists: parent@imaginelab.local");
  } else {
    const auth = new AuthService(config, store);
    const guardian = await auth.registerGuardian({
      displayName: "ImagineLab Parent",
      email: "parent@imaginelab.local",
      password: "imagine-together-123",
    });
    const child = await auth.createGuest();
    await store.linkChild(guardian.user.id, child.user.childId);
    console.log("Created local demo accounts:");
    console.log("  Parent email: parent@imaginelab.local");
    console.log("  Parent password: imagine-together-123");
    console.log(`  Child ID: ${child.user.childId}`);
    console.log("The generated child bearer token is intentionally not printed.");
  }
} finally {
  await database.close();
}
