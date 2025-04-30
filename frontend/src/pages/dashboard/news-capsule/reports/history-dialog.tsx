import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/utils";
import { Dispatch, SetStateAction } from "react";
import { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckIcon, Trash2Icon, TrashIcon, X } from "lucide-react";
import { CheckboxIndicator, CheckedState } from "@radix-ui/react-checkbox";

type Props = {
  historyDialogOpen: boolean,
  setHistoryDialogOpen: Dispatch<SetStateAction<boolean>>
  articlesQuery: UseQueryResult<any[], Error>
  allArticles: any[]
  handleOnCheckChange: (checked: CheckedState, article: any) => void
  setArticleToDelete: (value: React.SetStateAction<number | null>) => void
  setDeleteDialogOpen: (value: React.SetStateAction<boolean>) => void
}
export default function HistoryDialog({
  historyDialogOpen,
  setHistoryDialogOpen,
  articlesQuery,
  allArticles,
  handleOnCheckChange,
  setArticleToDelete,
  setDeleteDialogOpen
}
  : Props
) {

  return (
    <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
      <DialogContent className="sm:max-w-[625px] [&>button]:hidden">
        <DialogHeader>
          <DialogTitle >
            Article History
          </DialogTitle>
          <DialogClose asChild>
            <button
              className="
                absolute top-3 right-3 
                p-1 rounded-full 
                hover:bg-gray-100 dark:hover:bg-gray-800 
                focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500
              "
              aria-label="Close dialog"
            >
              <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </DialogClose>
          <DialogDescription>
            Select articles to include in your reports. Articles marked for reporting will be included in generated threat reports.
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto pr-6 -mr-6 mt-4">
          {articlesQuery.isLoading ? (
            <div className="py-4 text-center">Loading articles...</div>
          ) : allArticles && allArticles.length > 0 ? (
            <div className="space-y-4">
              {allArticles.map((article) => (
                <div key={article.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        className="bg-background text-background w-fit h-fit p-0 min-w-[18px] min-h-[18px]"
                        id={`article-${article.id}`}
                        //checked={article.markedForReporting}
                        onCheckedChange={(checked) => handleOnCheckChange(checked,article)}
                      >
                        <CheckboxIndicator className="text-background w-fit h-fit">
                          <CheckIcon className="text-background bg-background"/>
                        </CheckboxIndicator>
                      </Checkbox>
                      <label 
                        htmlFor={`article-${article.id}`}
                        className="font-medium text-sm cursor-pointer"
                      >
                        {article.title}
                      </label>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="p-0 aspect-square text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Delete article"
                      onClick={() => {
                        setArticleToDelete(article.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="pl-6 text-xs text-primary-500">
                    <Badge variant="outline" className="mr-2">
                      {article.threatName}
                    </Badge>
                    <span>{formatDate(new Date(article.createdAt))}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-gray-500">
              No articles found in history.
            </div>
          )}
        </div>
        
        <DialogFooter className="mt-4">
          <Button onClick={() => setHistoryDialogOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
