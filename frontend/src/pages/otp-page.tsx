import AuthLayout from "@/components/layout/AuthLayout";
import { InputOTPForm } from "@/components/otp-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


export default function OtpPage() {
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
          <InputOTPForm />
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

