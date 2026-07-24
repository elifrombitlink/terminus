import { FormEvent, useState } from "react";
import { useSession } from "../lib/session";
import { Scanner } from "./scanner";

type Mode = "signin" | "signup";

export function SignIn() {
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);

    const action = mode === "signin" ? signIn : signUp;
    const { error: authError } = await action(email.trim(), password);

    setPending(false);
    if (authError) {
      setError(authError);
      return;
    }
    if (mode === "signup") {
      setNotice(
        "Account requested. If email confirmation is enabled, confirm via the link sent to you, then sign in.",
      );
      setMode("signin");
    }
  }

  return (
    <div className="access-shell">
      <div className="access-card">
        <Scanner node="TERM-01" left="LINK" right="AUTH" />
        <form className="modal" onSubmit={submit}>
        <div className="modal-label">
          <div>
            <div className="micro" style={{ color: "#2c3335" }}>
              Terminus // Command access
            </div>
            <h2>{mode === "signin" ? "Operator sign in" : "Request access"}</h2>
          </div>
          <div className="barcode" style={{ backgroundColor: "transparent" }} />
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="auth-email">Operator email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operator@northfirn.com"
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Passphrase</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              className="auth-approved"
              style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              className="auth-approved"
              style={{ borderColor: "var(--sage)", color: "var(--sage)" }}
            >
              {notice}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "signin" ? "Request access" : "Have access"}
          </button>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending
              ? "Working…"
              : mode === "signin"
                ? "Enter Command"
                : "Request"}
          </button>
        </div>
        </form>
        <div className="access-foot">Terminus // Command · Authorized operators only</div>
      </div>
    </div>
  );
}
