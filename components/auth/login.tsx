"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";

export function Login() {
  const router = useRouter();
  const [isOtpStep, setIsOtpStep] = useState(false);

  return (
    <div className="w-full space-y-8">
      <div className="flex w-full flex-col">
        <div className="mb-6 flex items-center justify-between">
          <Button
            className="flex items-center p-0 px-2 text-muted-foreground"
            onClick={() => router.push("/")}
            size="sm"
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Button>
        </div>

        <LoginForm isOtpStep={isOtpStep} setIsOtpStep={setIsOtpStep} />
      </div>
    </div>
  );
}
