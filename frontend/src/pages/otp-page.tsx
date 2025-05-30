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
    <div className={`flex ${twHeight} items-center justify-center bg-black`}>
      <div className="w-full max-w-md flex flex-col items-center px-4 sm:px-0">
        <Card className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-xl hover:border-[#BF00FF]/40 transition-all duration-300 w-full">
          <CardHeader className="p-6">
            <CardTitle className="text-2xl font-bold text-white">
              Verify Code
            </CardTitle>
            <CardDescription className="text-gray-400">
              Enter the code we sent to your email below:
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <InputOTPForm pParam={pParam}/>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

