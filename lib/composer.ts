export function focusComposer() {
  document
    .querySelector<HTMLTextAreaElement>("[data-composer] textarea")
    ?.focus();
}

// For a button that unmounts once clicked. A touch device opens its keyboard
// when the textarea takes focus, so there the composer's button takes it.
export function returnFocusToComposer() {
  if (window.matchMedia("(pointer: coarse)").matches) {
    document
      .querySelector<HTMLButtonElement>("[data-composer-action]")
      ?.focus();
  } else {
    focusComposer();
  }
}
