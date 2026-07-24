import { SessionProvider, useSession } from "./lib/session";
import { SignIn } from "./components/sign-in";
import { TerminusApp } from "./terminus-app";

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

  return <TerminusApp onSignOut={() => void signOut()} />;
}

export function App() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}
