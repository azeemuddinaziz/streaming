// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountForm } from "./AccountForm";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const signIn = vi.fn();
const signUp = vi.fn();
vi.mock("@/lib/api-client", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  signUp: (...args: unknown[]) => signUp(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  signIn.mockResolvedValue({ ok: true });
  signUp.mockResolvedValue({ ok: true });
});

describe("AccountForm", () => {
  it("goes to the return address after signing in", async () => {
    const user = userEvent.setup();
    render(<AccountForm mode="sign-in" next="/watch/abc?t=5" />);
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/watch/abc?t=5"));
    expect(refresh).toHaveBeenCalled();
  });

  it("goes home when there is no return address", async () => {
    const user = userEvent.setup();
    render(<AccountForm mode="sign-in" />);
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("shows an invalid account name inline and sends nothing", async () => {
    const user = userEvent.setup();
    render(<AccountForm mode="sign-up" next="/studio" />);
    await user.type(screen.getByLabelText("Account name"), "ab");
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Password"), "longenough");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Use at least 3 characters.")).toBeTruthy();
    expect(screen.getByLabelText("Account name").getAttribute("aria-invalid")).toBe("true");
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the API's refusal and keeps the person here", async () => {
    signIn.mockResolvedValue({ ok: false, message: "Wrong email or password." });
    const user = userEvent.setup();
    render(<AccountForm mode="sign-in" next="/studio" />);
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Wrong email or password.");
    expect(push).not.toHaveBeenCalled();
  });

  it("toggles the password between hidden and shown", async () => {
    const user = userEvent.setup();
    render(<AccountForm mode="sign-in" />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.type).toBe("text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.type).toBe("password");
  });
});
