import "dotenv/config";
import { createApp } from "./app";
import { aiStatus } from "./ai/client";
import { env } from "./config/env";
import { getDb } from "./db/connection";
import { seedDatabase } from "./db/seed";

// Seed on first boot so a fresh deploy works out of the box with the made-up sample data.
if (seedDatabase(getDb()).seeded) console.log("Seeded database with sample applications.");

const ai = aiStatus();
console.log(ai.configured ? `AI enabled (model: ${ai.model})` : "AI not configured: using rule-based case notes.");

createApp().listen(env.PORT, () => console.log(`Officer console API on http://localhost:${env.PORT}`));
