export function ThinkingIndicator({
  label = "Generating response",
}: {
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 py-2" role="status">
      <span
        aria-hidden
        className="animate-[blink-cursor_1.1s_ease-in-out_infinite] text-accent leading-none motion-reduce:animate-none"
      >
        {"▋"}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
