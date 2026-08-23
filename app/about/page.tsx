import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getTeamMembers, safeSocialUrl } from '@/lib/team';

export const revalidate=300;
export const metadata:Metadata={title:'About us',description:'About HYU PREMIUM and its owner-curated digital splash-art archive.',alternates:{canonical:'https://hyupremium.vercel.app/about/'}};

const SOCIALS=[['facebook','Facebook'],['tiktok','TikTok'],['instagram','Instagram'],['x','X'],['linkedin','LinkedIn']] as const;

export default async function About(){
  const team=await getTeamMembers();
  return <><SiteHeader/><main>
    <section className="page-hero"><div className="kicker">HYU PREMIUM / About us</div><h1>Built around<br/><em>the art.</em></h1><p>HYU PREMIUM is an owner-curated digital splash-art archive focused on presenting gaming artwork as a deliberate visual catalogue rather than a generic image feed.</p></section>
    <div className="content-wrap">
      <section className="section-grid"><div className="section-label">01 / What it is</div><div className="section-copy"><h2>A living visual archive.</h2><p>The gallery is organized around artwork identity, category, skin rank and credit. The system is designed so the catalogue can continue growing while keeping a consistent editorial presentation across desktop and mobile.</p></div></section>
      <section className="section-grid"><div className="section-label">02 / Principles</div><div className="section-copy"><h2>Curated, structured, readable.</h2><div className="principles"><article className="principle"><b>Curated</b><h3>Owner controlled</h3><p>Entries, visibility, categories, credits and ranks are managed through a dedicated owner dashboard.</p></article><article className="principle"><b>Structured</b><h3>Clear hierarchy</h3><p>Artwork is ordered through a defined category and rank system instead of an arbitrary feed.</p></article><article className="principle"><b>Presentation</b><h3>Art first</h3><p>Sixteen-by-nine thumbnails, restrained UI and high-contrast typography keep the artwork visually dominant.</p></article></div></div></section>
      <section className="section-grid"><div className="section-label">03 / Platform</div><div className="section-copy"><h2>Designed to evolve.</h2><p>The public experience is deployed on Vercel and reads its current catalogue from Supabase. This gives the archive room to expand into additional editorial sections such as News and Blog without changing the core gallery workflow.</p></div></section>
      <section className="section-grid team-section" id="our-team"><div className="section-label">04 / Our team</div><div className="section-copy"><h2>The people behind the archive.</h2><p>Meet the people shaping, curating and maintaining HYU PREMIUM.</p>{team.length?<div className="team-grid">{team.map(member=><article className="team-card" key={member.id}><img src={member.image} alt={member.name} loading="lazy" decoding="async"/><div className="team-fade" aria-hidden="true"></div><div className="team-overlay"><h3>{member.name}</h3><div className="team-socials">{SOCIALS.map(([key,label])=>{const hidden=member[`${key}_hidden` as keyof typeof member];const url=safeSocialUrl(String(member[`${key}_url` as keyof typeof member]||''));return !hidden&&url?<a className="team-social" key={key} href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${label} — ${member.name}`} title={label}>{label.slice(0,2)}</a>:null})}</div></div></article>)}</div>:<div className="team-state"><span>OUR TEAM</span><strong>Team profiles coming soon.</strong></div>}</div></section>
    </div>
  </main><SiteFooter/></>;
}
