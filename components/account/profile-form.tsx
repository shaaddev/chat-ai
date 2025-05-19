import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { useEffect } from "react";

interface ProfileFormProps {
  profileImage: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fullName: string;
  email: string;
}

export function ProfileForm({
  profileImage,
  handleSubmit,
  handleImageUpload,
  fullName,
  email,
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
          <AvatarFallback>
            <UserIcon className="h-12 w-12" />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-center space-y-2">
          <Label
            htmlFor="picture"
            className="cursor-pointer text-sm font-medium text-primary"
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
          placeholder="John Doe"
          required
          className="rounded-2xl"
          {...register("new_fullName", { required: true })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new_email">Email</Label>
        <Input
          id="new_email"
          type="email"
          placeholder="john.doe@example.com"
          required
          className="rounded-2xl"
          {...register("new_email", { required: true })}
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto rounded-2xl">
        Update
      </Button>
    </form>
  );
}
