import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignupPaymentFailedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Payment Not Completed</CardTitle>
          <CardDescription>
            Your payment was not completed. You can try again from your
            subscription page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/subscribe">Try Again</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
