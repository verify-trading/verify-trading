export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center py-2" role="separator" aria-label={label}>
      <div className="flex-grow border-t border-white/10" />
      <span className="mx-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
        {label}
      </span>
      <div className="flex-grow border-t border-white/10" />
    </div>
  );
}
