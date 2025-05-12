import AuthLayout from "@/components/layout/AuthLayout";
import { InputOTPForm } from "@/components/otp-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";


type Props = {
  twHeight?: 'h-full' | 'min-h-screen' 
}
export default function OtpPage({ twHeight='h-full' }: Props) {
  const [ params ] = useSearchParams()
  const pParam = params.get('p') as 'login' | 'pw' | 'signup'

  return (
    <AuthLayout twHeight={twHeight}>
      <Card className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-2xl text-white">
            Verify Code
          </CardTitle>
          <CardDescription className="text-slate-300">
            Enter the code we sent to your email below:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InputOTPForm pParam={pParam}/>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

