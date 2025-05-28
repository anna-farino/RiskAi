import { CustomAlertDialog } from "@/components/custom-alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { csfrHeader } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Globe, AlertTriangle, Clock, Mail, Shield } from "lucide-react";

export default function Settings() {
  const [ resetOpen, setResetOpen ] = useState(false)
  const [ error, setError ] = useState(false)
  const userData = useAuth()
  
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
      return fetch(serverUrl + `/api/users/${userData.data?.id}/2fa`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          [csfrHeader().name]: csfrHeader().token 
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
      const response = await fetch(`${serverUrl}/api/auth/new-password-otp`, {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">
          Settings
        </h1>
      </div>

      {/* Sectioned Widget Layout */}
      <div className="space-y-12 w-full">
        
        {/* Account & Security Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
              <Bell className="h-6 w-6 text-[#BF00FF]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Account & Security</h2>
              <p className="text-sm text-gray-400">Manage your account protection and privacy settings</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Security Widget */}
            <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-xl p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
                  <Shield className="h-5 w-5 text-[#BF00FF]" />
                </div>
                <h2 className="text-xl font-semibold text-white">Security</h2>
              </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-base font-medium text-white">Two-Factor Authentication</Label>
                <p className="text-sm text-gray-400 mt-1">Extra security layer</p>
              </div>
              <Switch
                id="two-factor-authentication"
                checked={twoFAmutation.isPending ? twoFAmutation.variables : !!userData.data?.twoFactorEnabled}
                onClick={() => twoFAmutation.mutate(!userData.data?.twoFactorEnabled)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-base font-medium text-white">Reset Password</Label>
                <p className="text-sm text-gray-400 mt-1">Change account password</p>
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
              <div className="text-destructive text-sm bg-red-500/10 p-2 rounded">
                An error occurred! Try again later
              </div>
            }
          </div>
        </div>

            {/* Data Privacy Widget */}
            <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-xl p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
                  <Shield className="h-5 w-5 text-[#00FFFF]" />
                </div>
                <h2 className="text-xl font-semibold text-white">Data Privacy</h2>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">Data Retention</Label>
                  <Select value={dataRetention} onValueChange={setDataRetention}>
                    <SelectTrigger className="bg-black/50 border-[#BF00FF]/20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-[#BF00FF]/20">
                      <SelectItem value="3months">3 Months</SelectItem>
                      <SelectItem value="6months">6 Months</SelectItem>
                      <SelectItem value="12months">12 Months</SelectItem>
                      <SelectItem value="24months">24 Months</SelectItem>
                      <SelectItem value="indefinite">Indefinite</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400">How long to keep your data</p>
                </div>
                
                <div className="space-y-3">
                  <Button variant="outline" size="sm" className="w-full">
                    Download My Data
                  </Button>
                  <Button variant="outline" size="sm" className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10">
                    Request Data Deletion
                  </Button>
                </div>
                
                <div className="text-xs text-gray-400 pt-2">
                  <p>GDPR compliant data processing.</p>
                  <p>Contact support for privacy inquiries.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intelligence Preferences Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
              <Globe className="h-6 w-6 text-[#00FFFF]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Intelligence Preferences</h2>
              <p className="text-sm text-gray-400">Configure your news monitoring and filtering settings</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sources Widget */}
            <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-xl p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
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
            <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-xl p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
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
        </div>

        {/* Notifications & Reports Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
              <Mail className="h-6 w-6 text-[#00FFFF]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Notifications & Reports</h2>
              <p className="text-sm text-gray-400">Control how and when you receive information</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notifications Widget */}
            <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-xl p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
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
            <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-xl p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
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
        </div>
      </div>
    </div>
  );
}
