// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/ask";
let mockAuthState: {
  supabase: {
    from: ReturnType<typeof vi.fn>;
  } | null;
  user: { id: string; last_sign_in_at?: string | null } | null;
  ready: boolean;
  isSignedIn: boolean;
};

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  useSupabaseAuth: () => mockAuthState,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { OnboardingCallBanner } from "@/components/site/onboarding-call-banner";

function renderBanner() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OnboardingCallBanner />
    </QueryClientProvider>,
  );
}

function createSupabaseMock(profile: {
  tier: string;
  created_at: string;
  preferences: Record<string, unknown> | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const from = vi.fn().mockReturnValue({ select, update });

  return {
    supabase: { from },
    maybeSingle,
    updateEq,
  };
}

describe("OnboardingCallBanner", () => {
  beforeEach(() => {
    mockPathname = "/ask";
    window.sessionStorage.clear();
    process.env.NEXT_PUBLIC_ONBOARDING_CALL_URL = "https://calendly.com/test/onboarding";
  });

  afterEach(() => {
    cleanup();
  });

  it("shows for free users inside the first seven days", async () => {
    const { supabase } = createSupabaseMock({
      tier: "free",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      preferences: null,
    });

    mockAuthState = {
      supabase,
      user: { id: "user-1", last_sign_in_at: "2026-04-11T10:00:00.000Z" },
      ready: true,
      isSignedIn: true,
    };

    renderBanner();

    expect(
      await screen.findByText(/Book your free onboarding call — 10 minutes with an expert trader/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Book now/i })).toHaveAttribute(
      "href",
      "https://calendly.com/test/onboarding",
    );
  });

  it("hides once the account is older than seven days", async () => {
    const { maybeSingle, supabase } = createSupabaseMock({
      tier: "free",
      created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      preferences: null,
    });

    mockAuthState = {
      supabase,
      user: { id: "user-1", last_sign_in_at: "2026-04-11T10:00:00.000Z" },
      ready: true,
      isSignedIn: true,
    };

    renderBanner();

    await waitFor(() => expect(maybeSingle).toHaveBeenCalled());
    expect(
      screen.queryByText(/Book your free onboarding call — 10 minutes with an expert trader/i),
    ).not.toBeInTheDocument();
  });

  it("persists dismissal tracking and hides for the current login", async () => {
    const { supabase, updateEq } = createSupabaseMock({
      tier: "free",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      preferences: { theme: "dark" },
    });

    mockAuthState = {
      supabase,
      user: { id: "user-1", last_sign_in_at: "2026-04-11T10:00:00.000Z" },
      ready: true,
      isSignedIn: true,
    };

    renderBanner();

    fireEvent.click(await screen.findByRole("button", { name: /dismiss onboarding banner/i }));

    await waitFor(() => expect(updateEq).toHaveBeenCalledWith("id", "user-1"));
    expect(
      screen.queryByText(/Book your free onboarding call — 10 minutes with an expert trader/i),
    ).not.toBeInTheDocument();
    expect(
      window.sessionStorage.getItem("vt:onboarding-call-banner:user-1:2026-04-11T10:00:00.000Z"),
    ).toBe("1");
  });
});
