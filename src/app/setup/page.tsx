export const dynamic = "force-dynamic";

export default function SetupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl space-y-4 rounded-lg border p-6">
        <h1 className="text-2xl font-bold">Pushnik nie je nakonfigurovaný</h1>
        <p className="text-sm text-muted-foreground">
          Chýbajú environment variables. Otvor Vercel → tvoj projekt →
          <b> Settings → Environment Variables</b> a pridaj tieto dve (pre
          všetky environments):
        </p>
        <ul className="space-y-1 rounded-md border bg-muted/30 p-3 font-mono text-xs">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Hodnoty nájdeš v Supabase Dashboard → tvoj projekt →{" "}
          <b>Project Settings → API</b> (Project URL + anon/public key). Po
          pridaní sprav v Vercel <b>Deployments → ⋯ → Redeploy</b>.
        </p>
      </div>
    </main>
  );
}
