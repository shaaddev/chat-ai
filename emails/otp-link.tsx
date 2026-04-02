import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import React from "react";

interface OtpEmailProps {
  email?: string;
  expiresInMinutes?: number;
  pin: string;
}

export default function OtpEmail({
  email,
  pin,
  expiresInMinutes = 5,
}: OtpEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="mx-auto my-auto bg-[#f5f5f5] p-10 font-sans">
          <Container className="mx-auto max-w-lg rounded-lg border border-black bg-white px-5 py-2 shadow-md">
            <Section className="text-center">
              <Text className="text-center font-medium text-lg">
                Your verification code for{" "}
                <span className="font-bold">Chat - Shaaddev</span>
              </Text>
            </Section>

            <Section>
              {email ? <Text className="text-sm">Hello {email},</Text> : null}
              <Text className="text-sm">
                Use the one-time password (OTP) below to complete your sign in:
              </Text>
              <Section className="mt-5 text-center">
                <Text className="rounded-xl bg-neutral-200 px-6 py-3 font-bold font-mono text-3xl text-black tracking-widest">
                  {pin}
                </Text>
              </Section>
              <Text className="text-center text-[#8898aa] text-xs">
                This code expires in {expiresInMinutes} minutes. If you
                didn&apos;t request it, you can ignore this email.
              </Text>
            </Section>

            <Hr className="mt-5 border-[#cccccc]" />
            <Text className="text-center text-[#8898aa] text-xs leading-7">
              For your security, never share this code with anyone.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
