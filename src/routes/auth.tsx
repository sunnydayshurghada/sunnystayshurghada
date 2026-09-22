import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import brandLogo from "@/assets/sunny-stays-hurghada-logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Gastgeber-Login — Sunny Stays Hurghada" },
      {
        name: "description",
        content: "Interner Zugang für die Gastgeber von Sunny Stays Hurghada.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Gastgeber-Login — Sunny Stays Hurghada" },
      { property: "og:description", content: "Interner Zugang für die Gastgeber." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "forgot" | "update";

function AuthPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dir = i18n.language.startsWith("ar") ? "rtl" : "ltr";
  const [mode, setMode] = useState<Mode>("signin");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    void supabase.auth.getSession().then(({ data }) => {
      const isRecovery =
        typeof window !== "undefined" &&
        (window.location.hash.includes("type=recovery") ||
          window.location.search.includes("type=recovery"));
      if (isRecovery) {
        setMode("update");
        return;
      }
      if (data.session) void navigate({ to: "/admin", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    if (mode === "forgot") {
      if (!email) {
        toast.error(t("auth.toast.need_email"));
        return;
      }
      setPending(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      setPending(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("auth.toast.reset_sent"));
      setMode("signin");
      return;
    }

    if (mode === "update") {
      if (password.length < 8) {
        toast.error(t("auth.toast.password_min"));
        return;
      }
      setPending(true);
      const { error } = await supabase.auth.updateUser({ password });
      setPending(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("auth.toast.password_saved"));
      void navigate({ to: "/admin", replace: true });
      return;
    }

    if (!email || password.length < 8) {
      toast.error(t("auth.toast.need_credentials"));
      return;
    }
    setPending(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.error(t("auth.toast.signin_failed"));
      return;
    }
    void navigate({ to: "/admin", replace: true });
  };

  const title =
    mode === "signin"
      ? t("auth.signin_title")
      : mode === "forgot"
        ? t("auth.forgot_title")
        : t("auth.update_title");

  return (
    <main className="min-h-screen bg-sand flex items-center justify-center px-6 py-16" dir={dir}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src={brandLogo} alt="Sunny Stays Hurghada" className="h-20 w-auto" />
        </div>
        <div className="flex justify-center mb-8">
          <LanguageSwitcher />
        </div>
        <div className="bg-card rounded-3xl border border-forest/10 shadow-[0_10px_30px_-12px_rgb(23_59_99_/_0.15)] p-8">
          <span className="block text-[10px] uppercase tracking-[0.3em] text-gold font-medium mb-2">
            {t("auth.internal")}
          </span>
          <h1 className="font-display text-2xl text-forest mb-6">{title}</h1>
          <form onSubmit={onSubmit} className="space-y-3">
            {mode !== "update" && (
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={t("auth.email")}
                className="w-full bg-card p-4 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
              />
            )}
            {mode !== "forgot" && (
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "update" ? t("auth.new_password") : t("auth.password")}
                className="w-full bg-card p-4 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
              />
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-forest text-sand py-4 rounded-xl text-xs uppercase tracking-[0.25em] font-bold hover:bg-gold hover:text-forest transition-colors disabled:opacity-60"
            >
              {pending
                ? t("auth.wait")
                : mode === "signin"
                  ? t("auth.signin")
                  : mode === "forgot"
                    ? t("auth.send_link")
                    : t("auth.save_password")}
            </button>
          </form>
          {mode !== "update" && (
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "forgot" : "signin")}
              className="mt-5 w-full text-center text-[11px] uppercase tracking-widest text-forest/55 hover:text-gold transition-colors"
            >
              {mode === "signin" ? t("auth.forgot_link") : t("auth.back_to_login")}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
