import { Button } from "@/components/ui/button";
import { Github, Home } from "lucide-react";
import { Link } from "next-view-transitions";
import type { JSX } from "react";

interface btnProps {
  className: string;
  size: "default" | "sm" | "lg" | "icon" | null | undefined;
  icon: JSX.Element;
  text: string;
}

export default function Page() {
  const btn: btnProps[] = [
    {
      className:
        "bg-neutral-800 rounded-xl text-neutral-200 hover:bg-neutral-900/50 border border-neutral-50/20 text-lg",
      size: "lg",
      icon: <Github className="size-5" />,
      text: "Continue with Github",
    },
    {
      className:
        "bg-neutral-800 rounded-xl text-neutral-200 hover:bg-neutral-900/50 border border-neutral-50/20 text-lg",
      size: "sm",
      icon: <Home className="size-5 inline" />,
      text: "Back to Home",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 bg-neutral-900">
      {btn.map((b, index) => (
        <Button key={index} className={`${b.className}`} size={b.size}>
          {b.size == "sm" ? (
            <Link href="/" className="flex flex-row items-center gap-2">
              {b.icon} {b.text}
            </Link>
          ) : (
            <>
              {b.icon} {b.text}
            </>
          )}
        </Button>
      ))}
    </div>
  );
}
