import { motion } from "framer-motion";
import { Link } from "react-router";

export default function Home() {
  return (
    <>
      {/* Header Container */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-4">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-wider relative">
            <span className="text-white">
              News Capsule
            </span>
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            Intelligent article analysis and executive reporting system for comprehensive news insights.
          </p>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col h-full p-6 bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl"
          >
            <h2 className="text-xl font-semibold mb-3 text-white">Capsule Research</h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              Analyze articles for meaningful insights by submitting URLs for AI-powered processing.
            </p>
            <div className="mt-auto">
              <Link 
                to="/dashboard/news-capsule/research" 
                className="inline-flex items-center h-10 px-6 font-semibold bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-md transition-all duration-200"
              >
                Begin Research
              </Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col h-full p-6 bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl"
          >
            <h2 className="text-xl font-semibold mb-3 text-white">Executive Reports</h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              Create comprehensive daily reports from analyzed articles for executive review.
            </p>
            <div className="mt-auto">
              <Link 
                to="/dashboard/news-capsule/reports" 
                className="inline-flex items-center h-10 px-6 font-semibold bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-md transition-all duration-200"
              >
                View Reports
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}