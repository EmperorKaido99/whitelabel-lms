"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
  _count: { users: number; courses: number };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", adminEmail: "", adminName: "", adminPassword: "", plan: "free" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/tenants");
    if (res.ok) setTenants(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create tenant"); return; }
      setShowCreate(false);
      setForm({ name: "", slug: "", adminEmail: "", adminName: "", adminPassword: "", plan: "free" });
      await fetchTenants();
    } catch { setError("Something went wrong."); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tenant and ALL its data? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" });
      await fetchTenants();
    } finally { setDeleteId(null); }
  };

  const planColors: Record<string, string> = { free: "#4a5568", pro: "#5a7aff", enterprise: "#a78bfa" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
          <Link href="/admin" style={{ color: "#7a90bc", fontSize: 13, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>Tenants</span>
        </div>
        <button onClick={() => { setShowCreate(true); setError(""); }} style={{ background: "#5a7aff", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500 }}>
          + New Tenant
        </button>
      </nav>

      <main style={{ padding: "40px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 10 }}>Admin</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px" }}>Tenant Management</h1>
        </div>

        {loading ? (
          <div style={{ color: "#4a5568", fontSize: 14 }}>Loading…</div>
        ) : tenants.length === 0 ? (
          <div style={{ border: "2px dashed #1e2433", borderRadius: 12, padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>🏢</div>
            <p style={{ color: "#4a5568", fontSize: 14 }}>No tenants yet. Create one to get started.</p>
          </div>
        ) : (
          <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e2433" }}>
                  {["Tenant", "Slug", "Plan", "Users", "Courses", "Created", ""].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#4a5568", fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #13161f" }}>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>{t.name}</td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "#7a90bc", fontFamily: "'IBM Plex Mono', monospace" }}>{t.slug}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: `${planColors[t.plan] ?? "#4a5568"}22`, color: planColors[t.plan] ?? "#4a5568", border: `1px solid ${planColors[t.plan] ?? "#4a5568"}44`, textTransform: "capitalize" }}>
                        {t.plan}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#7a90bc" }}>{t._count.users}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#7a90bc" }}>{t._count.courses}</td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "#4a5568" }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deleteId === t.id}
                        style={{ fontSize: 12, color: "#ef4444", background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}
                      >
                        {deleteId === t.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create Tenant Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#0c0e14", border: "1px solid #2a3347", borderRadius: 12, padding: 32, width: "100%", maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f0f4ff", marginBottom: 24 }}>Create New Tenant</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Tenant Name", key: "name", placeholder: "Acme Corp" },
                { label: "Slug (URL identifier)", key: "slug", placeholder: "acme-corp" },
                { label: "Admin Email", key: "adminEmail", placeholder: "admin@acme.com", type: "email" },
                { label: "Admin Name (optional)", key: "adminName", placeholder: "Admin" },
                { label: "Admin Password", key: "adminPassword", placeholder: "Min. 8 characters", type: "password" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 12, color: "#7a90bc", marginBottom: 6 }}>{f.label}</label>
                  <input
                    type={f.type ?? "text"}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required={f.key !== "adminName"}
                    style={{ width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 6, padding: "9px 12px", fontSize: 13, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" }}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: "block", fontSize: 12, color: "#7a90bc", marginBottom: 6 }}>Plan</label>
                <select
                  value={form.plan}
                  onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                  style={{ width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 6, padding: "9px 12px", fontSize: 13, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" }}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "#f87171" }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ background: "transparent", color: "#7a90bc", border: "1px solid #2a3347", borderRadius: 6, padding: "9px 18px", fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>Cancel</button>
                <button type="submit" disabled={creating} style={{ background: creating ? "#3a4a88" : "#5a7aff", color: "#fff", border: "none", borderRadius: 6, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: creating ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  {creating ? "Creating…" : "Create Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
