import { hash } from "@node-rs/argon2";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run admin:hash -- <password>");
  process.exit(1);
}

hash(password)
  .then((hashed) => {
    const escaped = hashed.replace(/\$/g, "\\$");
    console.log("Raw hash:");
    console.log(hashed);
    console.log("\n.env.local-safe value:");
    console.log(`ADMIN_PASSWORD_HASH=${escaped}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
