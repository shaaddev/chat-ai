// `Chat` marks the composer's wrapper with `data-composer`.
export function focusComposer() {
  document
    .querySelector<HTMLTextAreaElement>("[data-composer] textarea")
    ?.focus();
}
