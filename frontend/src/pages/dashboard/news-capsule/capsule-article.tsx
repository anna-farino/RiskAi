import { CapsuleArticle } from "@shared/db/schema/news-capsule";
import { motion } from "framer-motion";
import { Dispatch, SetStateAction } from "react";

type Props = {
  article: CapsuleArticle
  index: number
  setSelectedArticles: Dispatch<SetStateAction<CapsuleArticle[]>>
  removeProcessedArticle: (article: CapsuleArticle) => void
  selectedArticles: CapsuleArticle[]
  selectForReport: (article: CapsuleArticle) => void
}

export default function CapsuleArticleComponent({
  article,
  index,
  setSelectedArticles,
  removeProcessedArticle,
  selectedArticles,
  selectForReport
}: Props) {
  const date = article.createdAt.toString().split('T')[0]
  const dateElements = date.split('-')
  const month = dateElements[1]
  const day = dateElements[2]
  const year = dateElements[0].slice(2)

  return (
    <motion.div
      key={`article-${article.id}-${index}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-5 bg-slate-800/50 border border-slate-700/40 rounded-lg"
    >
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <h3 className="flex flex-row justify-between text-base sm:text-lg font-medium flex-1 leading-tight">
            <span>
              {article.title} 
            </span>
            <span className="text-sm text-muted-foreground flex flex-col justify-center">
              {month}-{day}-{year}
            </span>
          </h3>
          <span className="text-xs text-slate-400 ml-3 px-2 py-1 border border-slate-600 rounded whitespace-nowrap">
            News Capsule
          </span>
        </div>
        
        {/* Action buttons below title */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              const isSelected = selectedArticles.some(selected => selected.title === article.title);
              if (isSelected) {
                const newSelected = selectedArticles.filter(selected => selected.title !== article.title);
                setSelectedArticles(newSelected);
              } else {
                selectForReport(article);
              }
            }}
            className={`flex-1 px-4 py-3 text-sm rounded-lg border min-h-[48px] touch-manipulation transition-all duration-200 ${
              selectedArticles.some(selected => selected.title === article.title) 
                ? "bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border-blue-700/30" 
                : "bg-green-900/30 hover:bg-green-900/50 text-green-400 border-green-700/30"
            }`}
          >
            {selectedArticles.some(selected => selected.title === article.title) ? "In Report" : "Select"}
          </button>
          <button
            onClick={() => removeProcessedArticle(article)}
            className="w-12 h-12 flex items-center justify-center bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg border border-red-700/30 touch-manipulation transition-all duration-200"
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Mobile-first grid: Single column on mobile, 2 columns on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">Threat Name</p>
          <p className="text-sm break-words">{article.threatName}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Vulnerability ID</p>
          <p className="text-sm break-words">{article.vulnerabilityId}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-slate-400 mb-1">Summary</p>
          <p className="text-sm leading-relaxed">{article.summary}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-slate-400 mb-1">Impacts</p>
          <p className="text-sm leading-relaxed">{article.impacts}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Attack Vector</p>
          <p className="text-sm break-words">{article.attackVector}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Target OS</p>
          <p className="text-sm break-words">{article.targetOS}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-slate-400 mb-1">Source</p>
          <p className="text-sm break-words">{article.sourcePublication}</p>
        </div>
      </div>
    </motion.div>
  )
}
