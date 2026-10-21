import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="container landing">
      <section className="hero">
        <p className="eyebrow">For students living on a monthly allowance</p>
        <h1>Know how much you have left — before the month runs out.</h1>
        <p className="lead">
          PocketBudget splits your allowance into <strong>Food</strong>, <strong>Going out</strong> and{" "}
          <strong>Hobbies</strong>. Log what you spend in two seconds and see exactly what&apos;s left in each.
        </p>
        <Link href="/signup" className="btn btn-primary btn-lg">
          Sign up — it&apos;s free
        </Link>
        <p className="muted small">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>

      <section className="preview" aria-label="Example of what you will see">
        {[
          { label: "🍝 Food", spent: 172, budget: 250 },
          { label: "🎉 Going out", spent: 128, budget: 150 },
          { label: "🎸 Hobbies & other", spent: 35, budget: 100 },
        ].map((c) => {
          const pct = Math.min(100, (c.spent / c.budget) * 100);
          return (
            <div key={c.label} className="preview-card">
              <div className="preview-row">
                <span>{c.label}</span>
                <strong>{c.budget - c.spent} € left</strong>
              </div>
              <div className="bar">
                <div className={`bar-fill ${pct >= 80 ? "warn" : ""}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </section>

      <section className="steps">
        <div>
          <h2>1. Sign up</h2>
          <p>Email and password. No setup needed — sensible budgets are ready for you.</p>
        </div>
        <div>
          <h2>2. Add expenses</h2>
          <p>&ldquo;Mercadona, 23 €&rdquo; → Food. That&apos;s it.</p>
        </div>
        <div>
          <h2>3. See what&apos;s left</h2>
          <p>Each category shows spent, left and a progress bar for this month.</p>
        </div>
      </section>
    </div>
  );
}
