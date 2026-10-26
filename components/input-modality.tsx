"use client";

import { useEffect } from "react";

type Modality = "keyboard" | "pointer";

export function InputModality() {
  useEffect(() => {
    const root = document.documentElement;
    const track = (modality: Modality) => () => {
      if (root.dataset.inputModality !== modality) {
        root.dataset.inputModality = modality;
      }
    };
    const onKeyboard = track("keyboard");
    const onPointer = track("pointer");
    window.addEventListener("keydown", onKeyboard, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("pointermove", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKeyboard, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("pointermove", onPointer, true);
    };
  }, []);
  return null;
}
