import React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

type OtpEmailProps = {
  email?: string;
  pin: string;
  expiresInMinutes?: number;
};

export default function OtpEmail({
  email,
  pin,
  expiresInMinutes = 5,
}: OtpEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-[#f5f5f5] font-sans p-10 mx-auto my-auto">
          <Container className="border border-black bg-white shadow-md rounded-lg px-5 py-2 mx-auto max-w-lg">
            <Section className="text-center">
              <Text className="text-lg font-medium text-center">
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
                <Text className="tracking-widest text-3xl font-bold font-mono bg-neutral-200 text-black rounded-xl px-6 py-3">
                  {pin}
                </Text>
              </Section>
              <Text className="text-xs text-center text-[#8898aa]">
                This code expires in {expiresInMinutes} minutes. If you
                didn&apos;t request it, you can ignore this email.
              </Text>
            </Section>

            <Hr className="border-[#cccccc] mt-5" />
            <Text className="text-[#8898aa] leading-7 text-xs text-center">
              For your security, never share this code with anyone.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
