import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-semibold text-[19px] leading-none tracking-[-0.035em]">
        chat<span className="text-primary">.</span>
      </p>
      <h1 className="mt-4 font-medium text-[24px] leading-[1.2] tracking-[-0.025em]">
        This page doesn't exist
      </h1>
      <p className="text-muted-foreground">
        The link may be old, or the chat may have been deleted.
      </p>
      <Link
        className="mt-3 inline-flex h-9 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        href="/"
      >
        Start a new chat
      </Link>
    </div>
  );
}
