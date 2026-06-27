import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-password',
      });

      if (error) throw error;

      setIsSent(true);
      toast.success('Password reset link sent to your email!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md bg-card/45 backdrop-blur-xl border-border/80">
        <CardHeader className="space-y-3.5 text-center flex flex-col items-center">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold tracking-tight">Forgot Password</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {isSent
                ? 'Check your inbox for a link to reset your account password.'
                : 'Enter your email address and we will send you a link to reset your password.'}
            </CardDescription>
          </div>
        </CardHeader>

        {!isSent ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email Address
                </label>
                <Input
                  type="email"
                  placeholder="you@gkrepair.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary/35 border-border/80"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 border-t border-border/40 pt-6">
              <Button type="submit" disabled={isSubmitting} className="w-full h-11">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
              
              <Link to="/login" className="text-xs text-muted-foreground hover:text-white flex items-center gap-1.5 justify-center">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
              </Link>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="pt-2 text-center">
            <div className="rounded-lg bg-blue-950/40 border border-blue-800/40 px-4 py-3 text-xs text-blue-200 mb-6">
              An email was sent to <strong>{email}</strong> with instructions. Please check your junk/spam folder if you do not receive it in a few minutes.
            </div>
            <Link to="/login" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1.5 justify-center">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
