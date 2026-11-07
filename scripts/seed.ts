import "dotenv/config";
import { createDb } from "../src/db";
import { seed } from "../src/db/seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const demo = process.argv.includes("--demo") || process.env.SEED_DEMO === "1";
const { client, db } = createDb(url);

seed(db, {
  adminMobile: process.env.SEED_ADMIN_MOBILE,
  adminPassword: process.env.SEED_ADMIN_PASSWORD,
  demo,
})
  .then(() => console.log(`Seed done${demo ? " (with demo parties and users)" : ""}`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
