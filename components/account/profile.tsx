import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { useState } from "react";

interface UserInfo {
  email: string;
  name: string;
  image: string | null;
}

export function Profile({ user_info }: { user_info: UserInfo }) {
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the form data to the server
    alert("Profile updated successfully!");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your account information and profile picture
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm
          profileImage={profileImage}
          handleSubmit={handleSubmit}
          handleImageUpload={handleImageUpload}
          fullName={user_info.name}
          email={user_info.email}
        />
      </CardContent>
    </Card>
  );
}
