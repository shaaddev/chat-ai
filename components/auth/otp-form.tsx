"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { toast } from "sonner";
import { confirm_otp } from "./action";
import { useRouter } from "next/navigation";

const Schema = z.object({
  otp: z.string().min(6, {
    message: "Your one-time password must be 6 characters",
  }),
});

export function OTPForm({ email }: { email: string }) {
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      otp: "",
    },
  });
  const router = useRouter();

  const onSubmit = async (values: z.infer<typeof Schema>) => {
    const formData = new FormData();

    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== null && value !== "") {
        formData.append(key, value);
      }
    }

    try {
      const res = await confirm_otp(formData, email);

      if (res.success && res.redirectUrl) {
        toast.success("You have signed in!", {
          description: "You will be redirected shortly",
        });

        router.push(res.redirectUrl);
      } else {
        toast.error("Oops!", {
          description: "Please try again later",
        });
        router.push(res.redirectUrl);
      }
    } catch (error) {
      toast.error(`${error}`);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col justify-center  text-center gap-8"
      >
        <FormField
          control={form.control}
          name="otp"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xl font-semibold">
                Verification
              </FormLabel>
              <FormDescription>
                We have sent a code to {email}. Enter it below
              </FormDescription>
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
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
