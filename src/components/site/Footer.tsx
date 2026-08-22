export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--hairline)] py-10">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 text-[13px] text-mist-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          Built for <span className="text-mist-200">UniHack</span> — AI-powered
          product intelligence for industrial commerce.
        </p>
        <p className="font-mono text-[12px]">
          every attribute carries its evidence
        </p>
      </div>
    </footer>
  );
}
