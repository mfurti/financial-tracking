export default defineEventHandler(
  /** Proxy only to the configured internal API destination. */ (event) => {
    const config = useRuntimeConfig(event);
    const url = getRequestURL(event);
    return proxyRequest(event, `${config.apiInternalUrl}${url.pathname}${url.search}`);
  },
);
