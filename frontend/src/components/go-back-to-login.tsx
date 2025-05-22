import { Link } from "react-router-dom";

type Props = {
  text?: 'center' | 'left'
}
export default function GoBackToLogin({ text }: Props) {
  return (
    <div className={`mt-4 ${text === 'left' ? "text-left" : 'text-center'} text-sm text-slate-300`}>
      Go back to{" "}
      <Link to="/auth/login" className="text-primary underline underline-offset-4 hover:text-primary/80">
        Login
      </Link>
    </div>
  )
}
