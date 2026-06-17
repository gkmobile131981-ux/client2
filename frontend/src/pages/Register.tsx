import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Smartphone, Mail, Lock, User, Building, Phone, MapPin, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm password must be at least 6 characters'),
  shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
  shopAddress: z.string().min(5, 'Shop address must be at least 5 characters'),
  shopPhone: z.string().min(5, 'Shop phone number must be at least 5 characters')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      shopName: '',
      shopAddress: '',
      shopPhone: ''
    }
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      // 1. Post request to backend register-owner endpoint
      const data = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: any;
        shop: any;
      }>('/auth/register-owner', {
        name: values.name,
        email: values.email,
        password: values.password,
        shopName: values.shopName,
        shopAddress: values.shopAddress,
        shopPhone: values.shopPhone
      });

      // 2. Persist token and session locally
      localStorage.setItem('gk_access_token', data.accessToken);
      localStorage.setItem('gk_refresh_token', data.refreshToken);

      await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken
      });

      toast.success('Shop registered and logged in!');
      // Wait briefly for auth state listener to trigger, then navigate
      setTimeout(() => {
        navigate('/');
      }, 500);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden py-12">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-xl bg-card/45 backdrop-blur-xl border-border/80 shadow-2xl">
        <CardHeader className="space-y-3.5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-purple-600 shadow-md shadow-primary/20">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Register Owner & Shop</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Initialize a new GK Repair terminal node. Start managing jobs instantly.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {/* Section 1: Owner Details */}
            <div className="space-y-4 sm:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1">
                Owner Credentials
              </h3>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Full Name
              </label>
              <Input
                placeholder="John Owner"
                {...register('name')}
                className={errors.name ? 'border-destructive/80' : ''}
              />
              {errors.name && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Address
              </label>
              <Input
                type="email"
                placeholder="john@gkrepair.com"
                {...register('email')}
                className={errors.email ? 'border-destructive/80' : ''}
              />
              {errors.email && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className={errors.password ? 'border-destructive/80' : ''}
              />
              {errors.password && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Confirm Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                className={errors.confirmPassword ? 'border-destructive/80' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Section 2: Shop Details */}
            <div className="space-y-4 sm:col-span-2 mt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1">
                Shop Properties
              </h3>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" /> Shop Name
              </label>
              <Input
                placeholder="GK Repair Shop Main"
                {...register('shopName')}
                className={errors.shopName ? 'border-destructive/80' : ''}
              />
              {errors.shopName && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.shopName.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Shop Contact Phone
              </label>
              <Input
                placeholder="+1234567890"
                {...register('shopPhone')}
                className={errors.shopPhone ? 'border-destructive/80' : ''}
              />
              {errors.shopPhone && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.shopPhone.message}</p>
              )}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Shop Address
              </label>
              <Input
                placeholder="123 Tech Avenue, Silicon Valley"
                {...register('shopAddress')}
                className={errors.shopAddress ? 'border-destructive/80' : ''}
              />
              {errors.shopAddress && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.shopAddress.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 border-t border-border/40 pt-6">
            <Button type="submit" disabled={isSubmitting} className="w-full h-11">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering Shop...
                </>
              ) : (
                'Register & Sign In'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Already have a shop registered?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Log In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
