// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();
const mockRefresh = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();
const mockSearchParams = new URLSearchParams("next=/markets");

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key),
  }),
}));

vi.mock("@/components/auth/auth-shell", () => ({
  AuthShell: ({
    children,
    title,
    subtitle,
  }: {
    children: ReactNode;
    title: string;
    subtitle?: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </div>
  ),
  AuthShellSpinner: () => <div>Loading…</div>,
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  useSupabaseAuth: () => ({
    supabase: {
      auth: {
        updateUser: mockUpdateUser,
        signOut: mockSignOut,
      },
    },
    user: {
      id: "user-1",
      email: "reset@example.com",
    },
    session: null,
    ready: true,
    isSignedIn: true,
  }),
}));

import UpdatePasswordPage from "@/app/auth/update-password/page";

describe("UpdatePasswordPage", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockUpdateUser.mockReset();
    mockSignOut.mockReset();

    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("ends the recovery session and redirects to login after a successful reset", async () => {
    const user = userEvent.setup();

    render(<UpdatePasswordPage />);

    await user.type(screen.getByLabelText("New password"), "new-password-123");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password-123");
    await user.click(screen.getByRole("button", { name: "Save new password" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "new-password-123" });
    });
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login?reset=success&next=%2Fmarkets");
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
