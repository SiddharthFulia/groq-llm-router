import { describe, expect, it, vi } from "vitest";
import { backoffDelay, withRetry } from "../src/client/retry.js";

describe("backoffDelay", () => {
  it("scales exponentially up to the cap", () => {
    const random = () => 1; // worst-case jitter
    expect(backoffDelay(1, 100, 10_000, random)).toBe(99);
    expect(backoffDelay(2, 100, 10_000, random)).toBe(199);
    expect(backoffDelay(3, 100, 10_000, random)).toBe(399);
    expect(backoffDelay(4, 100, 10_000, random)).toBe(799);
  });

  it("respects the cap", () => {
    expect(backoffDelay(20, 100, 500, () => 1)).toBeLessThanOrEqual(499);
  });

  it("uses jitter — small random gives small delay", () => {
    expect(backoffDelay(5, 100, 10_000, () => 0.0)).toBe(0);
    expect(backoffDelay(5, 100, 10_000, () => 0.5)).toBe(800);
  });
});

describe("withRetry", () => {
  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const res = await withRetry(fn, () => true, { sleep: async () => {} });
    expect(res).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries until success", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("net"))
      .mockRejectedValueOnce(new Error("net"))
      .mockResolvedValueOnce("ok");
    const res = await withRetry(fn, () => true, {
      attempts: 5,
      sleep: async () => {},
    });
    expect(res).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("bails when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fatal"));
    await expect(
      withRetry(fn, () => false, { sleep: async () => {} }),
    ).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after the attempts cap", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("net"));
    await expect(
      withRetry(fn, () => true, { attempts: 3, sleep: async () => {} }),
    ).rejects.toThrow("net");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls sleep between attempts with monotonically larger delays", async () => {
    const sleeps: number[] = [];
    const sleep = async (ms: number): Promise<void> => {
      sleeps.push(ms);
    };
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("a"))
      .mockRejectedValueOnce(new Error("b"))
      .mockResolvedValueOnce("ok");
    await withRetry(fn, () => true, {
      attempts: 5,
      baseMs: 100,
      capMs: 10_000,
      random: () => 1,
      sleep,
    });
    expect(sleeps).toHaveLength(2);
    expect(sleeps[0]).toBeLessThan(sleeps[1]!);
  });
});
