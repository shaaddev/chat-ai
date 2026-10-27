export function focusComposer() {
  document
    .querySelector<HTMLTextAreaElement>("[data-composer] textarea")
    ?.focus();
}

export function returnFocusToComposer() {
  const focusOpensKeyboard = window.matchMedia("(pointer: coarse)").matches;
  if (focusOpensKeyboard) {
    document
      .querySelector<HTMLButtonElement>("[data-composer-action]")
      ?.focus();
  } else {
    focusComposer();
  }
}
