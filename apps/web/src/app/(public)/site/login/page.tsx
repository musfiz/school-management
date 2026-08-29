import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { getSession, safeReturnTo } from "@/lib/auth";
import { site } from "@/lib/site";

export const metadata = {
  title: `Student & parent sign in — ${site.name}`,
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ returnTo?: string | string[] }>;

export default async function SiteLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { returnTo } = await searchParams;
  const raw = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const safeTo = safeReturnTo(raw);

  // If already signed in, send the user straight to their destination.
  const existing = await getSession();
  if (existing) {
    redirect(safeTo);
  }

  return (
    <div className="bg-white px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-md">``q
        <LoginForm variant="public" returnTo={safeTo} />
      </div>
    </div>
  );
}
