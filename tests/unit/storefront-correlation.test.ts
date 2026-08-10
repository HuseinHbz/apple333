import { describe, expect, it } from "vitest";

import { requestId } from "@/server/api/response";
import { correlateStoreRequest } from "@/server/storefront/correlation";

describe("storefront request correlation", () => {
  it("preserves framework request identity and pins one generated request ID", () => {
    const request = new Request("http://localhost/api/store/orders");

    expect(correlateStoreRequest(request)).toBe(request);
    const first = requestId(request);

    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requestId(request)).toBe(first);
  });

  it("preserves a valid caller-supplied request ID", () => {
    const request = new Request("http://localhost/api/store/orders", {
      headers: { "x-request-id": "phase07-request-1234" },
    });

    expect(correlateStoreRequest(request)).toBe(request);
    expect(requestId(request)).toBe("phase07-request-1234");
  });
});
