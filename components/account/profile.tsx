import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { useState } from "react";
import { updateUser } from "./action";
import { toast } from "sonner";

interface UserInfo {
  email: string;
  name: string;
  image: string | null;
}

export function Profile({ user_info }: { user_info: UserInfo }) {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.target as HTMLFormElement);

    try {
      const res = await updateUser(formData);

      if (res.success) {
        toast.success("Success!", {
          description: "Profile updated successfully!",
        });
      } else {
        toast.error("Failed to update profile", {
          description: "Please try again.",
        });
      }
    } catch (error) {
      return {
        error: error,
      };
    } finally {
      setIsPending(false);
    }
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
          isPending={isPending}
        />
      </CardContent>
    </Card>
  );
}
