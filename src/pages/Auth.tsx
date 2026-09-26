import { NBButton, NBInput, NBLabel, NBPanel } from "@/components/nb";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowRight, Gauge, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="border-b-2 border-ink">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center border-2 border-ink bg-primary nb-shadow-sm">
              <Gauge className="size-5 text-ink" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-bold uppercase tracking-wide">
              AI Project Mentor
            </span>
          </Link>
        </div>
      </header>

      {/* Auth content */}
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <NBPanel className="w-full max-w-sm">
          {step === "signIn" ? (
            <>
              <div className="border-b-2 border-ink bg-primary px-6 py-5 text-center">
                <div className="flex justify-center">
                  <span className="flex h-14 w-14 items-center justify-center border-2 border-ink bg-card nb-shadow-sm">
                    <img
                      src={logo}
                      alt="AI Project Mentor logo"
                      width={40}
                      height={40}
                      className="rounded"
                    />
                  </span>
                </div>
                <h1 className="mt-3 text-xl font-bold uppercase tracking-wide">
                  Get Started
                </h1>
                <p className="mt-1 text-xs font-medium text-ink/80">
                  Enter your email to log in or sign up
                </p>
              </div>
              <form onSubmit={handleEmailSubmit}>
                <div className="space-y-4 px-6 py-6">
                  <div>
                    <NBLabel htmlFor="email">Email</NBLabel>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <NBInput
                        id="email"
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        className="pl-9"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>
                  {error && (
                    <p className="border-2 border-ink bg-destructive px-3 py-2 text-xs font-semibold text-white">
                      {error}
                    </p>
                  )}

                  <NBButton
                    type="submit"
                    variant="ink"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      "Sending code…"
                    ) : (
                      <>
                        Continue with email
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </NBButton>

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t-2 border-ink/20" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        Or
                      </span>
                    </div>
                  </div>

                  <NBButton
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <UserX className="size-4" />
                    Continue as Guest
                  </NBButton>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="border-b-2 border-ink bg-nb-purple px-6 py-5 text-center">
                <h1 className="text-xl font-bold uppercase tracking-wide">
                  Check your email
                </h1>
                <p className="mt-1 text-xs font-medium text-ink/80">
                  We&apos;ve sent a code to {step.email}
                </p>
              </div>
              <form onSubmit={handleOtpSubmit}>
                <div className="space-y-5 px-6 py-6">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          otp.length === 6 &&
                          !isLoading
                        ) {
                          const form = (e.target as HTMLElement).closest(
                            "form",
                          );
                          if (form) {
                            form.requestSubmit();
                          }
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="border-2 border-ink bg-destructive px-3 py-2 text-center text-xs font-semibold text-white">
                      {error}
                    </p>
                  )}
                  <p className="text-center text-xs text-muted-foreground">
                    Didn&apos;t receive a code?{" "}
                    <button
                      type="button"
                      onClick={() => setStep("signIn")}
                      className="font-bold text-ink underline underline-offset-2"
                    >
                      Try again
                    </button>
                  </p>

                  <NBButton
                    type="submit"
                    variant="ink"
                    className="w-full"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      "Verifying…"
                    ) : (
                      <>
                        Verify code
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </NBButton>
                  <NBButton
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("signIn")}
                    disabled={isLoading}
                    className="w-full border-2 border-ink"
                  >
                    Use different email
                  </NBButton>
                </div>
              </form>
            </>
          )}

          <div className="border-t-2 border-ink bg-muted px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Secured by freebuff.com
          </div>
        </NBPanel>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
