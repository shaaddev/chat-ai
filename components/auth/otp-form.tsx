"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useChat } from "@/components/chat-context";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";

const schema = z.object({
  pin: z.string().min(6, {
    message: "Your one-time password must be 6 characters",
  }),
});

export function OTPForm({
  email,
  isSignUp = false,
}: {
  email: string;
  isSignUp?: boolean;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      pin: "",
    },
  });
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const { refreshChats } = useChat();

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setIsPending(true);

    try {
      let result;

      if (isSignUp) {
        // For signup, verify the email
        result = await authClient.emailOtp.verifyEmail({
          email,
          otp: values.pin,
        });
      } else {
        // For sign-in, use the sign-in method
        result = await authClient.signIn.emailOtp({
          email,
          otp: values.pin,
        });
      }

      if (result.error) {
        toast.error("Error!", {
          description: result.error.message || "Invalid OTP. Please try again.",
        });
      } else {
        // Ensure client state sees the new session
        await refreshChats();
        toast.success("Success!", {
          description: isSignUp
            ? "Your account has been verified!"
            : "You're now signed in!",
        });
        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      console.log("ERROR", error);
      toast.error("Error!", {
        description: "An error occurred while verifying your OTP.",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="w-full">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 text-center"
        >
          <FormField
            control={form.control}
            name="pin"
            render={({ field }) => (
              <FormItem className="flex flex-col items-center justify-center">
                <FormLabel>One-Time Password</FormLabel>
                <FormControl>
                  <InputOTP
                    maxLength={6}
                    {...field}
                    onChange={(value) => {
                      field.onChange(value);
                      if (value.length === 6 && !isPending) {
                        form.handleSubmit(onSubmit)();
                      }
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormDescription className="mt-10">
                  This code expires in 5 minutes. If you didn&apos;t request it,
                  you can ignore this email.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
