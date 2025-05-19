"use client";
import { AccountSidebar } from "./sidebar";
import { Profile } from "./profile";

export function Account() {
  return (
    <div className="container mx-auto py-10">
      <div className="grid gap-8 md:grid-cols-[250px_1fr]">
        <AccountSidebar />
        <Profile />
      </div>
    </div>
  );
}
