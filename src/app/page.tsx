export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>WhiteLabel LMS</h1>
      <p>Server is running ✅</p>
      <ul>
        <li><a href="/admin">Admin Dashboard</a></li>
        <li><a href="/catalog">Course Catalog</a></li>
      </ul>
    </main>
  );
}
