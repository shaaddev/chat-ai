"use client";
import { useState } from "react";
import { ThemeChanger } from "../theme-changer";
import { Profile } from "./profile";
import { AccountSidebar } from "./sidebar";
import { Usage } from "./usage/usage";

interface AccountProps {
  user: {
    email: string;
    name: string;
    image: string | null;
  };
  initialTab?: string;
}

export function Account({ user, initialTab }: AccountProps) {
  const [activeSection, setActiveSection] = useState(() => {
    if (initialTab === "saved") return "saved";
    if (initialTab === "appearance") return "appearance";
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
    <div className="container mx-auto py-10 h-[500px]">
      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <AccountSidebar setActiveSection={setActiveSection} />
        <div className="w-full max-w-3xl">
          <div className="">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}
