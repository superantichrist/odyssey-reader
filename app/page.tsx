import manifest from '../public/data/manifest.json';
import bookOne from '../public/data/books/01.json';
import { OdysseyReader } from './reader';

export default function Home() {
  return (
    <OdysseyReader
      initialBook={bookOne}
      manifest={manifest}
      basePath={process.env.NEXT_PUBLIC_BASE_PATH ?? ''}
    />
  );
}
