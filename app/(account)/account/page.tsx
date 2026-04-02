import { redirect } from "next/navigation";
import { Account } from "@/components/account/account";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";

export default async function Page() {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      redirect("/");
    }

    const user = await fetchAuthQuery(api.auth.getCurrentUser);

    if (!user) {
      redirect("/");
    }

    const { email, name, image } = user;

    return (
      <div className="w-full">
        <Account user={{ email, name, image: image ?? null }} />
      </div>
    );
  } catch {
    // Handle any auth errors by redirecting to home
    redirect("/");
  }
}
