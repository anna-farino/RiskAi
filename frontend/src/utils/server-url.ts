
export const serverUrl = (
  import.meta as ImportMeta & { env: { VITE_SERVER_URL_DEV: string } }
).env.VITE_SERVER_URL_DEV;
