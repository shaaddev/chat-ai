export function focusComposer() {
  document
    .querySelector<HTMLTextAreaElement>("[data-composer] textarea")
    ?.focus();
}
