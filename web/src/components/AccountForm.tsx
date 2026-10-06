"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signIn, signUp } from "@/lib/api-client";

export function AccountForm({ mode }: { mode: "sign-up" | "sign-in" }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const isSignUp = mode === "sign-up";

  // Move keyboard focus to a refusal from the server so it is not missed.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const result = isSignUp
      ? await signUp({ name: String(data.get("name")), email, password })
      : await signIn({ email, password });

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form className="form" onSubmit={onSubmit} aria-busy={pending}>
      {error && (
        <p className="form-error" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </p>
      )}

      {isSignUp && (
        <div className="field">
          <label htmlFor="name">Account name</label>
          <input
            id="name"
            name="name"
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*"
            aria-describedby="name-hint"
          />
          <p className="hint" id="name-hint">
            3 to 30 letters and digits, with single hyphens between them. It
            names your channel and cannot be changed later.
          </p>
        </div>
      )}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          minLength={isSignUp ? 8 : undefined}
          maxLength={128}
          aria-describedby={isSignUp ? "password-hint" : undefined}
        />
        {isSignUp && (
          <p className="hint" id="password-hint">
            At least 8 characters.
          </p>
        )}
      </div>

      <button className="button" type="submit" disabled={pending}>
        {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
