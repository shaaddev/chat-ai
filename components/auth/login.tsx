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
      <div className="flex flex-col w-full">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="flex items-center text-neutral-400 hover:text-neutral-200 p-0 hover:bg-black/5 px-2"
          >
            <ArrowLeft className="size-4" />
            Back to Home
          </Button>
        </div>

        {!isOtpStep && (
          <p className="mt-2 text-sm text-neutral-400 text-center">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <Button
              onClick={() => setIsLogin(!isLogin)}
              variant="link"
              className=" text-blue-600 hover:text-blue-500 hover:underline ml-1 mb-10"
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
