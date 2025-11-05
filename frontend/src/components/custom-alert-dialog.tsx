import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AlertDialogPortal } from "@radix-ui/react-alert-dialog";

type twNumber = 0 | 4 | 8 | 12 | 16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 52 | 56 | 60 | 64 | 68 | 72 | 76 | 80 | 84 | 88 | 92 | 96 | 100 | 104 | 108 | 112 | 116 | 120 | 124 | 128 | 132 | 136 | 140 | 144 | 148 | 152 | 156 | 160 | 164 | 168 | 172 | 176 | 180 | 184 | 188 | 192 | 196 | 200;

type twSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

type Props = {
  children: React.ReactNode,
  open: boolean,
  setOpen: (b: boolean) => void,
  action: (e: any) => void,
  title?: string,
  description?: string,
  cancelTitle?: string,
  confirmTitle?: string,
  twMaxWidthClass?: `max-w-${twNumber}` | `max-w-${twSize}`,
  twGapClass?: `gap-${twNumber}`,
  forceMount?: true | undefined,
  cancelAction?: ()=>void
}
export function CustomAlertDialog({
  children,
  open,
  setOpen,
  action,
  title="Are you sure?",
  description="This action cannot be undone",
  cancelTitle="Cancel",
  confirmTitle="Confirm",
  twMaxWidthClass="max-w-96",
  twGapClass="gap-4",
  forceMount,
  cancelAction
}
: Props
) {

  function handleAction(e: React.MouseEvent) {
    action(e)
    setOpen(false)
  }

  return (
    <AlertDialog 
      open={open}
      onOpenChange={setOpen}
    >
      <AlertDialogTrigger asChild>
        { children }
      </AlertDialogTrigger>
      <AlertDialogPortal forceMount={forceMount}>
        <AlertDialogContent className={`flex flex-col w-full ${twMaxWidthClass} ${twGapClass}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelAction}>
              {cancelTitle}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] border-0"
            >
              {confirmTitle}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  )
}
