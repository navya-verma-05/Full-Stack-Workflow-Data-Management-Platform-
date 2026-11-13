import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  assertSafeDatabase,
  extractDatabaseName,
} from "../src/utils/dbGuard.js";
import { runPerformanceBenchmark } from "../../scripts/run-perf.js";

describe("Data Safety & Database Protection Guard", () => {
  it("extracts database name accurately from various MongoDB URI formats", () => {
    expect(
      extractDatabaseName("mongodb://127.0.0.1:27017/workflow_platform"),
    ).toBe("workflow_platform");
    expect(
      extractDatabaseName(
        "mongodb://localhost:27017/workflow_platform_perf?retryWrites=true",
      ),
    ).toBe("workflow_platform_perf");
    expect(
      extractDatabaseName(
        "mongodb+srv://user:pass@cluster0.abc.mongodb.net/workflow_platform_test?appName=test",
      ),
    ).toBe("workflow_platform_test");
  });

  it("enforces strict allowlist: blocks any database not ending in _perf or _test", () => {
    const disallowedUris = [
      "mongodb://127.0.0.1:27017/workflow_platform",
      "mongodb://localhost:27017/workflow_platform?replicaSet=rs0",
      "mongodb://127.0.0.1:27017/workflow_platform_prod",
      "mongodb+srv://admin:secret@cluster0.mongodb.net/workflow_platform_production",
      "mongodb://127.0.0.1:27017/random_app_db",
      "mongodb://127.0.0.1:27017/analytics",
    ];

    for (const uri of disallowedUris) {
      expect(() => assertSafeDatabase(uri, "load test")).toThrowError(
        /\[DATA SAFETY GUARD\] BLOCKED: Refusing to run load test against database/i,
      );
    }
  });

  it("permits only safe isolated databases ending in _perf or _test", () => {
    const allowedUris = [
      "mongodb://127.0.0.1:27017/workflow_platform_perf",
      "mongodb://127.0.0.1:27017/workflow_platform_test",
      "mongodb://127.0.0.1:27017/my_app_perf",
      "mongodb://127.0.0.1:27017/staging_test",
    ];

    for (const uri of allowedUris) {
      expect(() =>
        assertSafeDatabase(uri, "performance benchmark"),
      ).not.toThrow();
      expect(typeof assertSafeDatabase(uri)).toBe("string");
    }
  });

  it("runPerformanceBenchmark immediately throws before connecting or binding if target is workflow_platform", async () => {
    await expect(
      runPerformanceBenchmark({
        mongoUri: "mongodb://127.0.0.1:27017/workflow_platform",
        iterations: 1,
      }),
    ).rejects.toThrowError(
      /Refusing to run performance benchmark against database "workflow_platform"/i,
    );
  });

  it("runPerformanceBenchmark starts its OWN server instance on a non-4000 port and isolates execution", async () => {
    const memoryUri =
      mongoose.connection._connectionString ||
      mongoose.connection.client?.s?.url;
    const res = await runPerformanceBenchmark({
      mongoUri: "mongodb://127.0.0.1:27017/workflow_platform_perf",
      iterations: 3,
      concurrency: 1,
    });

    expect(res.database).toBe("workflow_platform_perf");
    expect(typeof res.serverPort).toBe("number");
    expect(res.serverPort).toBeGreaterThan(0);
    expect(res.serverPort).not.toBe(4000);
    expect(res.totalRequests).toBe(3);

    // Restore test mongoose connection for suite teardown
    if (memoryUri) {
      await mongoose.connect(memoryUri);
    }
  });
});
