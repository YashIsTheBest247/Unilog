"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The splash that plays on a full load of the landing page.
 *
 * Module scope, not state: this survives re-renders and client-side
 * navigation but resets on a real page load, which is exactly the rule
 * asked for — refresh replays it, clicking back to Home does not.
 */
let alreadyPlayed = false;

export const INTRO_KEY = "unify.intro.lastShown";

/** Local calendar day, so "once a day" means the viewer's day. */
export function todayStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `?intro=1` forces a replay, which is what you want when recording. */
function forced() {
  return new URLSearchParams(window.location.search).get("intro") === "1";
}

export function shouldPlayIntro() {
  if (window.location.pathname !== "/") return false;
  if (forced()) return true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return window.localStorage.getItem(INTRO_KEY) !== todayStamp();
  } catch {
    // Storage blocked: play it rather than never showing it at all.
    return true;
  }
}

/**
 * Runs before first paint so the landing page never flashes behind the
 * splash. The condition here must match `shouldPlayIntro` exactly — if
 * the guard arms for a load the component then declines, the page would
 * sit blacked out until the failsafe timeout fires.
 */
export const INTRO_INIT = `(function(){try{
if(location.pathname!=="/")return;
var force=new URLSearchParams(location.search).get("intro")==="1";
if(!force){
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  var d=new Date(),p=function(n){return String(n).padStart(2,"0")};
  var today=d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
  if(localStorage.getItem("unify.intro.lastShown")===today)return;
}
document.documentElement.setAttribute("data-intro","pending");
setTimeout(function(){document.documentElement.removeAttribute("data-intro");},6000);
}catch(e){}})();`;

export function IntroVideo() {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  const dismiss = useCallback(() => {
    setLeaving(true);
    document.documentElement.removeAttribute("data-intro");
    window.setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = "";
    }, 480);
  }, []);

  useEffect(() => {
    if (alreadyPlayed || pathname !== "/" || !shouldPlayIntro()) {
      document.documentElement.removeAttribute("data-intro");
      return;
    }

    alreadyPlayed = true;

    // Stamped on show, not on finish, so refreshing midway through does
    // not start it over.
    try {
      window.localStorage.setItem(INTRO_KEY, todayStamp());
    } catch {
      // A blocked store just means it plays again next load.
    }

    setVisible(true);
    document.body.style.overflow = "hidden";
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;

    // The overlay is now painted over everything, so the pre-paint guard
    // has done its job and can stand down. Explicit rather than relying
    // on the not-showing branch above, which only happens to run again
    // because StrictMode double-invokes effects in development.
    document.documentElement.removeAttribute("data-intro");

    skipRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") dismiss();
    };
    window.addEventListener("keydown", onKey);

    // Muted autoplay is the only kind browsers allow unprompted. If even
    // that is refused, do not sit on a frozen frame — get out of the way.
    const video = videoRef.current;
    video?.play().catch(() => dismiss());

    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Introduction"
      className={cn(
        "fixed inset-0 z-[200] grid place-items-center bg-black transition-opacity duration-500",
        leaving ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        poster="/intro-poster.jpg"
        muted={muted}
        autoPlay
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress(v.currentTime / v.duration);
        }}
        className="h-full w-full object-contain"
      />

      {/* Elapsed, so nobody has to wonder how long they are trapped. */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
        <div
          className="h-full bg-brand-500 transition-[width] duration-200 ease-linear"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>

      <div className="absolute right-5 bottom-7 flex items-center gap-2 sm:right-8 sm:bottom-9">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute the intro" : "Mute the intro"}
          className="focus-ring grid size-10 place-items-center rounded-full border border-white/25 bg-black/40 text-white/80 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
        >
          {muted ? <MutedIcon /> : <SoundIcon />}
        </button>

        <button
          ref={skipRef}
          type="button"
          onClick={dismiss}
          className="focus-ring inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-[14px] font-semibold text-[#101013] shadow-lg transition-transform hover:scale-[1.03] active:scale-100"
        >
          Skip intro
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <path
              d="M3.5 3.5 8 8l-4.5 4.5M9 3.5 13.5 8 9 12.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MutedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        d="M11 5 6.5 9H3v6h3.5L11 19V5Z"
        fill="currentColor"
      />
      <path
        d="m16 9 5 6m0-6-5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SoundIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" fill="currentColor" />
      <path
        d="M15 9.2a4 4 0 0 1 0 5.6M17.8 6.6a8 8 0 0 1 0 10.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
