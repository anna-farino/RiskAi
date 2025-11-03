import { useAuth } from "@/hooks/use-auth";
import { SettingsHeader } from "./SettingsHeader";
import { SettingsAccountSecurity } from "./SettingsAccountSecurity";
import { SettingsSubscription } from "./SettingsSubscription";

export default function Settings() {
  const userData = useAuth();

  return (
    <div className="flex flex-col gap-4 mb-[120px]">
      <SettingsHeader twoFactorEnabled={userData.data?.twoFactorEnabled} />

      {/* 2-Column Layout for Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mx-4 lg:mx-0">
        <SettingsAccountSecurity />
        <SettingsSubscription />
      </div>
    </div>
  );
}
