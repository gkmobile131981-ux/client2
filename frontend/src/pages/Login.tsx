import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../context/AuthContext';
import logo from '../logo.png';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Smartphone, Mail, Lock, Loader2, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { user, login, setAuthTokens } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mode: 'login' | 'send-otp' | 'verify-otp'
  const [viewMode, setViewMode] = useState<'login' | 'send-otp' | 'verify-otp'>('login');
  const [resetPhone, setResetPhone] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [maskedPhoneInfo, setMaskedPhoneInfo] = useState('');
  const [sandboxOtpMsg, setSandboxOtpMsg] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // If user is already logged in, redirect to Dashboard
  React.useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await login(values.email, values.password);
      toast.success('Logged in successfully!');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Send SMS OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPhone.trim()) {
      toast.error('Please enter your mobile number or email address');
      return;
    }

    setSendingOtp(true);
    setSandboxOtpMsg(null);
    try {
      const res = await apiClient.post<{ message: string; maskedPhone: string; sandboxOtp?: string }>('/auth/send-reset-otp', {
        phone: resetPhone.trim()
      });

      setMaskedPhoneInfo(res.maskedPhone);
      if (res.sandboxOtp) {
        setSandboxOtpMsg(res.sandboxOtp);
      }
      setViewMode('verify-otp');
      toast.success(res.message);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send OTP code');
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 2: Verify OTP, Reset Password & Auto-Authenticate
  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOtp.trim()) {
      toast.error('Please enter the 6-digit OTP code sent to your phone');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await apiClient.post<{
        message: string;
        autoLoggedIn: boolean;
        accessToken?: string;
        refreshToken?: string;
        user?: any;
        shop?: any;
      }>('/auth/verify-reset-otp', {
        phone: resetPhone.trim(),
        otp: resetOtp.trim(),
        newPassword
      });

      if (res.autoLoggedIn && res.accessToken && res.refreshToken) {
        await setAuthTokens(res.accessToken, res.refreshToken, res.user, res.shop);
        toast.success('Password updated successfully! Logging you in...');
        navigate('/');
      } else {
        toast.success(res.message || 'Password reset successfully! Please log in.');
        setViewMode('login');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to verify OTP and reset password');
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md bg-card/90 border-border/80 shadow-2xl">
        <CardHeader className="space-y-3.5 text-center flex flex-col items-center">
          <div className="mx-auto h-12 w-full max-w-[240px] overflow-hidden bg-white rounded-lg p-1.5 flex items-center justify-center">
            <img src={logo} alt="Association Logo" className="h-full w-full object-contain" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold tracking-tight">
              {viewMode === 'login' && 'Association Repair System'}
              {viewMode === 'send-otp' && 'SMS Password Reset'}
              {viewMode === 'verify-otp' && 'Verify OTP & Set Password'}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {viewMode === 'login' && 'Log in to manage tickets, shop logs, and inventory pipelines.'}
              {viewMode === 'send-otp' && 'Enter your registered mobile number to receive a 6-digit SMS OTP code.'}
              {viewMode === 'verify-otp' && `OTP sent via SMS to ${maskedPhoneInfo || resetPhone}. Enter details below.`}
            </CardDescription>
          </div>
        </CardHeader>

        {/* ----------------------------------------------------------------------- */}
        {/* VIEW 1: Standard Password Login */}
        {/* ----------------------------------------------------------------------- */}
        {viewMode === 'login' && (
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email Address
                </label>
                <Input
                  type="email"
                  placeholder="you@gkrepair.com"
                  {...register('email')}
                  className={errors.email ? 'border-destructive/80 focus:ring-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setViewMode('send-otp')}
                    className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1"
                  >
                    <Smartphone className="h-3 w-3" /> Forgot Password (SMS OTP)?
                  </button>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={errors.password ? 'border-destructive/80 focus:ring-destructive' : ''}
                />
                {errors.password && (
                  <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.password.message}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 border-t border-border/40 pt-6">
              <Button type="submit" disabled={isSubmitting} className="w-full h-11">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Log In'
                )}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Don&apos;t have a shop registered?{' '}
                <Link to="/register" className="text-primary font-semibold hover:underline">
                  Register shop owner
                </Link>
              </p>
            </CardFooter>
          </form>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* VIEW 2: Request SMS OTP */}
        {/* ----------------------------------------------------------------------- */}
        {viewMode === 'send-otp' && (
          <form onSubmit={handleSendOtp}>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-primary" /> Registered Mobile Number / Email
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 9976992105 or email"
                  value={resetPhone}
                  onChange={(e) => setResetPhone(e.target.value)}
                  className="bg-secondary/35 border-border/80 font-semibold"
                />
                <p className="text-[10px] text-muted-foreground">We will look up your registered account and send an SMS OTP.</p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t border-border/40 pt-5">
              <Button type="submit" disabled={sendingOtp} className="w-full h-11 gap-2">
                {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                Send SMS OTP
              </Button>

              <button
                type="button"
                onClick={() => setViewMode('login')}
                className="text-xs text-muted-foreground hover:text-white flex items-center gap-1.5 justify-center py-1 font-semibold"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
              </button>
            </CardFooter>
          </form>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* VIEW 3: Enter OTP, New Password & Auto Authenticate */}
        {/* ----------------------------------------------------------------------- */}
        {viewMode === 'verify-otp' && (
          <form onSubmit={handleVerifyOtpAndReset}>
            <CardContent className="space-y-4">
              {sandboxOtpMsg && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-center space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-primary block">
                    SMS Sandbox Test Mode
                  </span>
                  <p className="text-xs text-foreground font-mono font-bold">
                    Your OTP Code is: <span className="text-primary text-base font-black tracking-widest">{sandboxOtpMsg}</span>
                  </p>
                </div>
              )}

              {/* OTP Field */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-primary" /> 6-Digit SMS OTP Code
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  className="bg-secondary/35 border-border/80 text-center font-mono font-bold text-lg tracking-widest h-11"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> New Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-secondary/35 border-border/80"
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Confirm New Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-secondary/35 border-border/80"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t border-border/40 pt-5">
              <Button type="submit" disabled={verifyingOtp} className="w-full h-11 gap-2">
                {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Verify OTP & Log In
              </Button>

              <div className="flex items-center justify-between w-full text-xs text-muted-foreground pt-1">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  className="text-primary hover:underline font-semibold"
                >
                  Resend OTP Code
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('login')}
                  className="hover:text-white flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
                </button>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}

