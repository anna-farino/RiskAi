import AuthLayout from "@/components/layout/AuthLayout";
import { InputOTPForm } from "@/components/otp-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";


type Props = {
  twHeight?: 'h-full' | 'min-h-screen' 
}
export default function OtpPage({ twHeight='h-full' }: Props) {
  const [ params ] = useSearchParams()
  const pParam = params.get('p') as 'login' | 'pw'

  return (
    <AuthLayout twHeight={twHeight}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Verify Code
          </CardTitle>
          <CardDescription>
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

