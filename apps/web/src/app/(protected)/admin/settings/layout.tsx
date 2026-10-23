import { requireMenu } from "@/lib/require-menu";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMenu("settings");
  return <>{children}</>;
}
