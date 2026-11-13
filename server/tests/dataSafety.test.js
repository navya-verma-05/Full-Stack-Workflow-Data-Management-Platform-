import { describe, expect, it } from "vitest";
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

  it("blocks and rejects any execution targeting workflow_platform with a clear error", () => {
    const dangerousUris = [
      "mongodb://127.0.0.1:27017/workflow_platform",
      "mongodb://localhost:27017/workflow_platform?replicaSet=rs0",
      "mongodb://127.0.0.1:27017/workflow_platform_prod",
      "mongodb+srv://admin:secret@cluster0.mongodb.net/workflow_platform_production",
    ];

    for (const uri of dangerousUris) {
      expect(() => assertSafeDatabase(uri, "load test")).toThrowError(
        /\[DATA SAFETY GUARD\] BLOCKED: Refusing to run load test against primary database/i,
      );
    }
  });

  it("permits safe isolated databases such as workflow_platform_perf and workflow_platform_test", () => {
    const safeUris = [
      "mongodb://127.0.0.1:27017/workflow_platform_perf",
      "mongodb://127.0.0.1:27017/workflow_platform_test",
      "mongodb://127.0.0.1:27017/isolated_benchmark_db",
    ];

    for (const uri of safeUris) {
      expect(() =>
        assertSafeDatabase(uri, "performance benchmark"),
      ).not.toThrow();
      expect(typeof assertSafeDatabase(uri)).toBe("string");
    }
  });

  it("runPerformanceBenchmark immediately throws before connecting if target is workflow_platform", async () => {
    await expect(
      runPerformanceBenchmark({
        mongoUri: "mongodb://127.0.0.1:27017/workflow_platform",
        iterations: 1,
      }),
    ).rejects.toThrowError(
      /Refusing to run performance benchmark against primary database "workflow_platform"/i,
    );
  });
});
