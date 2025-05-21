import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/logo';
import { ArrowLeft, AlertTriangle, Filter, Download, RefreshCw, Bell, CheckCircle, XCircle, Search } from 'lucide-react';
import { ThreatAlertsWidget } from '@/components/widgets/NewsRadarWidget';
import { RisqWidget, WidgetActions, WidgetButton, WidgetGrid } from '@/components/widgets/RisqWidget';

export default function ThreatAlerts() {
  const [filterActive, setFilterActive] = useState(false);
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
          <h1 className="text-3xl font-bold mb-2 text-brand-gradient">Threat Alerts</h1>
          <p className="text-gray-400">
            Critical security alerts requiring attention
          </p>
        </motion.div>
        
        <div className="mb-8">
          {/* Filter controls */}
          <div className="bg-black/30 border border-[#BF00FF]/20 rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-grow">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input 
                    type="text" 
                    placeholder="Search alerts..." 
                    className="w-full bg-black/50 text-white border border-[#BF00FF]/20 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#BF00FF]/30"
                  />
                </div>
              </div>
              <button 
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${filterActive ? 'bg-[#BF00FF]/20 text-[#00FFFF]' : 'bg-black/50 text-gray-300'}`}
                onClick={() => setFilterActive(!filterActive)}
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
              <button className="px-4 py-2 rounded-lg bg-black/50 text-gray-300 flex items-center gap-2 hover:bg-black/70">
                <Bell className="h-4 w-4" />
                Notifications
              </button>
              <button className="bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
            
            {filterActive && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#BF00FF]/10">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Severity</label>
                  <select className="w-full bg-black/50 text-white border border-[#BF00FF]/20 rounded-lg py-2 px-3">
                    <option>All Severities</option>
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Type</label>
                  <select className="w-full bg-black/50 text-white border border-[#BF00FF]/20 rounded-lg py-2 px-3">
                    <option>All Types</option>
                    <option>Vulnerability</option>
                    <option>Ransomware</option>
                    <option>Malware</option>
                    <option>Zero-Day</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Status</label>
                  <select className="w-full bg-black/50 text-white border border-[#BF00FF]/20 rounded-lg py-2 px-3">
                    <option>All Statuses</option>
                    <option>New</option>
                    <option>In Progress</option>
                    <option>Resolved</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          
          {/* Alert List */}
          <div className="space-y-4">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-gradient-to-r from-red-900/20 to-black/80 backdrop-blur-sm border border-red-500/30 rounded-xl p-4"
            >
              <div className="flex items-start gap-4">
                <div className="bg-red-500/20 p-3 rounded-full">
                  <AlertTriangle className="text-red-400 h-6 w-6" />
                </div>
                <div className="flex-grow">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <h3 className="text-xl font-bold">Critical Ransomware Alert</h3>
                    <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">Critical</span>
                  </div>
                  <p className="text-gray-300 mb-4">A new strain of ransomware targeting financial systems has been detected. This variant encrypts databases and demands payment in cryptocurrency.</p>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                    <span className="bg-black/30 px-3 py-1 rounded-full">ID: RISQ-2025-0142</span>
                    <span className="bg-black/30 px-3 py-1 rounded-full">Detected: 2h ago</span>
                    <span className="bg-black/30 px-3 py-1 rounded-full">Type: Ransomware</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-red-500/20 flex justify-end gap-2">
                <button className="bg-transparent border border-[#BF00FF]/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#BF00FF]/10">
                  <XCircle className="h-4 w-4" />
                  Dismiss
                </button>
                <button className="bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Acknowledge
                </button>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-gradient-to-r from-yellow-900/20 to-black/80 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-4"
            >
              <div className="flex items-start gap-4">
                <div className="bg-yellow-500/20 p-3 rounded-full">
                  <AlertTriangle className="text-yellow-400 h-6 w-6" />
                </div>
                <div className="flex-grow">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <h3 className="text-xl font-bold">Supply Chain Compromise</h3>
                    <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm">High</span>
                  </div>
                  <p className="text-gray-300 mb-4">Multiple vendors in the software supply chain have reported compromise. Impact assessment is ongoing.</p>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                    <span className="bg-black/30 px-3 py-1 rounded-full">ID: RISQ-2025-0138</span>
                    <span className="bg-black/30 px-3 py-1 rounded-full">Detected: 5h ago</span>
                    <span className="bg-black/30 px-3 py-1 rounded-full">Type: Supply Chain</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-yellow-500/20 flex justify-end gap-2">
                <button className="bg-transparent border border-[#BF00FF]/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#BF00FF]/10">
                  <XCircle className="h-4 w-4" />
                  Dismiss
                </button>
                <button className="bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Acknowledge
                </button>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="bg-gradient-to-r from-blue-900/20 to-black/80 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4"
            >
              <div className="flex items-start gap-4">
                <div className="bg-blue-500/20 p-3 rounded-full">
                  <AlertTriangle className="text-blue-400 h-6 w-6" />
                </div>
                <div className="flex-grow">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <h3 className="text-xl font-bold">API Security Vulnerability</h3>
                    <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">Medium</span>
                  </div>
                  <p className="text-gray-300 mb-4">A vulnerability in API authentication mechanisms could allow unauthorized access to sensitive data.</p>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                    <span className="bg-black/30 px-3 py-1 rounded-full">ID: RISQ-2025-0136</span>
                    <span className="bg-black/30 px-3 py-1 rounded-full">Detected: 8h ago</span>
                    <span className="bg-black/30 px-3 py-1 rounded-full">Type: Vulnerability</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-blue-500/20 flex justify-end gap-2">
                <button className="bg-transparent border border-[#BF00FF]/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#BF00FF]/10">
                  <XCircle className="h-4 w-4" />
                  Dismiss
                </button>
                <button className="bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Acknowledge
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}