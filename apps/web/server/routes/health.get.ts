export default defineEventHandler(
  /** Check the web-to-API/database path without returning internal diagnostic data. */ async (event) => {
    try {
      await $fetch(`${useRuntimeConfig(event).apiInternalUrl}/api/v1/health/ready`, { timeout: 3000, retry: 0 });
      return { status: 'ok' };
    } catch {
      throw createError({ statusCode: 503, statusMessage: 'Service unavailable' });
    }
  },
);
