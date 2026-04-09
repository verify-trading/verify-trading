// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSearchParams = new URLSearchParams("reset=success");

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
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
}));

vi.mock("@/components/auth/google-oauth-button", () => ({
  GoogleOAuthButton: () => <button type="button">Google</button>,
}));

vi.mock("@/components/auth/auth-divider", () => ({
  AuthDivider: () => <div>divider</div>,
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  useSupabaseAuth: () => ({
    supabase: {
      auth: {
        signInWithPassword: vi.fn(),
        signInWithOAuth: vi.fn(),
      },
    },
    user: null,
    session: null,
    ready: true,
    isSignedIn: false,
  }),
}));

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    mockSearchParams.set("reset", "success");
  });

  it("shows a reset success message on return from password update", () => {
    render(<LoginPage />);

    expect(screen.getByText("Password updated. Sign in with your new password.")).toBeInTheDocument();
  });
});
