import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserIcon } from "lucide-react";

interface ProfileFormProps {
  profileImage: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ProfileForm({
  profileImage,
  handleSubmit,
  handleImageUpload,
}: ProfileFormProps) {
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            placeholder="John"
            required
            className="rounded-2xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            placeholder="Doe"
            required
            className="rounded-2xl"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="john.doe@example.com"
          required
          className="rounded-2xl"
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto rounded-2xl">
        Update
      </Button>
    </form>
  );
}
