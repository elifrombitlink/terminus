import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "./lib/session";
import { SignIn } from "./components/sign-in";
import { TerminusApp } from "./terminus-app";

type Theme = "light" | "dark";

function Gate() {
  const { demo, loading, session, signOut } = useSession();

  // No Supabase project configured yet: run the Command interface on sample
  // data so the deployed site is never a blank sign-in wall.
  if (demo) return <TerminusApp />;

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "var(--quiet)",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Establishing command link…
      </div>
    );
  }

  if (!session) return <SignIn />;

  return (
    <>
      <TerminusApp />
      <button
        className="tiny-button"
        type="button"
        onClick={() => void signOut()}
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 40,
        }}
      >
        Sign out
      </button>
    </>
  );
}

function ThemeSwitch({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      className="theme-switch"
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === "dark"}
      title={`${theme === "dark" ? "Dark" : "Light"} mode // switch to ${nextTheme}`}
    >
      <span className="theme-switch-track" aria-hidden="true">
        <span className="theme-switch-knob" />
      </span>
    </button>
  );
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem("terminus-theme");
    if (saved === "light" || saved === "dark") return saved;
    // Cream is the primary Terminus style — default to light regardless of
    // the OS preference. Operators can opt into dark from the switch.
    return "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("terminus-theme", theme);
  }, [theme]);

  return (
    <SessionProvider>
      <Gate />
      <ThemeSwitch
        theme={theme}
        onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      />
    </SessionProvider>
  );
}
