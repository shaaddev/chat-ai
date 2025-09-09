"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { get_email } from "./action";
import { AlertCircle } from "lucide-react";
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
    const formData = new FormData();

    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== null && value !== "") {
        formData.append(key, value);
      }
    }

    try {
      const res = await get_email(formData);

      if (res.success) {
        setSubmittedEmail(values.email);
        setIsOtpStep(true);
        setSuccessMessage("");
      } else {
        setErrorMessage(
          "Your email has been blocked! Contact the owner of this website to gain access.",
        );
      }
    } catch (error) {
      setErrorMessage("An error occurred while sending the email.");
      return {
        error: error,
      };
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
            className="space-y-8 text-center"
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
              type="submit"
              className="w-full bg-neutral-800 text-neutral-100 rounded-xl hover:bg-neutral-900"
              disabled={isPending}
            >
              {isPending ? "Sending Email..." : "Continue with Email"}
            </Button>
          </form>
        </Form>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-neutral-500 text-center">
            If you have an account, we have sent a code to {submittedEmail}.
          </p>
          <OTPForm email={submittedEmail} />
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
