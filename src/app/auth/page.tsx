"use client";

import { useState, Suspense } from "react";
import { signIn, getSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password.");
      } else {
        // Redirect based on role
        const session = await getSession();
        const role = (session?.user as { role?: string })?.role;
        if (callbackUrl && callbackUrl !== "/admin" && callbackUrl !== "/dashboard") {
          router.push(callbackUrl);
        } else {
          router.push(role === "admin" ? "/admin" : "/dashboard");
        }
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { outline: none; border-color: #5a7aff !important; box-shadow: 0 0 0 3px rgba(90,122,255,0.15); }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f0f4ff", letterSpacing: "-0.5px" }}>◆ LMS</div>
          </Link>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginTop: 8 }}>
            Sign In
          </div>
        </div>

        <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 12, padding: "32px" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#7a90bc", marginBottom: 8 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{ width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#e2e8f0", transition: "border-color 0.15s", fontFamily: "'IBM Plex Sans', sans-serif" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#7a90bc", marginBottom: 8 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#e2e8f0", transition: "border-color 0.15s", fontFamily: "'IBM Plex Sans', sans-serif" }}
              />
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#f87171" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ background: loading ? "#3a4a88" : "#5a7aff", color: "#fff", border: "none", borderRadius: 6, padding: "11px 0", fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif", transition: "background 0.15s" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#3a4a68" }}>
          Admin: <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#4a5568" }}>admin@demo.com</span> / <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#4a5568" }}>admin123</span>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
