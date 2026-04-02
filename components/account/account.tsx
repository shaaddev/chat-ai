"use client";
import { useState } from "react";
import { ThemeChanger } from "../theme-changer";
import { Profile } from "./profile";
import { AccountSidebar } from "./sidebar";
import { Usage } from "./usage/usage";

interface AccountProps {
  initialTab?: string;
  user: {
    email: string;
    name: string;
    image: string | null;
  };
}

export function Account({ user, initialTab }: AccountProps) {
  const [activeSection, setActiveSection] = useState(() => {
    if (initialTab === "appearance") {
      return "appearance";
    }
    if (initialTab === "usage") {
      return "usage";
    }
    return "profile";
  });

  const renderContent = () => {
    switch (activeSection) {
      case "profile":
        return <Profile user_info={user} />;
      case "usage":
        return <Usage />;
      case "appearance":
        return <ThemeChanger />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto min-h-[calc(100vh-4rem)] py-10">
      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <AccountSidebar setActiveSection={setActiveSection} />
        <div className="w-full max-w-2xl">{renderContent()}</div>
      </div>
    </div>
  );
}
