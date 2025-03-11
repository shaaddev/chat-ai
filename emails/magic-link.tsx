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
  Button,
} from "@react-email/components";

type MagicLinkProps = {
  email: string;
  link: string;
};

export default function MagicLinkEmail({ email, link }: MagicLinkProps) {
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
              <Text>To complete the sign-in process; click the link below</Text>
              <Button
                className="text-md font-bold rounded-xl py-3 px-5 bg-neutral-900 text-slate-50 text-center"
                href={`${link}`}
              >
                Open Chat
              </Button>
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
