'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Artwork } from '@/lib/catalogue';
import { artworkPreview, artworkSrcSet } from '@/lib/catalogue';

export default function ChampionSkinsClient({ category, items }: { category: string; items: Artwork[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const active = items[activeIndex] || items[0];
  const progress = items.length > 1 ? ((activeIndex + 1) / items.length) * 100 : 100;
  const mainSrcSet = useMemo(() => active ? artworkSrcSet(active) : '', [active]);

  useEffect(() => {
    setActiveIndex(0);
  }, [category, items]);

  function selectIndex(nextIndex: number) {
    if (!items.length) return;
    const bounded = Math.max(0, Math.min(items.length - 1, nextIndex));
    setActiveIndex(bounded);
    requestAnimationFrame(() => {
      trackRef.current
        ?.querySelector<HTMLElement>(`[data-skin-index="${bounded}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }

  if (!active) {
    return <div className="champions-empty">Chưa có trang phục hiển thị cho {category}.</div>;
  }

  return <section className="champion-skins-section" aria-labelledby="champion-skins-heading">
    <div className="champion-skins-inner">
      <div className="champion-skins-topline">
        <div>
          <p className="champion-skins-kicker">{category}</p>
          <h1 id="champion-skins-heading">Trang Phục Hiện Có</h1>
        </div>
        <Link className="champion-back-link" href="/champions/" prefetch={false}>← Tất cả tướng</Link>
      </div>

      <div className="champion-media-viewport">
        <img
          src={artworkPreview(active, 1600)}
          srcSet={mainSrcSet || undefined}
          sizes="(max-width: 760px) 100vw, 94vw"
          alt={`${active.name} — ${category}, splash art hạng ${active.rank}`}
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div className="champion-media-veil" aria-hidden="true" />
        <div className="champion-media-meta">
          <div>
            <p className="champion-media-category">{category}</p>
            <h2>{active.name}</h2>
          </div>
          <p className="champion-media-stats">Hạng {active.rank}<br/>Credit · {active.credit}</p>
        </div>
      </div>

      <div className="champion-carousel-wrap">
        <div ref={trackRef} className="champion-carousel-track" role="group" aria-label={`Trang phục ${category}`}>
          {items.map((item, index) => {
            const selected = index === activeIndex;
            return <button
              key={item.id}
              type="button"
              className="champion-skin-slide"
              data-skin-index={index}
              aria-current={selected ? 'true' : undefined}
              aria-label={`Xem ${item.name}`}
              onClick={() => selectIndex(index)}
            >
              <span className="champion-skin-thumb">
                <img
                  src={artworkPreview(item, 640)}
                  alt=""
                  aria-hidden="true"
                  loading={index < 5 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority="low"
                />
              </span>
              <span className="champion-skin-label">{item.name}</span>
            </button>;
          })}
        </div>
      </div>

      <div className="champion-carousel-controls">
        <div className="champion-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
        <div className="champion-control-buttons">
          <button type="button" className="champion-arrow" aria-label="Trang phục trước" disabled={activeIndex === 0} onClick={() => selectIndex(activeIndex - 1)}>‹</button>
          <button type="button" className="champion-arrow" aria-label="Trang phục tiếp theo" disabled={activeIndex >= items.length - 1} onClick={() => selectIndex(activeIndex + 1)}>›</button>
        </div>
      </div>
    </div>
  </section>;
}
