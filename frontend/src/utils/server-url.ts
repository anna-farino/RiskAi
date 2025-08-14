export const serverUrl = (
  import.meta as any
).env.VITE_SERVER_URL || 
(import.meta as any).env.VITE_SERVER_URL_PROD || 
(import.meta as any).env.VITE_SERVER_URL_DEV || 
'http://localhost:5002'