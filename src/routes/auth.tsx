import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import brandLogo from "@/assets/sunny-stays-hurghada-logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Gastgeber-Login — Sunny Stays Hurghada" },
      { name: "description", content: "Interner Zugang für die Gastgeber von Sunny Stays Hurghada." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Gastgeber-Login — Sunny Stays Hurghada" },
      { property: "og:description", content: "Interner Zugang für die Gastgeber." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!email || password.length < 8) {
      toast.error("Bitte E-Mail und ein Passwort mit mindestens 8 Zeichen eingeben.");
      return;
    }
    setPending(true);
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/admin` },
          });
    setPending(false);

    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    if (!result.data.session) {
      toast.success("Bitte bestätige zuerst die E-Mail, die wir dir geschickt haben.");
      return;
    }
    void navigate({ to: "/admin", replace: true });
  };

  return (
    <main className="min-h-screen bg-sand flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={brandLogo} alt="Sunny Stays Hurghada" className="h-20 w-auto" />
        </div>
        <div className="bg-card rounded-3xl border border-forest/10 shadow-[0_10px_30px_-12px_rgb(23_59_99_/_0.15)] p-8">
          <span className="block text-[10px] uppercase tracking-[0.3em] text-gold font-medium mb-2">
            Intern
          </span>
          <h1 className="font-display text-2xl text-forest mb-6">
            {mode === "signin" ? "Gastgeber-Login" : "Zugang einrichten"}
          </h1>
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="E-Mail"
              className="w-full bg-card p-4 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
            />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="Passwort"
              className="w-full bg-card p-4 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-forest text-sand py-4 rounded-xl text-xs uppercase tracking-[0.25em] font-bold hover:bg-gold hover:text-forest transition-colors disabled:opacity-60"
            >
              {pending ? "Bitte warten…" : mode === "signin" ? "Anmelden" : "Registrieren"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-5 w-full text-center text-[11px] uppercase tracking-widest text-forest/55 hover:text-gold transition-colors"
          >
            {mode === "signin" ? "Noch keinen Zugang? Registrieren" : "Zurück zum Login"}
          </button>
        </div>
      </div>
    </main>
  );
}
