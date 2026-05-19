"use client";

import { BookOpen, Brain, Sparkles, type LucideIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";

const COPY = {
  journal: {
    title: "Trading Journal",
    body: "Coming soon. Every trade you verify will be automatically saved here. Your full decision history, ITVE scores and outcomes in one place.",
    Icon: BookOpen,
  },
  mind: {
    title: "Psychological AI",
    body: "Coming soon. Emotional state checks, post loss management and session readiness scoring, all before you enter a single trade.",
    Icon: Brain,
  },
} as const;

function JournalStateIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <div
      data-testid="journal-state-icon"
      className="relative mb-7 size-24 sm:size-28"
      aria-hidden
    >
      <Image
        src="/logo.svg"
        alt=""
        fill
        sizes="9rem"
        className="object-contain"
      />
      <div className="absolute inset-[18%] rounded-full bg-[rgb(10,13,46)] shadow-[0_0_22px_rgba(10,13,46,0.95)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className="size-9 text-white sm:size-10" strokeWidth={2.7} />
      </div>
    </div>
  );
}

function MindStateIcon() {
  return (
    <svg
      data-testid="mind-state-orb"
      className="size-36 overflow-visible sm:size-40"
      viewBox="0 0 240 240"
      role="img"
      aria-label="Plasma mind orb"
    >
      <defs>
        <linearGradient id="mind-orb-base" x1="14%" y1="88%" x2="92%" y2="10%">
          <stop offset="0%" stopColor="#1530ff" />
          <stop offset="22%" stopColor="#2a2bff" />
          <stop offset="48%" stopColor="#7a35ff" />
          <stop offset="72%" stopColor="#cf3da3" />
          <stop offset="100%" stopColor="#ff5566" />
        </linearGradient>
        <linearGradient
          id="mind-orb-band-1"
          x1="0%"
          y1="100%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#0c1d9c" stopOpacity="0" />
          <stop offset="45%" stopColor="#0c1d9c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0c1d9c" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id="mind-orb-band-2"
          x1="0%"
          y1="100%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#6a2dd6" stopOpacity="0" />
          <stop offset="50%" stopColor="#6a2dd6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6a2dd6" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id="mind-orb-band-bright"
          x1="0%"
          y1="100%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#ff76d5" stopOpacity="0" />
          <stop offset="40%" stopColor="#ff7ddf" stopOpacity="0.34" />
          <stop offset="68%" stopColor="#f96ad2" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#ff5c9b" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id="mind-orb-band-warm"
          x1="0%"
          y1="100%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#ff6c9c" stopOpacity="0" />
          <stop offset="50%" stopColor="#ff7eb4" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#ff5a8e" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="mind-orb-blue-pool" cx="20%" cy="84%" r="68%">
          <stop offset="0%" stopColor="#1538ff" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#0c1f9c" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#070a4a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mind-orb-red-pool" cx="88%" cy="20%" r="60%">
          <stop offset="0%" stopColor="#ff6772" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#ff3d8a" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#ff2f8a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mind-orb-depth" cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor="#04022a" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mind-orb-top-shine" cx="46%" cy="16%" r="56%">
          <stop offset="0%" stopColor="#ff80e6" stopOpacity="0.12" />
          <stop offset="60%" stopColor="#ff64d4" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ff64d4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mind-orb-rim" x1="6%" y1="86%" x2="94%" y2="12%">
          <stop offset="0%" stopColor="#3fb6ff" />
          <stop offset="32%" stopColor="#5e5cff" />
          <stop offset="64%" stopColor="#d445e8" />
          <stop offset="100%" stopColor="#ff5b6d" />
        </linearGradient>
        <filter
          id="mind-orb-plasma"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.011 0.024"
            numOctaves="3"
            seed="7"
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              dur="14s"
              values="0.011 0.024;0.017 0.019;0.011 0.024"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="20"
            xChannelSelector="R"
            yChannelSelector="B"
          />
        </filter>
        <filter
          id="mind-orb-band-blur"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter
          id="mind-orb-flow-noise"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.026 0.038"
            numOctaves="4"
            seed="22"
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              dur="9s"
              values="0.026 0.038;0.04 0.028;0.026 0.038"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0.95  0 0 0 0 0.22  0 0 0 0 1  0 0 0 0.58 0"
          />
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
        <filter
          id="mind-orb-soft-blur"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter
          id="mind-orb-outer-glow"
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <clipPath id="mind-orb-clip">
          <circle cx="120" cy="120" r="79" />
        </clipPath>
      </defs>

      <g filter="url(#mind-orb-outer-glow)">
        <circle
          cx="120"
          cy="120"
          r="79"
          fill="url(#mind-orb-base)"
          opacity="0.7"
        />
      </g>

      <g clipPath="url(#mind-orb-clip)">
        <circle cx="120" cy="120" r="79" fill="url(#mind-orb-base)" />
        <circle cx="120" cy="120" r="79" fill="url(#mind-orb-blue-pool)" />
        <circle cx="120" cy="120" r="79" fill="url(#mind-orb-red-pool)" />

        <rect
          x="35"
          y="35"
          width="170"
          height="170"
          filter="url(#mind-orb-flow-noise)"
          opacity="0.5"
        >
          <animateTransform
            attributeName="transform"
            type="translate"
            values="-6 3;5 -4;-6 3"
            dur="18s"
            repeatCount="indefinite"
          />
        </rect>

        <g filter="url(#mind-orb-plasma)">
          <path
            d="M-10 218 C40 196, 78 200, 116 178 C156 156, 192 152, 250 130"
            fill="none"
            stroke="url(#mind-orb-band-1)"
            strokeWidth="34"
            strokeLinecap="round"
            filter="url(#mind-orb-band-blur)"
            opacity="0.95"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              dur="22s"
              values="-3 2;4 -3;-3 2"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M-10 178 C36 154, 76 158, 114 134 C156 110, 192 106, 252 84"
            fill="none"
            stroke="url(#mind-orb-band-2)"
            strokeWidth="26"
            strokeLinecap="round"
            filter="url(#mind-orb-band-blur)"
            opacity="0.9"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              dur="18s"
              values="3 -2;-4 3;3 -2"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M-10 140 C36 116, 78 118, 118 96 C158 74, 196 70, 252 50"
            fill="none"
            stroke="url(#mind-orb-band-warm)"
            strokeWidth="20"
            strokeLinecap="round"
            filter="url(#mind-orb-band-blur)"
            opacity="0.85"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              dur="16s"
              values="-2 3;4 -2;-2 3"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M-10 110 C34 88, 76 92, 116 70 C156 48, 196 44, 252 26"
            fill="none"
            stroke="url(#mind-orb-band-bright)"
            strokeWidth="18"
            strokeLinecap="round"
            filter="url(#mind-orb-band-blur)"
            opacity="0.82"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              dur="14s"
              values="-4 3;5 -3;-4 3"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M-10 90 C34 70, 78 72, 116 50 C156 30, 196 26, 252 8"
            fill="none"
            stroke="url(#mind-orb-band-warm)"
            strokeWidth="9"
            strokeLinecap="round"
            filter="url(#mind-orb-band-blur)"
            opacity="0.6"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              dur="20s"
              values="3 -2;-4 3;3 -2"
              repeatCount="indefinite"
            />
          </path>
        </g>

        <circle cx="120" cy="120" r="79" fill="url(#mind-orb-depth)" />
        <circle cx="120" cy="120" r="79" fill="url(#mind-orb-top-shine)" />
      </g>

      <circle
        cx="120"
        cy="120"
        r="79"
        fill="none"
        stroke="url(#mind-orb-rim)"
        strokeWidth="1"
        opacity="0.35"
      />
    </svg>
  );
}

export function MarketsTabUpcoming({ kind }: { kind: keyof typeof COPY }) {
  const { title, body, Icon } = COPY[kind];

  return (
    <div className="flex flex-col items-center px-4 py-16 text-center sm:py-20">
      {kind === "journal" ? (
        <JournalStateIcon Icon={Icon} />
      ) : (
        <MindStateIcon />
      )}

      <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>

      <span
        className={cn(
          "mt-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,110,245,0.3)] bg-[rgba(76,110,245,0.08)] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--vt-blue)]",
          kind === "mind" && "mt-5",
        )}
      >
        <Sparkles className="size-3" aria-hidden />
        Coming soon
      </span>

      <p className="mt-5 max-w-sm text-sm leading-relaxed text-[var(--vt-muted)]">
        {body}
      </p>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--vt-green)]">
        Pro members get access first.
      </p>
    </div>
  );
}
