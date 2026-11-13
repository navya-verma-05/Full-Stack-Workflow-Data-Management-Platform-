/**
 * Data Safety Guard
 *
 * Prevents performance, load, benchmark, or destructive scripts and tests
 * from running against the primary operational database ('workflow_platform')
 * or any non-isolated database.
 *
 * Hardened with a strict ALLOWLIST: only database names ending in '_perf' or '_test'
 * are permitted.
 */

export const ALLOWED_BENCHMARK_DB_PATTERN = /(_perf|_test)$/i;

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
 * Asserts that the target database conforms to the strict benchmark allowlist.
 * Only database names ending in '_perf' or '_test' are allowed.
 *
 * @param {string} uri - MongoDB connection URI
 * @param {string} [operationName='performance/load test']
 * @returns {string} database name if allowed
 */
export function assertSafeDatabase(
  uri,
  operationName = "performance/load test",
) {
  const dbName = extractDatabaseName(uri);

  if (!ALLOWED_BENCHMARK_DB_PATTERN.test(dbName)) {
    throw new Error(
      `[DATA SAFETY GUARD] BLOCKED: Refusing to run ${operationName} against database "${dbName}". ` +
        `Performance, load, and rate-limit runs are strictly restricted to isolated databases ` +
        `ending in "_perf" or "_test" (e.g. "workflow_platform_perf"), and must clean up after themselves.`,
    );
  }

  return dbName;
}
