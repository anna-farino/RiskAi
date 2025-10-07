import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Newspaper, FileText, ArrowRight, Upload } from 'lucide-react';
import { RisqWidget, WidgetActions, WidgetButton } from './RisqWidget';

export function NewsCapsuleWidget() {
  const navigate = useNavigate();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <RisqWidget
        title="News Capsule"
        description="Process articles for executive reports"
        icon={<Newspaper className="w-10 h-10" />}
        variant="interactive"
        footer={
          <WidgetActions explanation="Intelligent news analysis">
            <WidgetButton variant="ghost" onClick={() => navigate('/dashboard/news-capsule/reports')}>
              <FileText className="mr-2 h-4 w-4" />
              Reports
            </WidgetButton>
            <WidgetButton variant="secondary" onClick={() => navigate('/dashboard/news-capsule/research')}>
              <Upload className="mr-2 h-4 w-4" />
              Research
            </WidgetButton>
            <WidgetButton variant="primary" onClick={() => navigate('/dashboard/news-capsule/home')}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Open
            </WidgetButton>
          </WidgetActions>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-black/30 p-3 rounded-md border border-[#BF00FF]/10">
            <div className="flex items-center">
              <Newspaper className="w-5 h-5 mr-3 text-[#00FFFF]" />
              <div>
                <h4 className="text-sm font-medium">Article Research</h4>
                <p className="text-xs text-gray-400">Process and analyze articles</p>
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-500/20">
              Active
            </span>
          </div>
          
          <div className="flex items-center justify-between bg-black/30 p-3 rounded-md border border-[#BF00FF]/10">
            <div className="flex items-center">
              <FileText className="w-5 h-5 mr-3 text-[#00FFFF]" />
              <div>
                <h4 className="text-sm font-medium">Executive Reports</h4>
                <p className="text-xs text-gray-400">Compile daily insights</p>
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-900/30 text-blue-400 border border-blue-500/20">
              Ready
            </span>
          </div>
        </div>
      </RisqWidget>
    </motion.div>
  );
}