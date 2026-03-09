import { hash } from "@node-rs/argon2";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run admin:hash -- <password>");
  process.exit(1);
}

hash(password)
  .then((hashed) => {
    console.log(hashed);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });