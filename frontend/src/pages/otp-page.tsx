import AuthLayout from "@/components/layout/AuthLayout";
import { InputOTPForm } from "@/components/otp-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";


export default function OtpPage() {
  const [ params ] = useSearchParams()
  const pParam = params.get('p') as 'login' | 'pw'

  return (
    <AuthLayout>
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

