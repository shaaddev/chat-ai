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
          "animate-spin rounded-full border-2 border-muted border-t-foreground",
          sizeClasses[size]
        )}
      />
      {text && <span className="text-muted-foreground text-sm">{text}</span>}
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
        "animate-spin rounded-full border-2 border-muted border-t-foreground",
        sizeClasses[size],
        className
      )}
    />
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

export function ChatLoadingSkeleton() {
  return (
    <div className="flex flex-col space-y-4 p-4">
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
