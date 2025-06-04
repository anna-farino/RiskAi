import { useAuthCheck } from "@/hooks/use-auth-check";
import { RisqLoader, RisqSpinner } from "@/components/ui/loading";

export default function Home() {
  const { isLoading: authLoading, isError } = useAuthCheck();

  if (authLoading) {
    return <RisqLoader message="Loading security dashboard..." />;
  }

  if (isError) {
    return null;
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">
          Home
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {authLoading ? (
          <div className="col-span-full flex justify-center">
            <RisqSpinner size="lg" />
          </div>
        ) :  
          <>
            <h1> Welcome Home! </h1>
          </>
        }
      </div>
    </div>
  );
}
