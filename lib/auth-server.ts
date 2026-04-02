import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

function getRequiredEnvVar(
  name: "NEXT_PUBLIC_CONVEX_URL" | "NEXT_PUBLIC_CONVEX_SITE_URL"
) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl: getRequiredEnvVar("NEXT_PUBLIC_CONVEX_URL"),
  convexSiteUrl: getRequiredEnvVar("NEXT_PUBLIC_CONVEX_SITE_URL"),
});
