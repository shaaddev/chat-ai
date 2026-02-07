"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { OTPForm } from "./otp-form";

const schema = z.object({
  name: z.string().min(1, {
    message: "Must enter your name",
  }),
  email: z.string().email({
    message: "Must enter a valid email",
  }),
});

export function SignupForm({
  isOtpStep,
  setIsOtpStep,
}: {
  isOtpStep: boolean;
  setIsOtpStep: (isOtpStep: boolean) => void;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
    },
  });
  const [isPending, setIsPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setIsPending(true);
    setErrorMessage("");

    try {
      // First sign up the user, then send OTP for verification
      const signUpResult = await authClient.signUp.email({
        email: values.email,
        name: values.name,
        password: crypto.randomUUID(), // Generate random password since we use OTP
      });

      if (signUpResult.error) {
        // If user already exists, try sending OTP for sign-in instead
        if (signUpResult.error.message?.includes("already exists")) {
          const otpResult = await authClient.emailOtp.sendVerificationOtp({
            email: values.email,
            type: "sign-in",
          });

          if (otpResult.error) {
            setErrorMessage(otpResult.error.message || "Failed to send OTP");
            return;
          }
        } else {
          setErrorMessage(
            signUpResult.error.message || "Failed to create account",
          );
          return;
        }
      } else {
        // Send OTP for email verification
        const otpResult = await authClient.emailOtp.sendVerificationOtp({
          email: values.email,
          type: "email-verification",
        });

        if (otpResult.error) {
          setErrorMessage(
            otpResult.error.message || "Failed to send verification code",
          );
          return;
        }
      }

      setSubmittedEmail(values.email);
      setIsOtpStep(true);
      toast.success("Email sent", {
        description: "Check your email for the verification code.",
      });
      setSuccessMessage("");
    } catch (error) {
      setErrorMessage("An error occurred while creating your account.");
      console.error("Error signing up:", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="w-full">
      {!isOtpStep ? (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 text-center"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Name"
                      {...field}
                      className="rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Email"
                      type="email"
                      {...field}
                      className="rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-neutral-800 text-neutral-100 rounded-xl hover:bg-neutral-900 mt-4"
              disabled={isPending}
            >
              {isPending ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
        </Form>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-neutral-500 text-center">
            We&apos;ve sent a verification code to {submittedEmail}.
          </p>
          <OTPForm email={submittedEmail} isSignUp={true} />
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex">
            <div className="shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                {successMessage}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
