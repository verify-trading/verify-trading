"use client";

import { Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { HOW_IT_WORKS_VIDEO } from "@/components/marketing/how-it-works";

/**
 * Autoplays with sound where the browser allows it. Most browsers block unmuted autoplay until the
 * visitor has interacted with the site, so it then plays muted with a "Tap for sound" button, and the
 * first tap restarts it from the beginning with sound. After that a tap pauses or resumes.
 */
export function HowItWorksVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {}); // Low-power mode etc.: stays on the poster with a play button.
    });
  }, []);

  function onTap() {
    const v = ref.current;
    if (!v) return;
    if (v.muted) {
      v.muted = false;
      setMuted(false);
      v.currentTime = 0;
      void v.play();
    } else if (v.paused) void v.play();
    else v.pause();
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <video
        ref={ref}
        className="absolute inset-0 size-full object-cover"
        src={HOW_IT_WORKS_VIDEO.src}
        poster={HOW_IT_WORKS_VIDEO.poster}
        playsInline
        preload="auto"
        aria-label={HOW_IT_WORKS_VIDEO.title}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      />
      <button
        type="button"
        onClick={onTap}
        aria-label={muted ? "Play with sound" : paused ? "Play video" : "Pause video"}
        className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--vt-blue)]"
      >
        {muted ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            <Volume2 className="size-3.5" aria-hidden /> Tap for sound
          </span>
        ) : (
          <span
            className={`flex size-14 items-center justify-center rounded-full bg-black/60 backdrop-blur transition-opacity ${paused ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            {paused ? <Play className="size-6 translate-x-0.5 fill-white text-white" aria-hidden /> : <Pause className="size-6 fill-white text-white" aria-hidden />}
          </span>
        )}
      </button>
    </div>
  );
}
