import { CustomAlertDialog } from "@/components/custom-alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { csfrHeader } from "@/utils/csrf-header";
import { useFetch } from "@/hooks/use-fetch"; 
import { serverUrl } from "@/utils/server-url";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Globe, AlertTriangle, Clock, Mail, Shield } from "lucide-react";
import SampleDataPopulator from "@/components/SampleDataPopulator";

export default function Settings() {
  const [ resetOpen, setResetOpen ] = useState(false)
  const [ error, setError ] = useState(false)
  const userData = useAuth()
  const fetchWithAuth = useFetch();
  
  // News Intelligence Preferences state
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(false)
  const [threatLevelThreshold, setThreatLevelThreshold] = useState("medium")
  const [favoriteSource, setFavoriteSource] = useState("")
  const [customRssFeed, setCustomRssFeed] = useState("")
  const [keywordAlert, setKeywordAlert] = useState("")
  const [keywordSeverity, setKeywordSeverity] = useState("high")
  const [reportFrequency, setReportFrequency] = useState("daily")
  const [timeZone, setTimeZone] = useState("UTC")
  
  // Account Management state
  const [dataRetention, setDataRetention] = useState("12months")

  const twoFAmutation = useMutation({
    mutationFn: (newTwoFAvalue: boolean) => {
      //throw new Error("test") //Error for testing. To be removed soon
      return fetchWithAuth(`/api/users/${userData.data?.id}/2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          twoFactorEnabled: newTwoFAvalue 
        })
      })
    },
    onSettled: () => userData.refetch(),
    onError: () => {
      setError(true)
      setTimeout(()=>setError(false),3000)
    }
  })

  const navigate = useNavigate();

  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      if (!userData.data?.email) throw new Error()
      const response = await fetchWithAuth(`${serverUrl}/api/auth/new-password-otp`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userData.data?.email
        })
      })
      if (!response.ok) throw new Error("No response")
    },
    onSuccess() {
      navigate('/dashboard/settings/otp?p=npw')
    },
    onError(error) {
      console.error(error)
    },
  })
  //console.log(userData.data)

  return (
    <div className="flex flex-col gap-4">
      {/* Settings Header - Similar to News Capsule */}
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
                <span>{!!userData.data?.twoFactorEnabled ? 'MFA Enabled' : 'MFA Disabled'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sectioned Widget Layout */}
      <div className="space-y-4 w-full">
        
        {/* Account & Security Section */}
        <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md transition-all duration-300 mx-4 lg:mx-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                <Shield className="h-6 w-6 text-[#BF00FF]" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-white">Account & Security</span>
                <span className="text-sm text-slate-400">Manage your account protection and privacy settings</span>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-base font-medium text-white">Two-Factor Authentication</Label>
                  <p className="text-sm text-slate-400 mt-1">Extra security layer for your account</p>
                </div>
                <Switch
                  id="two-factor-authentication"
                  disabled={twoFAmutation.isPending}
                  checked={twoFAmutation.isPending ? twoFAmutation.variables : !!userData.data?.twoFactorEnabled}
                  onClick={() => twoFAmutation.mutate(!userData.data?.twoFactorEnabled)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-base font-medium text-white">Reset Password</Label>
                  <p className="text-sm text-slate-400 mt-1">Change your account password</p>
                </div>
                <CustomAlertDialog
                  title="Reset Password?"
                  description={`An OTP-code will be sent to your email upon clicking 'Confirm'`}
                  action={sendOtpMutation.mutate}
                  open={resetOpen}
                  setOpen={setResetOpen}
                  twGapClass="gap-8"
                  twMaxWidthClass="max-w-sm"
                >
                  <Button variant="outline" size="sm">
                    Reset
                  </Button>
                </CustomAlertDialog>
              </div>
              {error && 
                <div className="text-destructive text-sm bg-red-500/10 border border-red-500/20 p-3 rounded">
                  An error occurred! Try again later
                </div>
              }
            </div>
          </div>
        </div>
        
        {/* Intelligence Preferences Section */}
        {false && <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
              <Globe className="h-6 w-6 text-[#00FFFF]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Intelligence Preferences</h2>
              <p className="text-sm text-gray-400">Configure your news monitoring and filtering settings</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sources Widget */}
            <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-md p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                  <Globe className="h-5 w-5 text-[#00FFFF]" />
                </div>
                <h2 className="text-xl font-semibold text-white">Sources</h2>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">Favorite Sources</Label>
                  <Input
                    placeholder="Reuters, BBC, CNN"
                    value={favoriteSource}
                    onChange={(e) => setFavoriteSource(e.target.value)}
                    className="bg-black/50 border-[#BF00FF]/20 text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">Custom RSS Feed</Label>
                  <Input
                    placeholder="https://example.com/feed.xml"
                    value={customRssFeed}
                    onChange={(e) => setCustomRssFeed(e.target.value)}
                    className="bg-black/50 border-[#BF00FF]/20 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Keywords Widget */}
            <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-md p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                  <AlertTriangle className="h-5 w-5 text-[#BF00FF]" />
                </div>
                <h2 className="text-xl font-semibold text-white">Keywords</h2>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">Watchlist</Label>
                  <Input
                    placeholder="cybersecurity, breach, malware"
                    value={keywordAlert}
                    onChange={(e) => setKeywordAlert(e.target.value)}
                    className="bg-black/50 border-[#BF00FF]/20 text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">Alert Priority</Label>
                  <Select value={keywordSeverity} onValueChange={setKeywordSeverity}>
                    <SelectTrigger className="bg-black/50 border-[#BF00FF]/20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-[#BF00FF]/20">
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>}

        {/* Notifications & Reports Section */}
        {false && <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
              <Mail className="h-6 w-6 text-[#00FFFF]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Notifications & Reports</h2>
              <p className="text-sm text-gray-400">Control how and when you receive information</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notifications Widget */}
            <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-md p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                  <Mail className="h-5 w-5 text-[#00FFFF]" />
                </div>
                <h2 className="text-xl font-semibold text-white">Notifications</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-white">Email Alerts</Label>
                    <p className="text-xs text-gray-400">Threat notifications</p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-white">SMS Alerts</Label>
                    <p className="text-xs text-gray-400">Critical alerts only</p>
                  </div>
                  <Switch
                    checked={smsNotifications}
                    onCheckedChange={setSmsNotifications}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">Threat Threshold</Label>
                  <Select value={threatLevelThreshold} onValueChange={setThreatLevelThreshold}>
                    <SelectTrigger className="bg-black/50 border-[#BF00FF]/20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-[#BF00FF]/20">
                      <SelectItem value="low">Low - All threats</SelectItem>
                      <SelectItem value="medium">Medium - Moderate & High</SelectItem>
                      <SelectItem value="high">High - Critical only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Reports Widget */}
            <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-md p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                  <Clock className="h-5 w-5 text-[#00FFFF]" />
                </div>
                <h2 className="text-xl font-semibold text-white">Reports</h2>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">Digest Frequency</Label>
                  <Select value={reportFrequency} onValueChange={setReportFrequency}>
                    <SelectTrigger className="bg-black/50 border-[#BF00FF]/20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-[#BF00FF]/20">
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">Time Zone</Label>
                  <Select value={timeZone} onValueChange={setTimeZone}>
                    <SelectTrigger className="bg-black/50 border-[#BF00FF]/20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-[#BF00FF]/20">
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="EST">EST</SelectItem>
                      <SelectItem value="PST">PST</SelectItem>
                      <SelectItem value="GMT">GMT</SelectItem>
                      <SelectItem value="CET">CET</SelectItem>
                      <SelectItem value="JST">JST</SelectItem>
                      <SelectItem value="CST">CST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            
          </div>
        </div>}

        {/* Developer Tools Section */}
        <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md transition-all duration-300 mx-4 lg:mx-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                <Shield className="h-6 w-6 text-[#BF00FF]" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-white">Developer Tools</span>
                <span className="text-sm text-slate-400">Development and testing utilities</span>
              </div>
            </div>
            
            <SampleDataPopulator />
          </div>
        </div>
        
      </div>
    </div>
  );
}
