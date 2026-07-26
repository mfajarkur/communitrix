'use server';

import { createClient } from '@/lib/supabase/server';

export async function loginWithUsernameOrEmail(identifier: string, password: string) {
  if (!identifier || !password) {
    return { error: 'Please enter your username or email and password.' };
  }

  const supabase = await createClient();
  let email = identifier.trim().toLowerCase();

  // If identifier does not contain @, resolve email via get_email_by_username RPC
  if (!email.includes('@')) {
    const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
      p_identifier: email,
    });

    if (rpcError || !resolvedEmail) {
      return { error: 'Username not found. Please check your handle or sign in with Google.' };
    }
    email = resolvedEmail;
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    return { error: authError.message };
  }

  return { success: true };
}
