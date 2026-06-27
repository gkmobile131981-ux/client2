import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Lock, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Verify that we actually have a session or recovery type
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Sometimes token is processed on url hash. Let's wait a second, or warn.
        console.warn('No active recovery session found yet. Ensure you arrived via the reset link.');
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error('Please enter a new password');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      toast.success('Password updated successfully! Please log in with your new password.');
      
      // Sign out to clear temporary recovery session
      await supabase.auth.signOut();
      
      navigate('/login');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update password. Link may be expired.');
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
            <CardTitle className="text-xl font-bold tracking-tight">Set New Password</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Enter your new account password below.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> New Password
              </label>
              <Input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/35 border-border/80"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Confirm Password
              </label>
              <Input
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-secondary/35 border-border/80"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 border-t border-border/40 pt-6">
            <Button type="submit" disabled={isSubmitting} className="w-full h-11">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Save Password'
              )}
            </Button>
            
            <Link to="/login" className="text-xs text-muted-foreground hover:text-white flex items-center gap-1.5 justify-center">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
