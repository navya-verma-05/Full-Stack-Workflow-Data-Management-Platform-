import { describe, expect, it } from "vitest";
import {
  computeSourceBannerInfo,
  detectIncidentBands,
} from "../pages/OverviewPage";

describe("Source Attention Banner Computation", () => {
  it("shows calm green All sources healthy state when no sources meet the qualifying threshold", () => {
    // 3 sources with minor transient failures below 15% and below 10 failures
    const bySource = [
      {
        sourceId: "src-1",
        sourceName: "Web Form Leads",
        total: 100,
        processed: 97,
        failed: 2,
        dead_letter: 1, // 3% failures, 3 total failures (< 10)
      },
      {
        sourceId: "src-2",
        sourceName: "CRM Deals",
        total: 80,
        processed: 78,
        failed: 1,
        dead_letter: 1, // 2.5% failures, 2 total failures (< 10)
      },
      {
        sourceId: "src-3",
        sourceName: "Partner Ingest",
        total: 50,
        processed: 48,
        failed: 2,
        dead_letter: 0, // 4% failures, 2 total failures (< 10)
      },
    ];

    const banner = computeSourceBannerInfo(bySource);
    expect(banner).not.toBeNull();
    expect(banner?.healthy).toBe(true);
    expect(banner?.text).toMatch(/All sources healthy/i);
  });

  it("identifies a single qualifying source (>15% failure share or >=10 failures) and reports its count and rate", () => {
    const bySource = [
      {
        sourceId: "src-1",
        sourceName: "Web Form Leads",
        total: 100,
        processed: 98,
        failed: 2,
        dead_letter: 0, // 2% (< 15% and < 10) -> does NOT qualify
      },
      {
        sourceId: "src-2",
        sourceName: "Partner Orders",
        total: 100,
        processed: 72,
        failed: 18,
        dead_letter: 10, // 28 failures (28%) -> QUALIFIES
      },
    ];

    const banner = computeSourceBannerInfo(bySource);
    expect(banner).not.toBeNull();
    expect(banner?.healthy).toBe(false);
    expect(banner?.text).toContain("1 source needs attention");
    expect(banner?.text).toContain("Partner Orders");
    expect(banner?.text).toContain("28 failed or dead-letter events");
    expect(banner?.text).toContain("28% failure rate");
  });

  it("names multiple qualifying sources and highlights the worst one with its count and share", () => {
    const bySource = [
      {
        sourceId: "src-1",
        sourceName: "CRM Deals",
        total: 50,
        processed: 40,
        failed: 7,
        dead_letter: 3, // 10 failures, 20% -> QUALIFIES
      },
      {
        sourceId: "src-2",
        sourceName: "Partner Orders",
        total: 100,
        processed: 60,
        failed: 25,
        dead_letter: 15, // 40 failures, 40% -> WORST
      },
    ];

    const banner = computeSourceBannerInfo(bySource);
    expect(banner?.healthy).toBe(false);
    expect(banner?.text).toContain("2 sources need attention");
    expect(banner?.text).toContain("CRM Deals");
    expect(banner?.text).toContain("Partner Orders");
    expect(banner?.text).toContain(
      "worst is Partner Orders with 40 failed or dead-letter events (40% failure rate)",
    );
  });
});

describe("Incident Detector Algorithm (detectIncidentBands)", () => {
  it("case 1: detects no incident when data is healthy across all days", () => {
    const buckets = [
      {
        bucket: "2026-11-01",
        total: 50,
        processed: 49,
        failed: 1,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-02",
        total: 45,
        processed: 44,
        failed: 1,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-03",
        total: 55,
        processed: 53,
        failed: 2,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-04",
        total: 60,
        processed: 59,
        failed: 1,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-05",
        total: 52,
        processed: 51,
        failed: 1,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-06",
        total: 48,
        processed: 47,
        failed: 1,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-07",
        total: 50,
        processed: 50,
        failed: 0,
        dead_letter: 0,
      },
    ];

    const bands = detectIncidentBands(buckets, "Partner Orders");
    expect(bands).toEqual([]);
  });

  it("case 2: detects a single multi-day incident spike and names top failure source", () => {
    const buckets = [
      {
        bucket: "2026-11-01",
        total: 30,
        processed: 30,
        failed: 0,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-02",
        total: 32,
        processed: 31,
        failed: 1,
        dead_letter: 0,
      },
      // Spike on 3-4 Nov
      {
        bucket: "2026-11-03",
        total: 30,
        processed: 10,
        failed: 12,
        dead_letter: 8,
      }, // 66.7%
      {
        bucket: "2026-11-04",
        total: 35,
        processed: 15,
        failed: 11,
        dead_letter: 9,
      }, // 57.1%
      // Recovery
      {
        bucket: "2026-11-05",
        total: 30,
        processed: 29,
        failed: 1,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-06",
        total: 28,
        processed: 28,
        failed: 0,
        dead_letter: 0,
      },
    ];

    const bands = detectIncidentBands(buckets, "Partner Orders");
    expect(bands.length).toBe(1);
    expect(bands[0].start).toBe("2026-11-03");
    expect(bands[0].end).toBe("2026-11-04");
    expect(bands[0].totalFailures).toBe(40);
    expect(bands[0].label).toContain("Incident: 3-4 Nov (Partner Orders)");
  });

  it("case 3: detects two separate spikes separated by a recovery window", () => {
    const buckets = [
      // Spike 1: 1-2 Nov
      {
        bucket: "2026-11-01",
        total: 25,
        processed: 10,
        failed: 9,
        dead_letter: 6,
      }, // 60%
      {
        bucket: "2026-11-02",
        total: 24,
        processed: 11,
        failed: 8,
        dead_letter: 5,
      }, // 54%
      // Calm: 3-5 Nov
      {
        bucket: "2026-11-03",
        total: 28,
        processed: 28,
        failed: 0,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-04",
        total: 30,
        processed: 29,
        failed: 1,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-05",
        total: 27,
        processed: 27,
        failed: 0,
        dead_letter: 0,
      },
      // Spike 2: 6-7 Nov
      {
        bucket: "2026-11-06",
        total: 26,
        processed: 12,
        failed: 8,
        dead_letter: 6,
      }, // 53%
      {
        bucket: "2026-11-07",
        total: 25,
        processed: 10,
        failed: 9,
        dead_letter: 6,
      }, // 60%
      // Calm: 8 Nov
      {
        bucket: "2026-11-08",
        total: 25,
        processed: 25,
        failed: 0,
        dead_letter: 0,
      },
    ];

    const bands = detectIncidentBands(buckets, "Wholesale API");
    expect(bands.length).toBe(2);

    expect(bands[0].start).toBe("2026-11-01");
    expect(bands[0].end).toBe("2026-11-02");
    expect(bands[0].label).toContain("Incident: 1-2 Nov (Wholesale API)");

    expect(bands[1].start).toBe("2026-11-06");
    expect(bands[1].end).toBe("2026-11-07");
    expect(bands[1].label).toContain("Incident: 6-7 Nov (Wholesale API)");
  });

  it("case 4: ignores sparse data and drops single-day anomalies with fewer than 5 events", () => {
    // Empty array or single day
    expect(detectIncidentBands([], "Partner Orders")).toEqual([]);
    expect(
      detectIncidentBands(
        [{ bucket: "2026-11-01", total: 10, failed: 8, dead_letter: 0 }],
        "Partner Orders",
      ),
    ).toEqual([]);

    // Single day spike with only 3 total events (e.g. 2 failures out of 3 total: 66%) -> dropped (< 5 events)
    const sparseBuckets = [
      {
        bucket: "2026-11-01",
        total: 2,
        processed: 2,
        failed: 0,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-02",
        total: 3,
        processed: 1,
        failed: 2,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-03",
        total: 2,
        processed: 2,
        failed: 0,
        dead_letter: 0,
      },
      {
        bucket: "2026-11-04",
        total: 3,
        processed: 3,
        failed: 0,
        dead_letter: 0,
      },
    ];
    expect(detectIncidentBands(sparseBuckets, "Partner Orders")).toEqual([]);
  });
});
