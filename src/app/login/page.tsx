import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Pushnik</h1>
          <p className="text-sm text-muted-foreground">
            Prihlás sa a makaj. Alebo zmrzni – sme tu, aby sme ti nedali pokoj.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
