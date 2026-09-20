import { describe, expect, it } from "vitest";
import { connectDatabase, DatabaseError } from "./database";

describe("connectDatabase", () => {
  it("reports an actionable configuration error when MONGO_URI is missing", async () => {
    await expect(connectDatabase()).rejects.toBeInstanceOf(DatabaseError);
    await expect(connectDatabase()).rejects.toThrow("MONGO_URI");
  });
});
