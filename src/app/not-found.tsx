import Link from "next/link";
import { Button, Eyebrow } from "@/components/ui/kit";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-2xl place-items-center px-5 py-32 text-center">
      <Eyebrow>404</Eyebrow>
      <h1 className="text-4xl font-extrabold tracking-[-0.03em]">
        Nothing here
      </h1>
      <p className="mt-3 text-[15px] text-mist-400">
        That page is not part of the engine.
      </p>
      <Link href="/" className="mt-7">
        <Button>Back to the console</Button>
      </Link>
    </div>
  );
}
