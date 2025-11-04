import { Shield } from "lucide-react";

interface SettingsHeaderProps {
  twoFactorEnabled: boolean | null | undefined;
}

export function SettingsHeader({ twoFactorEnabled }: SettingsHeaderProps) {
  return (
    <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md transition-all duration-300 mx-4 lg:mx-0">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
              <Shield className="h-6 w-6 text-[#BF00FF]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-white">Platform Settings</span>
              <span className="text-sm text-slate-400">Configure your account, security, and intelligence preferences</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-400 rounded-full"></div>
              <span>Account Active</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>{!!twoFactorEnabled ? 'MFA Enabled' : 'MFA Disabled'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
