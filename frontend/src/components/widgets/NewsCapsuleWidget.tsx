import { RisqWidget, WidgetActions, WidgetButton } from "@/components/widgets/RisqWidget";
import { Timer, PlusCircle, BarChart, Files } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function NewsCapsuleWidget({ delay = 0 }) {
  const navigate = useNavigate();
  
  const handleNavigate = () => {
    navigate("/dashboard/capsule/home");
  };

  return (
    <RisqWidget
      title="News Capsule"
      description="Time-based news collection and digestion"
      icon={<Timer className="w-10 h-10" />}
      variant="expandable"
      delay={delay}
      footer={
        <WidgetActions explanation="Collecting news in daily capsules">
          <WidgetButton variant="ghost" onClick={handleNavigate}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Capsule
          </WidgetButton>
          <WidgetButton variant="secondary" onClick={handleNavigate}>
            <BarChart className="mr-2 h-4 w-4" />
            History
          </WidgetButton>
          <WidgetButton variant="primary" onClick={handleNavigate}>
            <Files className="mr-2 h-4 w-4" />
            View Current
          </WidgetButton>
        </WidgetActions>
      }
    >
      <div className="relative h-40 w-full overflow-hidden rounded-lg mb-4 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <div className="absolute inset-0 opacity-30 bg-grid-pattern" />
        <div className="z-10 text-center p-4">
          <div className="text-xl font-bold mb-1">Time-Based Collection</div>
          <div className="text-sm text-gray-300 max-w-[250px] mx-auto">
            Organize your news into digestible time-based capsules for more efficient analysis
          </div>
        </div>
      </div>
    </RisqWidget>
  );
}

export function NewsCapsuleStatsWidget({ delay = 0 }) {
  const navigate = useNavigate();
  
  const handleNavigate = () => {
    navigate("/dashboard/capsule/home");
  };

  return (
    <RisqWidget
      title="Active Capsule Stats"
      description="Current news collection progress"
      icon={<Timer className="w-10 h-10" />}
      variant="standard"
      delay={delay}
      footer={
        <WidgetActions explanation="Daily Digest (Started 4 hours ago)">
          <WidgetButton variant="primary" onClick={handleNavigate}>
            View Details
          </WidgetButton>
        </WidgetActions>
      }
    >
      <div className="space-y-4">
        <div className="bg-black/30 rounded-lg p-3 border border-primary/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Articles Collected</span>
            <span className="text-sm bg-primary/20 text-primary px-2 py-1 rounded">17</span>
          </div>
          <div className="w-full bg-gray-700/30 rounded-full h-2">
            <div className="bg-primary h-2 rounded-full" style={{ width: '34%' }}></div>
          </div>
        </div>
        
        <div className="bg-black/30 rounded-lg p-3 border border-primary/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Time Remaining</span>
            <span className="text-sm bg-primary/20 text-primary px-2 py-1 rounded">20h</span>
          </div>
          <div className="w-full bg-gray-700/30 rounded-full h-2">
            <div className="bg-primary h-2 rounded-full" style={{ width: '17%' }}></div>
          </div>
        </div>
        
        <div className="bg-black/30 rounded-lg p-3 border border-primary/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Last update: 15 minutes ago</span>
            <span className="text-xs text-gray-400">Monitoring 35 sources</span>
          </div>
        </div>
      </div>
    </RisqWidget>
  );
}