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
import { toast } from "sonner";

const schema = z.object({
  email: z.string().min(1, {
    message: "Must enter your email",
  }),
});

export function LoginForm() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
    },
  });
  const [isPending, setIsPending] = useState(false);

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
        toast.success("Success!", {
          description: "Check your emails",
        });
      } else {
        toast.error("Your email has been blocked!", {
          description: "Contact the owner of this website to gain access.",
        });
        console.log(res.message);
      }
    } catch (error) {
      return {
        error: error,
      };
    } finally {
      setIsPending(false);
    }
  };

  return (
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
                <Input placeholder="Email" {...field} className="rounded-xl" />
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
  );
}
