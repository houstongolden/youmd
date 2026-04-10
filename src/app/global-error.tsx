"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          background: "#0D0D0D",
          color: "#EAE6E1",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "480px", textAlign: "center" }}>
          <div
            style={{
              color: "#C46A3A",
              fontSize: "14px",
              marginBottom: "16px",
              letterSpacing: "0.1em",
            }}
          >
            you.md
          </div>
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              marginBottom: "8px",
              opacity: 0.9,
            }}
          >
            something went wrong loading this page.
          </p>
          <p
            style={{
              fontSize: "11px",
              lineHeight: 1.6,
              opacity: 0.4,
              marginBottom: "24px",
            }}
          >
            {error?.message || "an unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            style={{
              background: "transparent",
              border: "1px solid #C46A3A",
              color: "#C46A3A",
              padding: "8px 20px",
              fontFamily: "inherit",
              fontSize: "12px",
              cursor: "pointer",
              borderRadius: "2px",
              marginRight: "12px",
            }}
          >
            &gt; retry
          </button>
          <a
            href="/"
            style={{
              color: "#C46A3A",
              fontSize: "12px",
              opacity: 0.7,
              textDecoration: "none",
            }}
          >
            &gt; home
          </a>
        </div>
      </body>
    </html>
  );
}
