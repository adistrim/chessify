/**
 * Server configuration
 */

export const config = {
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
    host: process.env.HOST || "0.0.0.0",
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
  },

  game: {
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes in milliseconds
    cleanupInterval: 5 * 60 * 1000, // Run cleanup every 5 minutes
  },
};
