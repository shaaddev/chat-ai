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
  email: z.string().min(1, {
    message: "Must enter your email",
  }),
});

export function LoginForm({
  isOtpStep,
  setIsOtpStep,
}: {
  isOtpStep: boolean;
  setIsOtpStep: (isOtpStep: boolean) => void;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
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
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: values.email,
        type: "sign-in",
      });

      if (result.error) {
        setErrorMessage(result.error.message || "Failed to send OTP");
      } else {
        setSubmittedEmail(values.email);
        setIsOtpStep(true);
        toast.success("Email sent", {
          description: "Check your email for the verification code.",
        });
        setSuccessMessage("");
      }
    } catch (error) {
      setErrorMessage("An error occurred while sending the email.");
      console.error("Error sending OTP:", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="w-full">
      {isOtpStep ? (
        <div className="space-y-6">
          <p className="text-center text-muted-foreground text-sm">
            If you have an account, we have sent a code to {submittedEmail}.
          </p>
          <OTPForm email={submittedEmail} />
        </div>
      ) : (
        <Form {...form}>
          <form
            className="space-y-8 text-center"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Email"
                      {...field}
                      className="rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Sending Email..." : "Continue with Email"}
            </Button>
          </form>
        </Form>
      )}

      {errorMessage && (
        <div className="fade-in slide-in-from-bottom-2 mt-4 animate-in rounded-xl border border-destructive/20 bg-destructive/10 p-4 duration-500">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div className="ml-3">
              <p className="font-medium text-destructive text-sm">
                {errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="fade-in slide-in-from-bottom-2 mt-4 animate-in rounded-xl border border-green-500/20 bg-green-500/10 p-4 duration-500">
          <div className="flex">
            <div className="shrink-0">
              <svg
                className="h-5 w-5 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  clipRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  fillRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="font-medium text-green-500 text-sm">
                {successMessage}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
