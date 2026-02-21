import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    // if "next" is in param, use it as the redirect address
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        console.log('🔄 Server-side exchanging code for session...');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            const targetOrigin = request.headers.get('x-forwarded-proto')
                ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('x-forwarded-host') || request.headers.get('host')}`
                : origin;

            return NextResponse.redirect(`${targetOrigin}${next}`);
        } else {
            console.error('❌ Server-side auth exchange error:', error);
        }
    }

    // Fallback to login with error
    return NextResponse.redirect(`${origin}/auth/login?error=callback_error`);
}
