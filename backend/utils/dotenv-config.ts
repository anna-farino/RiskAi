import path from 'path'

export default function dotenvConfig(dotenv: any) {

  dotenv.config({
    path: path.resolve(__dirname, '../.env.local'), // adjust if deeper
  });

}
