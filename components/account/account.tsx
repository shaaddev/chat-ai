"use client";
import { AccountSidebar } from "./sidebar";
import { Profile } from "./profile";

interface UserInfo {
  email: string;
  name: string;
  image: string | null;
}

export function Account({ user_info }: { user_info: UserInfo }) {
  return (
    <div className="container mx-auto py-10">
      <div className="grid gap-8 md:grid-cols-[250px_1fr]">
        <AccountSidebar />
        <Profile user_info={user_info} />
      </div>
    </div>
  );
}
