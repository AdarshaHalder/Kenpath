import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DATABASE_PATH: ":memory:",
      JWT_SECRET: "test-secret-at-least-16-chars",
      // A dummy key so the AI path is exercised; tests always inject a fake client.
      OPENAI_API_KEY: "test-key",
      AI_MODEL: "gpt-4o-mini",
    },
  },
});
