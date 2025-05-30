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
      <div className="w-full max-w-lg flex flex-col items-center px-6 sm:px-8 lg:px-0">
        <div className="w-full space-y-8">
          {/* Page Title */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] bg-clip-text text-transparent">
              Account Verification
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              Complete your security verification to continue
            </p>
          </div>

          {/* OTP Widget Card */}
          <Card className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-xl p-6 hover:border-[#BF00FF]/40 transition-all duration-300 shadow-2xl">
            <CardHeader className="p-0 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
                  <svg className="h-5 w-5 text-[#BF00FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-semibold text-white">
                  Verify Code
                </CardTitle>
              </div>
              <CardDescription className="text-gray-400 text-sm leading-relaxed">
                Enter the verification code we sent to your email address to proceed with your account security update.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <InputOTPForm pParam={pParam}/>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

