
export const corsOptions = {
  origin: [
    'http://localhost:5174',
    'http://0.0.0.0:5174',
    'https://news-project-1-frontend.onrender.com',
    'https://preview-risqai-frontend.onrender.com',
    'https://preview.risqai.co',
    'https://app.risqai.co',
    'https://kind-pebble-02817100f.6.azurestaticapps.net',
    'https://icy-plant-0e669a70f.2.azurestaticapps.net',
    /\.replit\.dev$/,
    /\.repl\.co$/,
    /\.spock\.replit\.dev$/
  ],
  credentials: true,
  methods: [
    'GET', 
    'POST', 
    'PUT', 
    'DELETE', 
    'OPTIONS', 
    'PATCH'
  ],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'x-csrf-token'
  ],
};
