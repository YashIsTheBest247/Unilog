"use client";

import { useEffect } from "react";
import { Button, Eyebrow } from "@/components/ui/kit";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid max-w-2xl place-items-center px-5 py-32 text-center">
      <Eyebrow>Something broke</Eyebrow>
      <h1 className="text-3xl font-extrabold tracking-[-0.03em]">
        This view could not render
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-mist-400">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-mist-600">
          digest {error.digest}
        </p>
      )}
      <Button className="mt-7" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
