import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { isAdminAuthConfigured, isAdminOtpRequired, verifyAdminCredentials } from "@/lib/auth";
import { consumeAdminOtp } from "@/lib/admin-otp";

export const authOptions: NextAuthOptions = {
  secret:
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV !== "production" ? "alo-local-development-only-secret" : undefined),
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "ALO administrator",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "SMS one-time code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email ?? "";
        const password = credentials?.password ?? "";
        if (!isAdminAuthConfigured() || !verifyAdminCredentials(email, password)) return null;
        if (isAdminOtpRequired() && !await consumeAdminOtp(credentials?.otp ?? "")) return null;

        return {
          id: "alo-admin",
          name: "ALO Administrator",
          email: process.env.ADMIN_EMAIL!.trim().toLowerCase(),
        };
      },
    }),
  ],
  callbacks: {
    async session({ session }) {
      if (session.user) session.user.name = "ALO Administrator";
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
