const { execSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');

try {
  const command = `npx supabase gen types typescript --project-id "qmunpzmthgpekebwjazo" --schema public`;
  const types = execSync(command, { encoding: 'utf-8' });
  writeFileSync('src/types/_postgresql/supabase.ts', types);
  console.log('Types generated successfully!');
} catch (error) {
  console.error('Error generating types:', error);
}
