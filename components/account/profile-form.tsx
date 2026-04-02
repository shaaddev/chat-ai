import { UserIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileFormProps {
  email: string;
  fullName: string;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  profileImage: string | null;
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
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex flex-col items-center space-y-4">
        <Avatar className="h-24 w-24">
          <AvatarImage alt="Profile picture" src={profileImage || ""} />
          <AvatarFallback className="bg-muted">
            <UserIcon className="h-12 w-12 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-center space-y-2">
          <Label
            className="cursor-pointer font-medium text-primary text-sm transition-colors hover:text-primary/80"
            htmlFor="picture"
          >
            Change profile picture
          </Label>
          <Input
            accept="image/*"
            className="hidden"
            id="picture"
            onChange={handleImageUpload}
            type="file"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new_fullName">Full Name</Label>
        <Input
          className="rounded-xl"
          id="new_fullName"
          placeholder="Your name"
          required
          {...register("new_fullName", { required: true })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new_email">Email</Label>
        <Input
          className="cursor-not-allowed rounded-xl bg-muted"
          disabled
          id="new_email"
          placeholder="you@example.com"
          type="email"
          {...register("new_email")}
        />
        <p className="text-muted-foreground text-xs">
          Email cannot be changed from this page.
        </p>
      </div>

      <Button className="rounded-xl" disabled={isPending} type="submit">
        {isPending ? "Updating..." : "Update Profile"}
      </Button>
    </form>
  );
}
