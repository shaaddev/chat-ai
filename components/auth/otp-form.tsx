"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { verify_otp } from "./action";
import { useRouter } from "next/navigation";

const schema = z.object({
  pin: z.string().min(6, {
    message: "Your one-time password must be 6 characters",
  }),
});

export function OTPForm({ email }: { email: string }) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      pin: "",
    },
  });
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setIsPending(true);
    const formData = new FormData();

    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== null && value !== "") {
        formData.append(key, value);
      }
    }

    if (email) {
      formData.append("email", email);
    }

    try {
      const res = await verify_otp(formData);

      if (res.success) {
        toast.success("Success!", {
          description: "Your account has been verified!",
        });
        router.push("/");
      } else {
        toast.error("Error!", {
          description:
            res.message || "An error occurred while verifying your OTP.",
        });
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
                  <InputOTP maxLength={6} {...field}>
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

          <Button type="submit" disabled={isPending}>
            {isPending ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
