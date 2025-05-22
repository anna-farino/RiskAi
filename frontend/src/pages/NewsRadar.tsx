import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/logo';
import { ArrowLeft } from 'lucide-react';
import { NewsRadarScanWidget } from '@/components/widgets/NewsRadarWidget';
import { Radar, Shield, Database, Newspaper, Globe, RefreshCw } from 'lucide-react';
import { RisqWidget, WidgetActions, WidgetButton, WidgetGrid } from '@/components/widgets/RisqWidget';

export default function NewsRadar() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2 bg-black/30 p-2 rounded-lg border border-[#BF00FF]/20 hover:bg-[#BF00FF]/10 transition-colors"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5 text-[#00FFFF]" />
            <span>Back</span>
          </motion.button>
          
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <Logo size="md" animated variant="gradient" />
          </motion.div>
          
          <div className="w-[80px]">
            {/* Spacer for alignment */}
          </div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <h1 className="text-3xl font-bold mb-2 text-brand-gradient">News Radar Scanner</h1>
          <p className="text-gray-400">
            Configure and manage news scanning operations
          </p>
        </motion.div>
        
        <div className="mb-8">
          <NewsRadarScanWidget />
        </div>
        
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Scanner Configuration</h2>
          <WidgetGrid>
            <RisqWidget
              title="News Sources"
              description="Manage news sources for scanning"
              icon={<Globe className="w-10 h-10" />}
              variant="interactive"
              footer={
                <WidgetActions explanation="140 active sources">
                  <WidgetButton variant="ghost">
                    <Shield className="mr-2 h-4 w-4" />
                    Validate
                  </WidgetButton>
                  <WidgetButton variant="secondary">
                    <Database className="mr-2 h-4 w-4" />
                    Import
                  </WidgetButton>
                  <WidgetButton variant="primary">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </WidgetButton>
                </WidgetActions>
              }
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10">
                  <div className="flex items-center">
                    <Newspaper className="w-5 h-5 mr-3 text-[#00FFFF]" />
                    <span>Security Weekly</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Active</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10">
                  <div className="flex items-center">
                    <Newspaper className="w-5 h-5 mr-3 text-[#00FFFF]" />
                    <span>Krebs on Security</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Active</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10">
                  <div className="flex items-center">
                    <Newspaper className="w-5 h-5 mr-3 text-[#00FFFF]" />
                    <span>Dark Reading</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Active</span>
                  </div>
                </div>
              </div>
            </RisqWidget>
            
            <RisqWidget
              title="Scan Schedule"
              description="Configure automated scan schedules"
              icon={<RefreshCw className="w-10 h-10" />}
              variant="standard"
              footer={
                <WidgetActions explanation="Next scan in 12 minutes">
                  <WidgetButton variant="ghost">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset
                  </WidgetButton>
                  <WidgetButton variant="secondary">
                    <Database className="mr-2 h-4 w-4" />
                    History
                  </WidgetButton>
                  <WidgetButton variant="primary">
                    <Radar className="mr-2 h-4 w-4" />
                    Start
                  </WidgetButton>
                </WidgetActions>
              }
            >
              <div className="space-y-3">
                <div className="bg-black/30 p-4 rounded-lg border border-[#BF00FF]/10">
                  <h4 className="font-medium mb-2">Default Schedule</h4>
                  <div className="text-sm text-gray-400 space-y-2">
                    <div className="flex justify-between">
                      <span>Frequency:</span>
                      <span className="text-white">Every 30 minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active hours:</span>
                      <span className="text-white">24/7</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last scan:</span>
                      <span className="text-white">18 minutes ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </RisqWidget>
          </WidgetGrid>
        </div>
      </div>
    </div>
  );
}