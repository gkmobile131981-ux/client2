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
import { Smartphone, Mail, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md bg-card/90 border-border/80">
        <CardHeader className="space-y-3.5 text-center flex flex-col items-center">
          <div className="mx-auto h-12 w-full max-w-[240px] overflow-hidden bg-white rounded-lg p-1.5 flex items-center justify-center">
            <img src={logo} alt="Association Logo" className="h-full w-full object-contain" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold tracking-tight">Association Repair System</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Log in to manage tickets, shop logs, and inventory pipelines.
            </CardDescription>
          </div>
        </CardHeader>

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
                <Link to="/forgot-password" className="text-[11px] text-primary hover:underline font-semibold">
                  Forgot Password?
                </Link>
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
      </Card>
    </div>
  );
}
