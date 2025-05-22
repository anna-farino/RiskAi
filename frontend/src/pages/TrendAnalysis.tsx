import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/logo';
import { ArrowLeft, TrendingUp, BarChart, PieChart, LineChart, Calendar, Download, Filter } from 'lucide-react';
import { TrendAnalysisWidget } from '@/components/widgets/NewsRadarWidget';
import { RisqWidget, WidgetActions, WidgetButton, WidgetGrid } from '@/components/widgets/RisqWidget';

export default function TrendAnalysis() {
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
          <h1 className="text-3xl font-bold mb-2 text-brand-gradient">Trend Analysis</h1>
          <p className="text-gray-400">
            Security trends based on news data analytics
          </p>
        </motion.div>
        
        {/* Time period selector */}
        <div className="mb-8 bg-black/30 border border-[#BF00FF]/20 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="text-[#00FFFF] h-5 w-5" />
            <span className="font-medium">Analysis Period:</span>
            <select className="bg-black/50 text-white border border-[#BF00FF]/20 rounded-lg py-1 px-3" defaultValue="Last 30 days">
              <option>Last 7 days</option>
              <option>Last 14 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
              <option>Custom range</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded-lg bg-black/50 text-gray-300 flex items-center gap-2 hover:bg-black/70">
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <button className="px-3 py-1 rounded-lg bg-black/50 text-gray-300 flex items-center gap-2 hover:bg-black/70">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
        
        {/* Metrics overview */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Trend Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-gradient-to-b from-[#300A45]/80 to-black/80 border border-[#BF00FF]/20 rounded-lg p-6 text-center"
            >
              <div className="inline-flex items-center justify-center p-3 bg-[#BF00FF]/20 rounded-full mb-4">
                <TrendingUp className="h-6 w-6 text-[#BF00FF]" />
              </div>
              <div className="text-3xl font-bold text-[#00FFFF] mb-1">+24%</div>
              <div className="text-sm text-gray-400">Ransomware Mentions</div>
              <div className="text-xs text-[#BF00FF] mt-2">Significant increase</div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-gradient-to-b from-[#300A45]/80 to-black/80 border border-[#BF00FF]/20 rounded-lg p-6 text-center"
            >
              <div className="inline-flex items-center justify-center p-3 bg-[#FF00BF]/20 rounded-full mb-4">
                <TrendingUp className="h-6 w-6 text-[#FF00BF]" />
              </div>
              <div className="text-3xl font-bold text-[#FF00BF] mb-1">+18%</div>
              <div className="text-sm text-gray-400">Zero-Day Vulnerabilities</div>
              <div className="text-xs text-[#FF00BF] mt-2">Moderate increase</div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="bg-gradient-to-b from-[#300A45]/80 to-black/80 border border-[#BF00FF]/20 rounded-lg p-6 text-center"
            >
              <div className="inline-flex items-center justify-center p-3 bg-green-500/20 rounded-full mb-4">
                <TrendingUp className="h-6 w-6 text-green-500 rotate-180" />
              </div>
              <div className="text-3xl font-bold text-green-400 mb-1">-7%</div>
              <div className="text-sm text-gray-400">DDoS Attacks</div>
              <div className="text-xs text-green-400 mt-2">Decreased occurrence</div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="bg-gradient-to-b from-[#300A45]/80 to-black/80 border border-[#BF00FF]/20 rounded-lg p-6 text-center"
            >
              <div className="inline-flex items-center justify-center p-3 bg-yellow-500/20 rounded-full mb-4">
                <TrendingUp className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="text-3xl font-bold text-yellow-400 mb-1">+12%</div>
              <div className="text-sm text-gray-400">Phishing Campaigns</div>
              <div className="text-xs text-yellow-400 mt-2">Gradual increase</div>
            </motion.div>
          </div>
        </div>
        
        {/* Chart widgets */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Trend Visualization</h2>
          <WidgetGrid>
            <RisqWidget
              title="Threat Type Distribution"
              description="Breakdown of security threats by category"
              icon={<PieChart className="w-10 h-10" />}
              variant="metric"
              className="col-span-1 md:col-span-2"
              footer={
                <WidgetActions explanation="Based on 30-day news analysis">
                  <WidgetButton variant="ghost">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </WidgetButton>
                  <WidgetButton variant="secondary">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </WidgetButton>
                  <WidgetButton variant="primary">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Details
                  </WidgetButton>
                </WidgetActions>
              }
            >
              <div className="relative h-64 w-full flex items-center justify-center">
                {/* Placeholder for pie chart */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-40 h-40 rounded-full border-8 border-[#BF00FF]/30 relative">
                    <div className="absolute inset-0 border-8 border-transparent border-t-[#00FFFF] rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
                    <div className="absolute inset-2 border-8 border-transparent border-r-[#FF00BF] rounded-full animate-spin" style={{ animationDuration: '6s' }}></div>
                  </div>
                </div>
                <div className="z-10 text-center">
                  <div className="text-xl font-bold mb-1">240</div>
                  <div className="text-sm text-gray-300">Total Threats</div>
                </div>
              </div>
            </RisqWidget>
            
            <RisqWidget
              title="Threat Intensity Over Time"
              description="Monthly trend analysis of major threats"
              icon={<LineChart className="w-10 h-10" />}
              variant="standard"
              className="col-span-1 md:col-span-2"
              footer={
                <WidgetActions explanation="Showing top 4 threat categories">
                  <WidgetButton variant="ghost">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </WidgetButton>
                  <WidgetButton variant="secondary">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </WidgetButton>
                  <WidgetButton variant="primary">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Details
                  </WidgetButton>
                </WidgetActions>
              }
            >
              <div className="relative h-64 w-full bg-black/30 rounded-lg border border-[#BF00FF]/10 p-4">
                {/* Placeholder for line chart */}
                <div className="absolute inset-x-0 bottom-0 h-px bg-[#BF00FF]/20"></div>
                <div className="absolute inset-y-0 left-0 w-px bg-[#BF00FF]/20"></div>
                
                {/* Ransomware line - stylized placeholder */}
                <div className="absolute left-0 right-0 bottom-10 h-px bg-[#00FFFF]/30 z-10">
                  <div className="absolute left-0 bottom-0 h-20 w-full bg-gradient-to-t from-[#00FFFF]/5 to-transparent"></div>
                  <div className="absolute left-0 bottom-0 h-px w-full bg-[#00FFFF]" style={{ clipPath: 'polygon(0% 0%, 10% 30%, 20% 15%, 30% 50%, 40% 25%, 50% 60%, 60% 40%, 70% 80%, 80% 95%, 90% 70%, 100% 100%)' }}></div>
                </div>
                
                {/* Zero-day line - stylized placeholder */}
                <div className="absolute left-0 right-0 bottom-20 h-px bg-[#FF00BF]/30 z-10">
                  <div className="absolute left-0 bottom-0 h-16 w-full bg-gradient-to-t from-[#FF00BF]/5 to-transparent"></div>
                  <div className="absolute left-0 bottom-0 h-px w-full bg-[#FF00BF]" style={{ clipPath: 'polygon(0% 30%, 10% 20%, 20% 40%, 30% 10%, 40% 50%, 50% 30%, 60% 70%, 70% 50%, 80% 60%, 90% 80%, 100% 90%)' }}></div>
                </div>
              </div>
            </RisqWidget>
          </WidgetGrid>
        </div>
      </div>
    </div>
  );
}