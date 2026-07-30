import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// The whole pool lives behind the door. Signed out, you see the sign-in
// screen and nothing else — live area, demo area, admin, all of it.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// Keys are read from the server's runtime environment on purpose: the secret
// never enters a local build. An explicit redirect (not auth.protect()'s
// interstitial rewrite) keeps the standalone server from proxying to itself.
export default clerkMiddleware(
  async (auth, req) => {
    if (isPublicRoute(req)) return;
    const { userId } = await auth();
    if (!userId) {
      const url = new URL("/sign-in/", req.url);
      url.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  },
  {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    signInUrl: "/sign-in",
  },
);

export const config = {
  matcher: [
    // Run on everything except Next internals and static files with extensions.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
