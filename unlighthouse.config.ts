import { defineUnlighthouseConfig } from "unlighthouse/config";

export default defineUnlighthouseConfig({
  site: process.env.UNLIGHTHOUSE_SITE ?? "http://127.0.0.1:4173",
  scanner: {
    crawler: false,
    device: "desktop",
    dynamicSampling: false,
    maxRoutes: 1,
    robotsTxt: false,
    samples: 1,
    sitemap: false,
    throttle: false,
  },
  lighthouseOptions: {
    formFactor: "desktop",
    onlyCategories: ["performance"],
    screenEmulation: {
      disabled: false,
      height: 900,
      mobile: false,
      width: 1440,
    },
    throttlingMethod: "provided",
  },
});
