import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import prisma from './db.js';

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackURL = process.env.GOOGLE_CALLBACK_URL;

if (!clientID || !clientSecret || !callbackURL) {
    console.warn('⚠️ Google OAuth env vars not set — Google login will be unavailable');
} else {
    passport.use(new GoogleStrategy(
        { clientID, clientSecret, callbackURL },
        async (
            _accessToken: string,
            _refreshToken: string,
            profile: Profile,
            done: VerifyCallback
        ) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email) {
                    return done(new Error('No email found in Google profile'));
                }

                let user = await prisma.user.findUnique({ where: { email } });
                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            name: profile.displayName,
                            email,
                            password: '', // Google users don't need a password
                        },
                    });
                }
                return done(null, user);
            } catch (error) {
                return done(error as Error);
            }
        }
    ));
}

export default passport;
