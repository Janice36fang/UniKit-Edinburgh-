import { defineRailway, github, preserve, project, service } from "railway/iac";

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "unikit-edinburgh";

export default defineRailway(() => {
  const unikit_edinburgh = service("unikit-edinburgh", {
    source: github("Janice36fang/UniKit-Edinburgh-"),
    healthcheck: "/api/health",
    healthcheckTimeout: 300,
    env: {
      AI_DEFAULT_SOURCE: preserve(),
      GEMINI_API_KEY: preserve(),
      GEMINI_DAILY_LIMIT: preserve(),
      GEMINI_MODEL: preserve(),
      HOST: preserve(),
      NODE_ENV: preserve(),
    },
    // dockerfilePath from CaC: "Dockerfile"
    // builder from CaC: "DOCKERFILE"
  });
  return project("unikit-edinburgh", {
    resources: [unikit_edinburgh],
  });
});
