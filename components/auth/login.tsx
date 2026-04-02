"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { Button } from "@/components/ui/button";

export function Login() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [isOtpStep, setIsOtpStep] = useState(false);

  return (
    <div className="w-full space-y-8">
      <div className="flex w-full flex-col">
        <div className="mb-6 flex items-center justify-between">
          <Button
            className="flex items-center p-0 px-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => router.push("/")}
            size="sm"
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
            Back to Home
          </Button>
        </div>

        {!isOtpStep && (
          <p className="mt-2 text-center text-muted-foreground text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <Button
              className="mb-10 ml-1 text-primary hover:text-primary/80 hover:underline"
              onClick={() => setIsLogin(!isLogin)}
              variant="link"
            >
              {isLogin ? "Sign up" : "Login"}
            </Button>
          </p>
        )}

        {isLogin ? (
          <LoginForm isOtpStep={isOtpStep} setIsOtpStep={setIsOtpStep} />
        ) : (
          <SignupForm isOtpStep={isOtpStep} setIsOtpStep={setIsOtpStep} />
        )}
      </div>
    </div>
  );
}
