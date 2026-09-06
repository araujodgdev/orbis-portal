// frontend/src/components/FormSection.tsx
import type { ReactNode } from 'react';

/** Agrupa campos relacionados em um cartão, como uma seção de um formulário em papel. */
export function FormSection({
  title, hint, children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-sheet border border-line bg-sheet p-4 shadow-sheet sm:p-5">
      <fieldset>
        <legend className="block w-full border-b border-line pb-3 font-display text-base font-semibold text-ink sm:text-lg">
          {title}
        </legend>
        {hint && <p className="mt-3 text-sm text-muted">{hint}</p>}
        <div className="mt-4">{children}</div>
      </fieldset>
    </div>
  );
}

/** Asterisco acessível para marcar campos obrigatórios ao lado do rótulo. */
export function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="text-seal">
        {' '}*
      </span>
      <span className="sr-only"> (obrigatório)</span>
    </>
  );
}
