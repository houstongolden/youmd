export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "convex",
      issuer:
        process.env.AUTH_ISSUER_URL ||
        (process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : "https://you.md"),
      jwks:
        process.env.AUTH_JWKS_URL ||
        `${process.env.AUTH_ISSUER_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://you.md")}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
};
