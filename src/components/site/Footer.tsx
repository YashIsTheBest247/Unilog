export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--hairline)] py-10">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <p className="text-center text-[13px] text-mist-500">
          &copy; {new Date().getFullYear()} Unify. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
