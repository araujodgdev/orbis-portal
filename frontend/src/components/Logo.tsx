// frontend/src/components/Logo.tsx
// Marca Orbis: núcleo (o escritório) em órbita dupla — o caso
// andando em volta de quem advoga, não o contrário.
export function Logo({ variant = 'dark' }: { variant?: 'light' | 'dark' }) {
  const tone = variant === 'light' ? 'text-white' : 'text-brand';
  return (
    <span className={`inline-flex items-center gap-2.5 ${tone}`}>
      <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className="h-8 w-8 shrink-0">
        <ellipse
          cx="16"
          cy="16"
          rx="13.5"
          ry="6"
          stroke="currentColor"
          strokeWidth="1.8"
          transform="rotate(-24 16 16)"
          opacity="0.55"
        />
        <ellipse
          cx="16"
          cy="16"
          rx="13.5"
          ry="6"
          stroke="currentColor"
          strokeWidth="1.8"
          transform="rotate(38 16 16)"
          opacity="0.3"
        />
        <circle cx="16" cy="16" r="4.5" fill="currentColor" />
        <circle cx="26.5" cy="9.5" r="2.2" fill="#d97706" />
      </svg>
      <span className="font-display text-[26px] leading-none font-semibold tracking-tight">
        Orbis
      </span>
    </span>
  );
}
