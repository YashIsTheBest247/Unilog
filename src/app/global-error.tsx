"use client";

/**
 * Replaces the whole document when the root layout itself fails, so it
 * cannot rely on any of the app's styling.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#04122b",
          color: "#eef1f6",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", margin: 0 }}>
            The application failed to start
          </h1>
          <p style={{ color: "#8b9bb2", marginTop: "0.75rem" }}>
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              background: "#009eff",
              color: "#04122b",
              border: 0,
              borderRadius: 999,
              padding: "0.7rem 1.5rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
