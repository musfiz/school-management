import { requireMenu } from "@/lib/require-menu";

export default async function AdmissionsSettingsLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("admission_settings");
  return <>{children}</>;
}
