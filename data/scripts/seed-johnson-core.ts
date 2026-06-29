import { seedJohnson } from "./seed-johnson-family";

seedJohnson(false)
  .catch(console.error)
  .finally(() => import("./prisma-client").then(({ prisma }) => prisma.$disconnect()));
