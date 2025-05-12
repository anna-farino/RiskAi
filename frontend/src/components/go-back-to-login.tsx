import { Link } from "react-router-dom";

type Props = {
  text?: 'center' | 'left'
}
export default function GoBackToLogin({ text }: Props) {
  return (
    <div className={`mt-4 ${text === 'left' ? "text-left" : 'text-center'} text-sm`}>
      Go back to{" "}
      <Link to="/auth/login" className="underline underline-offset-4 hover:text-primary">
        Login
      </Link>
    </div>
  )
}
