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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zkrhwqgmynbbmoktokdq.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq';

export async function getTeamMembers(): Promise<TeamMember[]> {
  const select='id,name,image,sort_order,facebook_url,facebook_hidden,tiktok_url,tiktok_hidden,instagram_url,instagram_hidden,x_url,x_hidden,linkedin_url,linkedin_hidden';
  const response=await fetch(`${SUPABASE_URL}/rest/v1/team_members?select=${encodeURIComponent(select)}&hidden=eq.false&order=sort_order.asc,id.asc`,{
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`},
    next:{revalidate:300,tags:['team']}
  });
  if(!response.ok)return [];
  return response.json() as Promise<TeamMember[]>;
}

export function safeSocialUrl(value:string){
  try{const url=new URL(String(value||''));return /^https?:$/.test(url.protocol)?url.href:''}catch{return ''}
}
