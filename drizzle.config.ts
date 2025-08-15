const isAzure = process.env.IS_AZURE;

export default {
  dialect: 'postgresql',
  schema: isAzure ? './shared/db/schema/*' : './shared/db/schema/*',
  out: isAzure ? './db/migrations' : './backend/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
};
