/**
 * Data Safety Guard
 *
 * Prevents performance, load, benchmark, or destructive scripts and tests
 * from running against the primary operational database ('workflow_platform').
 */

export const PROTECTED_DATABASES = Object.freeze([
  "workflow_platform",
  "workflow_platform_prod",
  "workflow_platform_production",
]);

/**
 * Extracts the database name from a standard MongoDB connection string.
 *
 * @param {string} uri
 * @returns {string} database name
 */
export function extractDatabaseName(uri) {
  if (!uri || typeof uri !== "string") {
    throw new Error("[DATA SAFETY] Target MongoDB URI is missing or invalid.");
  }

  try {
    const cleaned = uri.replace(/^mongodb(\+srv)?:\/\//, "http://");
    const parsed = new URL(cleaned);
    const db = parsed.pathname.replace(/^\//, "").split("?")[0].trim();
    if (db) return db;
  } catch {
    // Fallback regex matching
  }

  const match = uri.match(/\/([^/?#]+)(?:\?|$)/);
  if (match && match[1]) {
    return match[1].trim();
  }

  throw new Error(
    `[DATA SAFETY] Unable to parse database name from MongoDB URI: "${uri}".`,
  );
}

/**
 * Asserts that the target database is not a protected primary database.
 * Throws a descriptive error if the target database name is 'workflow_platform'.
 *
 * @param {string} uri - MongoDB connection URI
 * @param {string} [operationName='performance/load test']
 * @returns {string} database name if safe
 */
export function assertSafeDatabase(
  uri,
  operationName = "performance/load test",
) {
  const dbName = extractDatabaseName(uri);

  if (PROTECTED_DATABASES.includes(dbName.toLowerCase())) {
    throw new Error(
      `[DATA SAFETY GUARD] BLOCKED: Refusing to run ${operationName} against primary database "${dbName}". ` +
        `Performance, load, and rate-limit runs must use an isolated database such as "workflow_platform_perf" ` +
        `or an in-memory database, and must clean up after themselves.`,
    );
  }

  return dbName;
}
