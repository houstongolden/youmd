const domain = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!domain) {
  console.error("CLERK_JWT_ISSUER_DOMAIN is not set — authentication will not work");
}
export default {
  providers: [
    {
      domain: domain ?? "",
      applicationID: "convex",
    },
  ],
};
