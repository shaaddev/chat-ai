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

type OTPProps = {
  email: string;
  otp: string;
};

export default function Email({ email, otp }: OTPProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-[#f5f5f5] font-sans p-10">
          <Container className="border border-black  shadow-md rounded-lg px-5 py-2">
            <Section className="flex items-center justify-center">
              <Text className="text-lg font-medium text-center">
                Verify your email to sign-in to{" "}
                <span className="font-bold">Chat - Shaaddev</span>
              </Text>
            </Section>
            <Section>
              <Text className="text-sm">Hello {email},</Text>
              <Text>We have received a sign-in attempt.</Text>
              <Text>
                To complete the sign-in process; enter the 6-digit code in the
                original window.
              </Text>
              <Text className="text-lg font-bold rounded-xl py-3 bg-white text-center">
                {otp}
              </Text>
            </Section>
            <Hr className="border-[#cccccc] mt-5" />
            <Text className="text-[#8898aa] leading-7 text-xs text-center">
              If you {"didn't"} attempt to sign-in but received this email,
              please ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
