import { UserIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileFormProps {
  profileImage: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fullName: string;
  email: string;
  isPending: boolean;
}

export function ProfileForm({
  profileImage,
  handleSubmit,
  handleImageUpload,
  fullName,
  email,
  isPending,
}: ProfileFormProps) {
  const { register, setValue } = useForm();

  useEffect(() => {
    setValue("new_fullName", fullName);
    setValue("new_email", email);
  }, [fullName, email, setValue]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col items-center space-y-4">
        <Avatar className="h-24 w-24">
          <AvatarImage src={profileImage || ""} alt="Profile picture" />
          <AvatarFallback className="bg-muted">
            <UserIcon className="h-12 w-12 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-center space-y-2">
          <Label
            htmlFor="picture"
            className="cursor-pointer text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Change profile picture
          </Label>
          <Input
            id="picture"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new_fullName">Full Name</Label>
        <Input
          id="new_fullName"
          placeholder="Your name"
          required
          className="rounded-xl"
          {...register("new_fullName", { required: true })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new_email">Email</Label>
        <Input
          id="new_email"
          type="email"
          placeholder="you@example.com"
          className="rounded-xl bg-muted cursor-not-allowed"
          disabled
          {...register("new_email")}
        />
        <p className="text-xs text-muted-foreground">
          Email cannot be changed from this page.
        </p>
      </div>

      <Button
        type="submit"
        className="rounded-xl"
        disabled={isPending}
      >
        {isPending ? "Updating..." : "Update Profile"}
      </Button>
    </form>
  );
}
