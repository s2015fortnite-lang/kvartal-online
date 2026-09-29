import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../server-dist/package.json', import.meta.url), '{"type":"commonjs"}\n');
