"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { signIn, signUp } from "@/lib/api-client";
import { safeNext } from "@/lib/return-address";
import { checkAccountName, checkEmail, checkPassword } from "@/lib/account-fields";

type Field = "name" | "email" | "password";

// `next` is already a safe same-origin path (see `safeNext`): where to go once
// the person is signed in.
export function AccountForm({ mode, next = "/" }: { mode: "sign-up" | "sign-in"; next?: string }) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Move keyboard focus to a refusal from the server so it is not missed.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function check(field: Field, value: string): string | undefined {
    if (field === "name") return checkAccountName(value);
    if (field === "email") return checkEmail(value);
    return checkPassword(value, mode);
  }

  function validate(field: Field, value: string) {
    setFieldErrors((current) => ({ ...current, [field]: check(field, value) }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email"));
    const password = String(data.get("password"));

    const values: Record<Field, string> = { name, email, password };
    const shown: Field[] = isSignUp ? ["name", "email", "password"] : ["email", "password"];
    const errors: Partial<Record<Field, string>> = {};
    for (const field of shown) errors[field] = check(field, values[field]);
    setFieldErrors(errors);
    const firstInvalid = shown.find((field) => errors[field]);
    if (firstInvalid) {
      setError(undefined);
      const element = form.elements.namedItem(firstInvalid);
      if (element instanceof HTMLElement) element.focus();
      return;
    }

    setPending(true);
    setError(undefined);
    const result = isSignUp ? await signUp({ name, email, password }) : await signIn({ email, password });

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    router.push(safeNext(next));
    router.refresh();
  }

  const describedBy = (field: Field, hint?: string) =>
    [fieldErrors[field] ? `${field}-error` : undefined, hint].filter(Boolean).join(" ") || undefined;

  return (
    <form className="grid gap-5" onSubmit={onSubmit} aria-busy={pending} noValidate>
      {error && (
        <p
          role="alert"
          tabIndex={-1}
          ref={errorRef}
          className="rounded-md border border-destructive bg-card p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {isSignUp && (
        <div className="grid gap-2">
          <Label htmlFor="name">Account name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={30}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={describedBy("name", "name-hint")}
            onBlur={(e) => validate("name", e.currentTarget.value)}
          />
          {fieldErrors.name && (
            <p id="name-error" className="text-sm text-destructive">
              {fieldErrors.name}
            </p>
          )}
          <p className="text-sm text-muted-foreground" id="name-hint">
            3 to 30 letters, digits and hyphens, not starting or ending with a hyphen. It names your channel and cannot be changed later.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete={isSignUp ? "email" : "username"}
          required
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={describedBy("email")}
          onBlur={(e) => validate("email", e.currentTarget.value)}
        />
        {fieldErrors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="flex gap-2">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            maxLength={128}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={describedBy("password", isSignUp ? "password-hint" : undefined)}
            onBlur={(e) => validate("password", e.currentTarget.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((shown) => !shown)}
          >
            {showPassword ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
          </Button>
        </div>
        {fieldErrors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {fieldErrors.password}
          </p>
        )}
        {isSignUp && (
          <p className="text-sm text-muted-foreground" id="password-hint">
            At least 8 characters.
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Spinner />}
        {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
