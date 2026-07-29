import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/broker/metaapi", () => ({
  searchServers: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from "@/app/api/broker/servers/route";
import { getSessionUser } from "@/lib/auth/session";
import { searchServers } from "@/lib/broker/metaapi";

import { mockAdmin, mockSession } from "./harness";

/** The route never queries the admin client — it only has to exist for the Pro gate. */
function signIn(tier: string | null = "pro") {
  mockSession(tier);
  mockAdmin({});
}

function serversRequest(query: string) {
  return new Request(`http://localhost/api/broker/servers?${query}`);
}

describe("GET /api/broker/servers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s a signed-out caller", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null as never);

    const response = await GET(serversRequest("platform=mt5&query=icmarkets"));

    expect(response.status).toBe(401);
  });

  it("403s a free trader", async () => {
    signIn("free");

    const response = await GET(serversRequest("platform=mt5&query=icmarkets"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "broker_pro_required",
      message: "Broker sync is a Pro feature.",
    });
  });

  it("rejects an unknown platform", async () => {
    const response = await GET(serversRequest("platform=ctrader&query=icmarkets"));

    expect(response.status).toBe(400);
  });

  it("answers a one-letter search without calling MetaApi", async () => {
    signIn();

    const response = await GET(serversRequest("platform=mt5&query=i"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ servers: [] });
    expect(searchServers).not.toHaveBeenCalled();
  });

  it("returns the server names for a real search", async () => {
    signIn();
    vi.mocked(searchServers).mockResolvedValue(["ICMarketsSC-MT5", "ICMarketsSC-Demo"]);

    const response = await GET(serversRequest("platform=mt5&query=icmarkets"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ servers: ["ICMarketsSC-MT5", "ICMarketsSC-Demo"] });
    expect(searchServers).toHaveBeenCalledWith("mt5", "icmarkets");
  });
});
