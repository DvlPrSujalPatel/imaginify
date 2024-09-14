import { authMiddleware } from "@clerk/nextjs/server";

// Middleware to handle authentication
export default authMiddleware({
  // Define which routes are public and don't require authentication
  publicRoutes: ["/", "/api/webhooks/clerk", "/api/webhooks/stripe"],
});

// Configuration for which routes should use this middleware
export const config = {
  // Define the path patterns to include for this middleware
  matcher: [
    // Match all routes except those with file extensions or under the _next directory
    "/((?!.+\\.[\\w]+$|_next).*)",
    // Specifically include the root path
    "/",
    // Match API routes and TRPC routes
    "/(api|trpc)(.*)",
  ],
};
