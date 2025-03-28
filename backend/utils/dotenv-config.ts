import path from 'path'
import { fileURLToPath } from 'url';

export default function dotenvConfig(dotenv: any) {

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  dotenv.config({
    path: path.resolve(__dirname, '../.env.local'), // adjust if deeper
  });

}
