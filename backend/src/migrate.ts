import "dotenv/config";
import { loadConfig } from "./config.js";
import { Database } from "./database.js";

const config = loadConfig();
const database = new Database(config.databaseUrl);

try {
  await database.migrate();
  console.log("ImagineLab PostgreSQL migrations are up to date.");
} finally {
  await database.close();
}
