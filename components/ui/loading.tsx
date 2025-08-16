import { cn } from "@/lib/utils";

interface LoadingProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  text?: string;
}

export function Loading({ className, size = "md", text }: LoadingProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-200",
          sizeClasses[size],
        )}
      />
      {text && <span className="text-sm text-neutral-400">{text}</span>}
    </div>
  );
}

export function LoadingSpinner({
  className,
  size = "md",
}: Omit<LoadingProps, "text">) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-200",
        sizeClasses[size],
        className,
      )}
    />
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-neutral-800 rounded", className)} />
  );
}

export function ChatLoadingSkeleton() {
  return (
    <div className="flex flex-col space-y-4 p-4">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-neutral-700 rounded-full animate-pulse" />
        <div className="h-4 bg-neutral-700 rounded w-24 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-neutral-700 rounded w-full animate-pulse" />
        <div className="h-4 bg-neutral-700 rounded w-3/4 animate-pulse" />
        <div className="h-4 bg-neutral-700 rounded w-1/2 animate-pulse" />
      </div>
    </div>
  );
}
