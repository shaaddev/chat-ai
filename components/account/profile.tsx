import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { ProfileForm } from "./profile-form";

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
    const newName = formData.get("new_fullName") as string;

    if (!newName) {
      toast.error("Name is required");
      setIsPending(false);
      return;
    }

    try {
      const updateData: { name: string; image?: string } = { name: newName };

      // Include the profile image if one was uploaded
      if (profileImage) {
        updateData.image = profileImage;
      }

      const { error } = await authClient.updateUser(updateData);

      if (error) {
        toast.error("Failed to update profile", {
          description: error.message ?? "Please try again.",
        });
      } else {
        toast.success("Success!", {
          description: "Profile updated successfully!",
        });
      }
    } catch {
      toast.error("Failed to update profile", {
        description: "An unexpected error occurred. Please try again.",
      });
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
    <Card className="rounded-2xl ">
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
