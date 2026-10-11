// Inline checks for the account screens, mirroring the API's rules in
// AuthService so a mistake is shown beside its field before anything is sent.
// The API stays the authority; its refusals are still shown.

export function checkAccountName(name: string): string | undefined {
  if (name === "") return "Enter an account name.";
  if (name.length < 3) return "Use at least 3 characters.";
  if (name.length > 30) return "Use at most 30 characters.";
  if (!/^[A-Za-z0-9-]+$/.test(name)) return "Use only letters, digits and hyphens.";
  if (name.startsWith("-") || name.endsWith("-")) {
    return "A hyphen cannot start or end the name.";
  }
  if (name.includes("--")) return "Do not put two hyphens in a row.";
  return undefined;
}

export function checkEmail(email: string): string | undefined {
  if (email.trim() === "") return "Enter your email.";
  if (!/^\S+@\S+$/.test(email.trim())) return "Enter a valid email address.";
  return undefined;
}

export function checkPassword(password: string, mode: "sign-in" | "sign-up"): string | undefined {
  if (password === "") return "Enter your password.";
  if (mode === "sign-up" && password.length < 8) return "Use at least 8 characters.";
  return undefined;
}
