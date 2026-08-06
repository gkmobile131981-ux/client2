import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Smartphone, Lock, Loader2, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const { setAuthTokens } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'send-otp' | 'verify-otp'>('send-otp');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [maskedPhoneInfo, setMaskedPhoneInfo] = useState('');
  const [sandboxOtpMsg, setSandboxOtpMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Please enter your mobile number or email address');
      return;
    }

    setIsSending(true);
    setSandboxOtpMsg(null);
    try {
      const res = await apiClient.post<{ message: string; maskedPhone: string; sandboxOtp?: string }>('/auth/send-reset-otp', {
        phone: phone.trim()
      });

      setMaskedPhoneInfo(res.maskedPhone);
      if (res.sandboxOtp) {
        setSandboxOtpMsg(res.sandboxOtp);
      }
      setStep('verify-otp');
      toast.success(res.message);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send OTP code');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
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

    setIsVerifying(true);
    try {
      const res = await apiClient.post<{
        message: string;
        autoLoggedIn: boolean;
        accessToken?: string;
        refreshToken?: string;
        user?: any;
        shop?: any;
      }>('/auth/verify-reset-otp', {
        phone: phone.trim(),
        otp: otp.trim(),
        newPassword
      });

      if (res.autoLoggedIn && res.accessToken && res.refreshToken) {
        await setAuthTokens(res.accessToken, res.refreshToken, res.user, res.shop);
        toast.success('Password updated successfully! Authenticating...');
        navigate('/');
      } else {
        toast.success(res.message || 'Password reset successfully!');
        navigate('/login');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to verify OTP and reset password');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden text-foreground">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md bg-card/90 border-border/80 shadow-2xl">
        <CardHeader className="space-y-3.5 text-center flex flex-col items-center">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold tracking-tight">
              {step === 'send-otp' ? 'SMS Password Reset' : 'Verify OTP & Set Password'}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {step === 'send-otp'
                ? 'Enter your registered mobile number or email to receive a 6-digit SMS OTP code.'
                : `OTP code dispatched to mobile ending in ${maskedPhoneInfo || phone}.`}
            </CardDescription>
          </div>
        </CardHeader>

        {step === 'send-otp' ? (
          <form onSubmit={handleSendOtp}>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-primary" /> Registered Mobile Number / Email
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 9976992105 or email"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-secondary/35 border-border/80 font-semibold"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t border-border/40 pt-5">
              <Button type="submit" disabled={isSending} className="w-full h-11 gap-2">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                Send SMS OTP
              </Button>

              <Link to="/login" className="text-xs text-muted-foreground hover:text-white flex items-center gap-1.5 justify-center py-1 font-semibold">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
              </Link>
            </CardFooter>
          </form>
        ) : (
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
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
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
              <Button type="submit" disabled={isVerifying} className="w-full h-11 gap-2">
                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Verify OTP & Log In
              </Button>

              <div className="flex items-center justify-between w-full text-xs text-muted-foreground pt-1">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSending}
                  className="text-primary hover:underline font-semibold"
                >
                  Resend OTP Code
                </button>
                <Link to="/login" className="hover:text-white flex items-center gap-1 font-semibold">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
                </Link>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}

