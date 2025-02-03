import { $ } from 'bun';

await Promise.all([
  $`bun run build:esm`,
  $`bun run build:cjs`,
  $`bun run build:dts`,
]);