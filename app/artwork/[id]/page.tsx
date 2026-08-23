import { notFound, permanentRedirect } from 'next/navigation';
import { artworkPath, getCatalogue } from '@/lib/catalogue';

export default async function LegacyArtwork({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {items}=await getCatalogue();
  const item=items.find(x=>String(x.id)===String(id));
  if(!item)notFound();
  permanentRedirect(artworkPath(item));
}
