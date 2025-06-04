import { motion } from "framer-motion";
import { Link } from "react-router";

export default function Home() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8 md:gap-12 mb-8 sm:mb-12 md:mb-16 py-4 sm:py-6 md:py-8">
      <div className="flex flex-col gap-3 sm:gap-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
          News Capsule
        </h1>
        <p className="text-base sm:text-lg text-slate-300 max-w-3xl">
          Intelligent article analysis and executive reporting system for comprehensive news insights.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col h-full p-6 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl"
        >
          <h2 className="text-xl font-semibold mb-2">Capsule Research</h2>
          <p className="text-slate-300 mb-4">
            Analyze articles for meaningful insights by submitting URLs for AI-powered processing.
          </p>
          <div className="mt-auto">
            <Link 
              to="/dashboard/news-capsule/research" 
              className="inline-flex items-center px-4 py-2 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-md"
            >
              Begin Research
            </Link>
          </div>
        </motion.div>
        </div>
      </div>
    </div>
  );
}