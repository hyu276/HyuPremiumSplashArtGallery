import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getCatalogue } from '@/lib/catalogue';
import MinigameClient from './MinigameClient';
import './minigame.css';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Đoán nhân vật từ Splash Art — HYU PREMIUM',
  description: 'Minigame ngẫu nhiên một artwork trong HYU PREMIUM và thử đoán artwork đó thuộc nhân vật nào trước khi mở đáp án.',
  alternates: { canonical: 'https://hyupremium.vercel.app/minigame/' },
};

export default async function MinigamePage() {
  const { items } = await getCatalogue();
  const artworks = items.map((item) => ({
    id: item.id,
    image: item.thumbnail || item.image,
    category: item.category,
  }));

  return (
    <>
      <SiteHeader />
      <main className="minigame-page">
        <section className="minigame-shell" aria-labelledby="minigame-title">
          <p className="minigame-eyebrow">HYU PREMIUM / MINIGAME</p>
          <h1 id="minigame-title">Đây là artwork của ai?</h1>
          <p className="minigame-intro">
            Roll một artwork ngẫu nhiên, đoán nhân vật rồi mở đáp án để kiểm tra.
          </p>
          <MinigameClient artworks={artworks} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
