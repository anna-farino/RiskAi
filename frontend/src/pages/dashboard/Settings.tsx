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
import { Bell, Globe, AlertTriangle, Clock, Mail } from "lucide-react";

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

      <div className="flex flex-col gap-y-8 w-full h-full">
        
        {/* Security Settings Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#BF00FF]" />
            Security & Authentication
          </h2>
          
          <div className="grid gap-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Two-Factor Authentication</Label>
                <p className="text-sm text-gray-400">Add an extra layer of security to your account</p>
              </div>
              <Switch
                id="two-factor-authentication"
                checked={twoFAmutation.isPending ? twoFAmutation.variables : !!userData.data?.twoFactorEnabled}
                onClick={() => twoFAmutation.mutate(!userData.data?.twoFactorEnabled)}
              />
              {error && 
                <span className="text-destructive text-sm">An error occurred! Try again later</span>
              }
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Reset Password</Label>
                <p className="text-sm text-gray-400">Change your account password</p>
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
                <Button variant="outline">
                  Reset Password
                </Button>
              </CustomAlertDialog>
            </div>
          </div>
        </div>

        <Separator className="bg-[#BF00FF]/20" />

        {/* News Intelligence Preferences Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-[#00FFFF]" />
            News Intelligence Preferences
          </h2>
          
          <div className="grid gap-8">
            
            {/* Notification Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#BF00FF]" />
                Notification Settings
              </h3>
              <div className="grid gap-4 pl-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Email Alerts</Label>
                    <p className="text-sm text-gray-400">Receive threat alerts via email</p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">SMS Alerts</Label>
                    <p className="text-sm text-gray-400">Receive critical alerts via SMS</p>
                  </div>
                  <Switch
                    checked={smsNotifications}
                    onCheckedChange={setSmsNotifications}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-base">Threat Level Threshold</Label>
                  <Select value={threatLevelThreshold} onValueChange={setThreatLevelThreshold}>
                    <SelectTrigger className="w-48 bg-black/50 border-[#BF00FF]/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-[#BF00FF]/20">
                      <SelectItem value="low">Low - All threats</SelectItem>
                      <SelectItem value="medium">Medium - Moderate & High</SelectItem>
                      <SelectItem value="high">High - Critical only</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-400">Only receive alerts for threats at or above this level</p>
                </div>
              </div>
            </div>

            {/* Source Preferences */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#00FFFF]" />
                Source Preferences
              </h3>
              <div className="grid gap-4 pl-6">
                <div className="space-y-2">
                  <Label className="text-base">Favorite News Sources</Label>
                  <Input
                    placeholder="e.g., Reuters, BBC, CNN"
                    value={favoriteSource}
                    onChange={(e) => setFavoriteSource(e.target.value)}
                    className="bg-black/50 border-[#BF00FF]/20"
                  />
                  <p className="text-sm text-gray-400">Prioritize content from these sources</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-base">Custom RSS Feeds</Label>
                  <Input
                    placeholder="https://example.com/feed.xml"
                    value={customRssFeed}
                    onChange={(e) => setCustomRssFeed(e.target.value)}
                    className="bg-black/50 border-[#BF00FF]/20"
                  />
                  <p className="text-sm text-gray-400">Add custom RSS feeds to monitor</p>
                </div>
              </div>
            </div>

            {/* Keyword Alerts */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#BF00FF]" />
                Keyword Alerts
              </h3>
              <div className="grid gap-4 pl-6">
                <div className="space-y-2">
                  <Label className="text-base">Personal Watchlist</Label>
                  <Input
                    placeholder="cybersecurity, data breach, malware"
                    value={keywordAlert}
                    onChange={(e) => setKeywordAlert(e.target.value)}
                    className="bg-black/50 border-[#BF00FF]/20"
                  />
                  <p className="text-sm text-gray-400">Comma-separated keywords to monitor</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-base">Alert Severity</Label>
                  <Select value={keywordSeverity} onValueChange={setKeywordSeverity}>
                    <SelectTrigger className="w-48 bg-black/50 border-[#BF00FF]/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-[#BF00FF]/20">
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-400">Priority level for keyword matches</p>
                </div>
              </div>
            </div>

            {/* Report Frequency */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#00FFFF]" />
                Report Frequency
              </h3>
              <div className="grid gap-4 pl-6">
                <div className="space-y-2">
                  <Label className="text-base">Digest Preferences</Label>
                  <Select value={reportFrequency} onValueChange={setReportFrequency}>
                    <SelectTrigger className="w-48 bg-black/50 border-[#BF00FF]/20">
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
                  <p className="text-sm text-gray-400">How often to receive digest reports</p>
                </div>
              </div>
            </div>

            {/* Time Zone Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#BF00FF]" />
                Time Zone Settings
              </h3>
              <div className="grid gap-4 pl-6">
                <div className="space-y-2">
                  <Label className="text-base">Display Time Zone</Label>
                  <Select value={timeZone} onValueChange={setTimeZone}>
                    <SelectTrigger className="w-64 bg-black/50 border-[#BF00FF]/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-[#BF00FF]/20">
                      <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                      <SelectItem value="EST">EST (Eastern Standard Time)</SelectItem>
                      <SelectItem value="PST">PST (Pacific Standard Time)</SelectItem>
                      <SelectItem value="GMT">GMT (Greenwich Mean Time)</SelectItem>
                      <SelectItem value="CET">CET (Central European Time)</SelectItem>
                      <SelectItem value="JST">JST (Japan Standard Time)</SelectItem>
                      <SelectItem value="CST">CST (China Standard Time)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-400">All timestamps will be displayed in this time zone</p>
                </div>
              </div>
            </div>

          </div>
          
          <div className="flex justify-end pt-4">
            <Button className="bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] text-white">
              Save Preferences
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
