"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

// Flip to `true` once Supabase SMTP is configured and magic-link delivery
// is reliable. Until then we rely on Google OAuth + password only.
const EMAIL_LOGIN_ENABLED = false;

export function LoginForm() {
  const search = useSearchParams();
  const router = useRouter();
  const redirect = search.get("redirect") ?? "/";
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pwEmail, setPwEmail] = useState("");
  const [pwPassword, setPwPassword] = useState("");

  const callbackUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(redirect)}`;

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (error) setError(error.message);
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: pwEmail,
      password: pwPassword,
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(redirect);
    router.refresh();
  }

  if (sent) {
    return (
      <div className="rounded-lg border p-6 text-sm">
        Poslali sme ti magic link na <b>{email}</b>. Otvor mail a klikni naň.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={signInWithGoogle} variant="outline" className="w-full">
        Prihlásiť cez Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            alebo heslom
          </span>
        </div>
      </div>

      <form onSubmit={signInWithPassword} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="pw-email">Email</Label>
          <Input
            id="pw-email"
            type="email"
            autoComplete="email"
            value={pwEmail}
            onChange={(e) => setPwEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pw-password">Heslo</Label>
          <Input
            id="pw-password"
            type="password"
            autoComplete="current-password"
            value={pwPassword}
            onChange={(e) => setPwPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Prihlasujem…" : "Prihlásiť heslom"}
        </Button>
      </form>

      {EMAIL_LOGIN_ENABLED && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                alebo magic link
              </span>
            </div>
          </div>

          <form onSubmit={signInWithEmail} className="space-y-3">
            <Input
              type="email"
              placeholder="ty@tvoj-email.sk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={pending}
            >
              {pending ? "Posielam…" : "Poslať magic link"}
            </Button>
          </form>
        </>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
