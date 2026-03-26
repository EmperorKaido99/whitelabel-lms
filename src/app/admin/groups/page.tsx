"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface GroupMember { id: string; userId: string; user: { id: string; name: string | null; email: string }; }
interface GroupCourse { id: string; courseId: string; dueDate: string | null; }
interface Group {
  id: string; name: string; description: string | null;
  _count: { members: number; courses: number };
  members: GroupMember[];
  courses: GroupCourse[];
}
interface Learner { id: string; name: string | null; email: string; }
interface CatalogCourse { id: string; title: string; }

const btn = (accent = "#5a7aff"): React.CSSProperties => ({
  background: accent, color: "#fff", border: "none", borderRadius: 5,
  padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
  fontFamily: "'IBM Plex Sans', sans-serif",
});
const inputStyle: React.CSSProperties = {
  width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 5,
  padding: "8px 12px", fontSize: 13, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif",
};

export default function GroupsPage() {
  const [groups, setGroups]   = useState<Group[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [catalog, setCatalog]  = useState<CatalogCourse[]>([]);
  const [loading, setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Create group form
  const [newName, setNewName]     = useState("");
  const [newDesc, setNewDesc]     = useState("");
  const [creating, setCreating]   = useState(false);

  // Add member
  const [addingMember, setAddingMember] = useState<Record<string, string>>({}); // groupId -> userId
  // Assign course
  const [addingCourse, setAddingCourse] = useState<Record<string, string>>({}); // groupId -> courseId
  const [courseDue, setCourseDue]       = useState<Record<string, string>>({});

  const [statusMsg, setStatusMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, lRes, cRes] = await Promise.all([
        fetch("/api/admin/groups"),
        fetch("/api/admin/learners"),
        fetch("/api/catalog"),
      ]);
      setGroups(await gRes.json());
      const lData = await lRes.json();
      setLearners(Array.isArray(lData) ? lData : []);
      const cData = await cRes.json();
      setCatalog(Array.isArray(cData) ? cData : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => { setStatusMsg(msg); setTimeout(() => setStatusMsg(""), 3000); };

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/groups", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
    });
    setCreating(false);
    if (res.ok) { setNewName(""); setNewDesc(""); await load(); flash("Group created."); }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Delete this group? This will not un-enroll learners.")) return;
    await fetch(`/api/admin/groups/${id}`, { method: "DELETE" });
    await load();
    flash("Group deleted.");
  };

  const addMember = async (groupId: string) => {
    const userId = addingMember[groupId];
    if (!userId) return;
    const res = await fetch(`/api/admin/groups/${groupId}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) { flash(data.error ?? "Failed."); return; }
    setAddingMember(p => ({ ...p, [groupId]: "" }));
    await load();
    flash("Member added.");
  };

  const removeMember = async (groupId: string, userId: string) => {
    await fetch(`/api/admin/groups/${groupId}/members?userId=${userId}`, { method: "DELETE" });
    await load();
  };

  const assignCourse = async (groupId: string) => {
    const courseId = addingCourse[groupId];
    if (!courseId) return;
    const res = await fetch(`/api/admin/groups/${groupId}/courses`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, dueDate: courseDue[groupId] || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { flash(data.error ?? "Failed."); return; }
    setAddingCourse(p => ({ ...p, [groupId]: "" }));
    setCourseDue(p => ({ ...p, [groupId]: "" }));
    flash(`Course assigned. ${data.enrolled} learner(s) newly enrolled.`);
    await load();
  };

  const removeCourse = async (groupId: string, courseId: string) => {
    await fetch(`/api/admin/groups/${groupId}/courses?courseId=${courseId}`, { method: "DELETE" });
    await load();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'); * { box-sizing:border-box; margin:0; padding:0; } select { background:#111520; border:1px solid #2a3347; border-radius:5px; padding:8px 12px; font-size:13px; color:#e2e8f0; font-family:'IBM Plex Sans',sans-serif; }`}</style>

      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", gap: 24, background: "#0c0e14" }}>
        <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
        <Link href="/admin" style={{ color: "#4a5568", fontSize: 13, textDecoration: "none" }}>Admin</Link>
        <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>Groups</span>
      </nav>

      <main style={{ padding: "40px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>Cohorts</div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px" }}>Group Management</h1>
          <p style={{ fontSize: 13, color: "#4a5568", marginTop: 6 }}>Organise learners into groups. Assigning a course to a group bulk-enrolls all members.</p>
        </div>

        {statusMsg && (
          <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, padding: "10px 16px", fontSize: 13, color: "#4ade80", marginBottom: 20 }}>{statusMsg}</div>
        )}

        {/* Create group */}
        <form onSubmit={createGroup} style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, padding: "24px", marginBottom: 28, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 11, color: "#4a5568", display: "block", marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" }}>GROUP NAME *</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Sales Team Q1" required style={inputStyle} />
          </div>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 11, color: "#4a5568", display: "block", marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" }}>DESCRIPTION</label>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description" style={inputStyle} />
          </div>
          <button type="submit" disabled={creating} style={btn()}>
            {creating ? "Creating…" : "+ Create Group"}
          </button>
        </form>

        {/* Groups list */}
        {loading ? (
          <div style={{ color: "#4a5568", fontSize: 14, padding: "32px 0" }}>Loading groups…</div>
        ) : groups.length === 0 ? (
          <div style={{ border: "2px dashed #1e2433", borderRadius: 10, padding: "48px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>
            No groups yet. Create one above.
          </div>
        ) : groups.map(g => {
          const isOpen = expanded === g.id;
          return (
            <div key={g.id} style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", padding: "16px 22px", gap: 16, cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : g.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{g.name}</div>
                  {g.description && <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2 }}>{g.description}</div>}
                </div>
                <span style={{ fontSize: 12, color: "#4a5568", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {g._count.members} members · {g._count.courses} courses
                </span>
                <button onClick={e => { e.stopPropagation(); deleteGroup(g.id); }} style={{ ...btn("#ef4444"), padding: "5px 10px" }}>Delete</button>
                <span style={{ color: "#4a5568", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
              </div>

              {isOpen && (
                <div style={{ borderTop: "1px solid #13161f", padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  {/* Members */}
                  <div>
                    <h3 style={{ fontSize: 12, fontWeight: 600, color: "#7a90bc", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "'IBM Plex Mono', monospace" }}>Members</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <select value={addingMember[g.id] ?? ""} onChange={e => setAddingMember(p => ({ ...p, [g.id]: e.target.value }))} style={{ flex: 1 }}>
                        <option value="">Select learner…</option>
                        {learners.filter(l => !g.members.some(m => m.userId === l.id)).map(l => (
                          <option key={l.id} value={l.id}>{l.name ?? l.email}</option>
                        ))}
                      </select>
                      <button onClick={() => addMember(g.id)} style={btn()}>Add</button>
                    </div>
                    {g.members.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#3a4a68" }}>No members yet.</p>
                    ) : g.members.map(m => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #13161f" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: "#c5d0e8" }}>{m.user.name ?? m.user.email}</div>
                          {m.user.name && <div style={{ fontSize: 11, color: "#3a4a68" }}>{m.user.email}</div>}
                        </div>
                        <button onClick={() => removeMember(g.id, m.userId)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>

                  {/* Assigned courses */}
                  <div>
                    <h3 style={{ fontSize: 12, fontWeight: 600, color: "#7a90bc", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "'IBM Plex Mono', monospace" }}>Assigned Courses</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <select value={addingCourse[g.id] ?? ""} onChange={e => setAddingCourse(p => ({ ...p, [g.id]: e.target.value }))} style={{ flex: 1 }}>
                        <option value="">Select course…</option>
                        {catalog.filter(c => !g.courses.some(gc => gc.courseId === c.id)).map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <input type="date" value={courseDue[g.id] ?? ""} onChange={e => setCourseDue(p => ({ ...p, [g.id]: e.target.value }))} style={{ ...inputStyle, flex: 1 }} placeholder="Due date (optional)" />
                      <button onClick={() => assignCourse(g.id)} style={btn("#4ade80")}>Assign + Enroll</button>
                    </div>
                    {g.courses.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#3a4a68" }}>No courses assigned.</p>
                    ) : g.courses.map(gc => {
                      const courseTitle = catalog.find(c => c.id === gc.courseId)?.title ?? gc.courseId.slice(0, 8);
                      return (
                        <div key={gc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #13161f" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: "#c5d0e8" }}>{courseTitle}</div>
                            {gc.dueDate && <div style={{ fontSize: 11, color: "#fbbf24" }}>Due {new Date(gc.dueDate).toLocaleDateString()}</div>}
                          </div>
                          <button onClick={() => removeCourse(g.id, gc.courseId)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
