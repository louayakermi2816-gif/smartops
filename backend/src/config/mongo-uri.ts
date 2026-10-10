// Builds the MongoDB connection string from environment variables.
// Used by the app (app.module.ts) and the seed script, so both connect the same way.
// MONGO_HOST / MONGO_PORT default to the local Docker container.
export function buildMongoUri(get: (key: string) => string | undefined): string {
  const user = encodeURIComponent(get('MONGO_USERNAME') ?? '');
  const password = encodeURIComponent(get('MONGO_PASSWORD') ?? '');
  const host = get('MONGO_HOST') ?? 'localhost';
  const port = get('MONGO_PORT') ?? '27017';
  const database = get('MONGO_DATABASE') ?? '';
  return `mongodb://${user}:${password}@${host}:${port}/${database}?authSource=admin`;
}
