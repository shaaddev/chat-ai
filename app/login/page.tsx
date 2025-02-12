import { Link } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { MoveLeft } from "lucide-react";
import { OTPForm } from "@/components/otp-form";

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 bg-neutral-900">
      <OTPForm />
      <Button type="button" variant={"link"}>
        <Link
          href="/"
          className="text-blue-400 flex flex-row items-center gap-2"
        >
          <MoveLeft className="size-4 inline" />
          Back
        </Link>
      </Button>
    </div>
  );
}
