import { Stethoscope } from "lucide-react";
import { listUsers } from "@/services/user";
import { SignInPicker } from "./picker";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [users, params] = await Promise.all([listUsers(), searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Sign in to Mira
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose a workspace member to continue. SSO will land in the next phase.
          </p>
        </div>
        <SignInPicker
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            avatarHue: u.avatarHue,
          }))}
          next={params.next ?? "/"}
        />
        <p className="text-center text-[11px] text-muted-foreground">
          This is a demo session. No password is required while sample accounts are active.
        </p>
      </div>
    </div>
  );
}
