import { Link } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { MoveLeft } from "lucide-react";
import { OTPForm } from "@/components/auth/otp-form";

export default async function Page({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const params = await searchParams;
  const email = params.email || "";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 bg-neutral-900">
      <OTPForm email={email} />
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
