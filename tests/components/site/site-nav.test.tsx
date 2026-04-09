// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/ask";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  useSupabaseAuth: () => ({
    ready: true,
    isSignedIn: true,
  }),
}));

vi.mock("@/components/auth/user-menu", () => ({
  UserMenu: () => <div>user-menu</div>,
}));

vi.mock("@/components/site/logo", () => ({
  Logo: () => <div>logo</div>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { SiteNav } from "@/components/site/site-nav";

describe("SiteNav", () => {
  beforeEach(() => {
    mockPathname = "/ask";
  });

  it("hides app navigation on the password reset page", () => {
    mockPathname = "/auth/update-password";

    render(<SiteNav />);

    expect(screen.queryByText("Ask")).not.toBeInTheDocument();
    expect(screen.queryByText("Markets")).not.toBeInTheDocument();
    expect(screen.getAllByText("logo")).toHaveLength(2);
  });
});
