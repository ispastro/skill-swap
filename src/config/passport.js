import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
},
async (accessToken, refreshToken, profile, done) => {
  let user = await prisma.user.findUnique({ where: { email: profile.emails[0].value } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: profile.displayName,
        email: profile.emails[0].value,
        password: '', // Google users don't need a password
      }
    });
  }
  return done(null, user);
}));

export default passport;