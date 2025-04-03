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

type Props = {
  children: React.ReactNode,
  open: boolean,
  setOpen: (b: boolean) => void
  action: (e: any) => void
}
export function DeleteAlertDialog({
  children,
  open,
  setOpen,
  action
}: Props) {

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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. 
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleAction}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
