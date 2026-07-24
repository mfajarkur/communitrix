'use server';

import { createClient } from '@/lib/supabase/server';
import { type ActionResult } from '@/server/result';
import { redirect } from 'next/navigation';

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<any>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });

    if (error) {
      return {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: error.message || 'Invalid email or password.',
      };
    }

    return { ok: true, data: null };
  } catch (error: any) {
    return {
      ok: false,
      code: 'UNKNOWN',
      message: error.message || 'An unexpected error occurred.',
    };
  }
}

export async function signupAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<any>> {
  try {
    const supabase = await createClient();
    
    // Sign up the user in Supabase Auth
    const { data: authData, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        // Direct auto-confirm for testing, so we don't need real email confirmation loops
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`,
      }
    });

    if (error) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: error.message || 'Failed to sign up.',
      };
    }

    // Auto-login after signup to make flow seamless
    if (authData.user && !authData.session) {
      await supabase.auth.signInWithPassword({
        email: input.email.trim(),
        password: input.password,
      });
    }

    return { ok: true, data: null };
  } catch (error: any) {
    return {
      ok: false,
      code: 'UNKNOWN',
      message: error.message || 'An unexpected error occurred.',
    };
  }
}
