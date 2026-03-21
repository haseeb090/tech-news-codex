import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { LoginForm } from "@/components/admin/login-form";
import { authOptions } from "@/lib/auth/options";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role === "admin") {
    redirect("/admin");
  }

  return (
    <main id="main-content" className="mx-auto max-w-lg py-16">
      <LoginForm />
    </main>
  );
}
