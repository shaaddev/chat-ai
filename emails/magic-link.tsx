import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import React from "react";

interface MagicLinkProps {
  email: string;
  link: string;
}

export default function MagicLinkEmail({ email, link }: MagicLinkProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-[#f5f5f5] p-10 font-sans">
          <Container className="rounded-lg border border-black px-5 py-2 shadow-md">
            <Section className="flex items-center justify-center">
              <Text className="text-center font-medium text-lg">
                Verify your email to sign-in to{" "}
                <span className="font-bold">Chat - Shaaddev</span>
              </Text>
            </Section>
            <Section>
              <Text className="text-sm">Hello {email},</Text>
              <Text>We have received a sign-in attempt.</Text>
              <Text>To complete the sign-in process; click the link below</Text>
              <Section className="flex items-center justify-center">
                <Button
                  className="rounded-xl bg-neutral-900 px-5 py-3 text-center font-bold text-md text-slate-50"
                  href={`${link}`}
                >
                  Open Chat
                </Button>
              </Section>
            </Section>
            <Hr className="mt-5 border-[#cccccc]" />
            <Text className="text-center text-[#8898aa] text-xs leading-7">
              If you {"didn't"} attempt to sign-in but received this email,
              please ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
