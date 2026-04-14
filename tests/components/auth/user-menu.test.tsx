// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignOut = vi.fn();
const mockFrom = vi.fn();
let mockPathname = "/ask";

const mockUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "trader@example.com",
} as User;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => mockPathname,
}));

vi.mock("@radix-ui/react-dropdown-menu", () => {
  function Root({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }

  function Trigger({ children, asChild }: { children: ReactNode; asChild?: boolean }) {
    if (asChild) {
      return children;
    }

    return <button type="button">{children}</button>;
  }

  function Portal({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }

  function Content(props: ComponentPropsWithoutRef<"div">) {
    return <div {...props} />;
  }

  function Item(props: ComponentPropsWithoutRef<"button"> & { onSelect?: (event: Event) => void }) {
    const { children, onSelect, ...rest } = props;

    return (
      <button
        type="button"
        {...rest}
        onClick={() => {
          onSelect?.(new Event("select"));
        }}
      >
        {children}
      </button>
    );
  }

  return {
    Root,
    Trigger,
    Portal,
    Content,
    Item,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  useSupabaseAuth: () => ({
    supabase: {
      from: mockFrom,
      auth: {
        signOut: mockSignOut,
      },
    },
    user: mockUser,
    session: null,
    ready: true,
    isSignedIn: true,
  }),
}));

import { UserMenu } from "@/components/auth/user-menu";

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);

  return builder;
}

describe("UserMenu", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRefresh.mockReset();
    mockSignOut.mockReset();
    mockFrom.mockReset();
    mockPathname = "/ask";

    const profileBuilder = createQueryBuilder({
      data: {
        display_name: "Alice Trader",
        username: "alicet",
        tier: "free",
      },
      error: null,
    });
    const usageBuilder = createQueryBuilder({
      data: {
        query_count: 3,
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profileBuilder;
      }
      if (table === "usage_limits") {
        return usageBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("shows the daily free usage progress in the dropdown", async () => {
    renderWithQueryClient(<UserMenu />);

    await waitFor(() => {
      expect(screen.getByText("Daily message usage")).toBeInTheDocument();
    });

    expect(screen.getByText("3/10")).toBeInTheDocument();
    expect(screen.getByText("7 free messages left today.")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Daily message usage" })).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
  });

  it("links Upgrade to Pro to the pricing page", async () => {
    renderWithQueryClient(<UserMenu />);

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /upgrade to pro/i }).length).toBeGreaterThan(0);
    });

    for (const link of screen.getAllByRole("link", { name: /upgrade to pro/i })) {
      expect(link).toHaveAttribute("href", "/pricing");
    }
  });

  it("hides account chrome on the password reset page", () => {
    mockPathname = "/auth/update-password";

    const { container } = renderWithQueryClient(<UserMenu />);

    expect(container).toBeEmptyDOMElement();
  });
});
