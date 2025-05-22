import { RisqCard, RisqCardContent, RisqCardHeader, RisqCardTitle, RisqCardDescription } from "@/components/ui/risq-card";
import { RisqButton } from "@/components/ui/risq-button";
import { Settings, Bell, Clock, Save, Tags } from "lucide-react";
import { useState } from "react";

export default function NewsCapsulePreferences() {
  // Sample state for preferences - would be connected to API in real implementation
  const [preferences, setPreferences] = useState({
    autoGenerateCapsules: true,
    frequencyHours: 24,
    receiveNotifications: true,
    notifyOnKeywords: true,
    includeAnalytics: true,
    maxArticlesPerCapsule: 50
  });

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    // Would submit to API in real implementation
    console.log("Saving preferences:", preferences);
    // Add toast notification here in real implementation
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Capsule Preferences</h2>
        <RisqButton 
          variant="primary" 
          onClick={handleSave}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save Changes
        </RisqButton>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <RisqCard variant="glass">
          <RisqCardHeader>
            <RisqCardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Capsule Timing
            </RisqCardTitle>
            <RisqCardDescription>
              Configure when and how your news capsules are generated
            </RisqCardDescription>
          </RisqCardHeader>
          <RisqCardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-Generate Capsules</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically create news capsules at specified intervals
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={preferences.autoGenerateCapsules}
                    onChange={() => handleToggle('autoGenerateCapsules')}
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Capsule Frequency</label>
                <select 
                  className="w-full rounded-md border border-muted bg-background px-3 py-2"
                  value={preferences.frequencyHours}
                  onChange={(e) => setPreferences({...preferences, frequencyHours: Number(e.target.value)})}
                  disabled={!preferences.autoGenerateCapsules}
                >
                  <option value={6}>Every 6 hours</option>
                  <option value={12}>Every 12 hours</option>
                  <option value={24}>Daily (24 hours)</option>
                  <option value={168}>Weekly (7 days)</option>
                  <option value={720}>Monthly (30 days)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Maximum Articles Per Capsule</label>
                <input 
                  type="number" 
                  className="w-full rounded-md border border-muted bg-background px-3 py-2"
                  value={preferences.maxArticlesPerCapsule}
                  onChange={(e) => setPreferences({...preferences, maxArticlesPerCapsule: Number(e.target.value)})}
                  min={10}
                  max={1000}
                />
              </div>
            </div>
          </RisqCardContent>
        </RisqCard>

        <RisqCard variant="glass">
          <RisqCardHeader>
            <RisqCardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </RisqCardTitle>
            <RisqCardDescription>
              Manage notification preferences for capsule updates
            </RisqCardDescription>
          </RisqCardHeader>
          <RisqCardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Receive Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when new capsules are generated
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={preferences.receiveNotifications}
                    onChange={() => handleToggle('receiveNotifications')}
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Keyword Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Get alerted when high-priority keywords are detected
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={preferences.notifyOnKeywords}
                    onChange={() => handleToggle('notifyOnKeywords')}
                    disabled={!preferences.receiveNotifications}
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Include Analytics</p>
                  <p className="text-sm text-muted-foreground">
                    Include trend analysis and data insights in notifications
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={preferences.includeAnalytics}
                    onChange={() => handleToggle('includeAnalytics')}
                    disabled={!preferences.receiveNotifications}
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </RisqCardContent>
        </RisqCard>
      </div>
    </div>
  );
}