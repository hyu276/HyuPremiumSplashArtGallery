import backendCatalogue from '@/data/backend/catalogue.json';
import backendTeam from '@/data/backend/team.json';

export type TeamMember = {
  id: number;
  name: string;
  image: string;
  sort_order: number;
  facebook_url: string;
  facebook_hidden: boolean;
  tiktok_url: string;
  tiktok_hidden: boolean;
  instagram_url: string;
  instagram_hidden: boolean;
  x_url: string;
  x_hidden: boolean;
  linkedin_url: string;
  linkedin_hidden: boolean;
};

export async function getTeamMembers(): Promise<TeamMember[]> {
  if ((backendCatalogue as any).ready !== true) {
    throw new Error('GitHub backend team metadata is not ready.');
  }
  return (backendTeam as any[])
    .filter(row=>!row?.hidden)
    .map(row=>({
      id:Number(row.id)||0,
      name:String(row.name||''),
      image:String(row.image||''),
      sort_order:Number(row.sort_order)||0,
      facebook_url:String(row.facebook_url||''),
      facebook_hidden:Boolean(row.facebook_hidden),
      tiktok_url:String(row.tiktok_url||''),
      tiktok_hidden:Boolean(row.tiktok_hidden),
      instagram_url:String(row.instagram_url||''),
      instagram_hidden:Boolean(row.instagram_hidden),
      x_url:String(row.x_url||''),
      x_hidden:Boolean(row.x_hidden),
      linkedin_url:String(row.linkedin_url||''),
      linkedin_hidden:Boolean(row.linkedin_hidden)
    }))
    .sort((a,b)=>a.sort_order-b.sort_order||a.id-b.id);
}

export function safeSocialUrl(value:string){
  try{const url=new URL(String(value||''));return /^https?:$/.test(url.protocol)?url.href:''}catch{return ''}
}
