# HYU PREMIUM — Changelog

Tài liệu này tổng hợp lịch sử thay đổi của `HyuPremiumSplashArtGallery` theo từng Pull Request đã được đưa vào repository. Các mục được sắp xếp từ mới nhất đến cũ nhất để dễ truy vết quá trình phát triển.

> Phạm vi hiện tại: PR #1 → PR #80.

---

## PR #80 — Refine mobile filter popup UX

- Khôi phục `Search & filters` launcher thành sticky/freeze control trên mobile để luôn truy cập được khi scroll Gallery.
- Giữ launcher/popup chỉ áp dụng ở mobile (`<=760px`); desktop filter deck, layout và behavior không thay đổi.
- Chuyển `Chỉ xem skin Việt Nam?` sang hàng full-width trong popup và bỏ truncate/ellipsis để nhãn luôn hiển thị đầy đủ.
- Khi mở Skin Rank hoặc Image Credit, field đang active tự span toàn chiều ngang; popup tự mở rộng tới chiều cao viewport và dropdown chuyển sang in-flow scroll area cao hơn để cuộn danh sách thuận tiện.
- Category expanded mode cũng tận dụng chiều cao viewport lớn hơn; khóa background scroll khi popup đang mở để tránh cuộn nhầm Gallery phía sau.
- Giữ nguyên filter semantics hiện hữu: thay đổi vẫn áp dụng tức thời, không thêm nút Apply và không thay đổi URL/filter logic.

[Pull Request #80](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/80)

## PR #79 — Move mobile filters into popup

- Chỉ thay đổi Gallery filter UX trên mobile (`<=760px`); desktop tiếp tục dùng nguyên `filter-deck` hiện tại và không thay đổi layout/behavior.
- Loại bỏ mobile sticky/freeze filter pane và thay bằng launcher không-sticky để người dùng chủ động mở bộ lọc.
- Popup tái sử dụng đúng các control hiện hữu: Search, Category + expand/collapse, `Chỉ xem skin Việt Nam?`, Skin Rank và Image Credit.
- Filter vẫn áp dụng tức thời như trước; không thêm nút Apply, không đổi search/filter semantics hoặc URL behavior.
- Tăng touch target của các control trong popup và cho popup/category/dropdown scroll độc lập khi nội dung vượt viewport.

[Pull Request #79](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/79)

## PR #78 — Prevent reload scroll restoration

- Ngăn hard reload trên `/character/...` tự restore stale browser scroll position và đôi khi nhảy xuống gần cuối Gallery.
- Chỉ can thiệp vào reload navigation, tạm dùng manual scroll restoration rồi trả browser về behavior trước đó sau load.
- Giữ Back/Forward, deep links, filter và artwork expand/collapse behavior hiện hữu.

[Pull Request #78](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/78)

## PR #77 — Retry Vercel egress shield on current main

- Bổ sung multi-origin Vercel egress shield để giảm direct artwork media egress từ upstream Storage.
- Route catalogue artwork media và SEO override images qua Vercel cache/proxy layer.
- Gate gallery media theo viewport và safe mode để hạn chế tải ảnh không cần thiết.
- Giữ Gallery UX và canonical artwork behavior trong khi giảm egress amplification.

[Pull Request #77](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/77)

## PR #76 — Add isolated collaborator Supabase and dual-source public catalogue

- Bổ sung mô hình Supabase tách biệt cho collaborator `huy9vnd`, không ghi hoặc đồng bộ dữ liệu sang Supabase của owner.
- Cho phép collaborator truy cập Admin bằng profile riêng thông qua `?db=huy9vnd`.
- Public catalogue đọc đồng thời Supabase của owner và collaborator, hợp nhất artwork, category, rank và image credit.
- Namespace ID của artwork collaborator ở lớp render công khai để tránh collision nhưng không thay đổi ID thật trong database.
- Loader có khả năng chịu lỗi: nếu một nguồn Supabase tạm thời unavailable, website vẫn có thể hiển thị dữ liệu từ nguồn còn lại.
- Giữ publishable key ở phía public và tiếp tục dựa vào Supabase Auth, `public.admins` và RLS để kiểm soát quyền ghi.

[Pull Request #76](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/76)

## PR #75 — Add full SEO Manager dashboard and backend

- Thêm SEO Manager tại `/seomanager.html` với backend Next.js API và Supabase/PostgreSQL.
- Hỗ trợ global metadata, page/artwork override, index/follow, sitemap inclusion, image SEO, Open Graph và JSON-LD override.
- Thêm AI SEO query tracking, crawler policy, `llms.txt` và audit logging.
- SEO tự động hiện hữu tiếp tục là fallback khi không có override được bật.
- Bổ sung schema, RLS, admin policy và lịch sử thay đổi SEO trong Supabase.

[Pull Request #75](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/75)

## PR #74 — Restore gallery UX and feature parity after Next.js migration

- Khôi phục các tính năng Gallery bị regression sau migration Next.js/React/TypeScript.
- Khôi phục 5-column desktop, mobile sticky filter deck, category expand, custom Rank/Credit dropdown và Vietnamese-skin switch.
- Khôi phục progressive gallery: 6 artwork ngẫu nhiên → tối đa 50 artwork theo canonical order → toàn bộ gallery.
- Giữ nguyên View all level khi thay đổi search/filter.
- Khôi phục multi-property AND search, quoted phrase, accent-insensitive search và fuzzy subsequence matching.
- Giữ persistent artwork components và thumbnail-to-original crossfade để tránh black frame khi expand/collapse.

[Pull Request #74](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/74)

## PR #73 — Migrate owner dashboard to React + TypeScript

- Chuyển Owner Dashboard từ legacy HTML/runtime sang Next.js React + strict TypeScript tại `/admin/`.
- Giữ Supabase email/password Auth, `public.admins`, RLS và staged Publish workflow.
- Migrates artwork CRUD, hide/unhide, category/credit/rank management, Vietnamese flag, search và batch actions.
- Migrates original image upload, 16:9 thumbnail generation và optimize-missing-thumbnails workflow.
- Migrates About Us Team CRUD, social visibility, image upload và ordering.
- Giữ `/admin.html` redirect sang `/admin/` và giữ `/admin-legacy/` làm emergency rollback route không được index.

[Pull Request #73](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/73)

## PR #72 — Restore SEO locale and hreflang parity after Next.js migration

- Khôi phục `hreflang=vi`, `hreflang=x-default` và `og:locale=vi_VN` sau migration Next.js.
- Áp dụng cho Gallery, category/character và artwork routes mà không thay đổi URL hoặc UI.

[Pull Request #72](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/72)

## PR #71 — Migrate gallery to Next.js + React + TypeScript and remove mobile image flash

- Migrates public runtime sang Next.js App Router, React 19 và strict TypeScript.
- Thay `gallery.innerHTML` destructive rerender bằng persistent/memoized artwork components.
- Giữ thumbnail hiển thị trong lúc preload/decode original rồi crossfade sang ảnh gốc, loại bỏ mobile black/blank-frame flash khi expand/collapse.
- Chuyển catalogue read sang server-side Supabase với ISR/revalidation.
- Giữ canonical `/character/{character}/{artwork}/`, legacy redirects, SEO metadata, JSON-LD, sitemap và image sitemap.
- Migrates About/News/Blog và live Supabase team profiles.
- Chuyển Vercel từ static `dist` output sang native Next.js `.next` output.

[Pull Request #71](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/71)

## PR #70 — Preserve full-resolution expansion after egress fix

- Mở rộng egress guard tới toàn bộ routed gallery HTML pages.
- Collapsed cards tiếp tục dùng thumbnail, nhưng expanded card chuyển lại full-resolution original.
- Thêm kiểm tra build để báo lỗi rõ ràng nếu không có gallery route nào được patch.

[Pull Request #70](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/70)

## PR #69 — Fix Supabase Storage egress amplification

- Loại bỏ build-time HEAD/Range probing mọi original và thumbnail trên Supabase Storage.
- Initial catalogue query lấy `thumbnail` và Gallery dùng thumbnail mặc định.
- Giữ original URL riêng và chỉ tải ảnh gốc khi artwork được expand.
- Không xóa, di chuyển, re-upload hoặc migrate bất kỳ Storage object nào.
- Giữ nguyên SEO build, canonical routes và image sitemap pipeline.

[Pull Request #69](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/69)

## PR #68 — Fix local semantic image URL canonicalization

- Sửa lỗi image SEO finalizer có thể double-prefix production origin vào URL ảnh local vốn đã absolute.
- Chỉ canonicalize attribute khi toàn bộ value chính xác là relative local image URL.
- Giữ nguyên dimensions, structured data và absolute semantic image URLs.

[Pull Request #68](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/68)

## PR #67 — Deep image SEO for canonical artwork pages

- Bổ sung build-time deep image SEO cho canonical artwork pages.
- Thu thập dimensions, MIME type và content size của original/thumbnail.
- Bổ sung Open Graph image dimensions/type/secure URL.
- Đặt original artwork làm `primaryImageOfPage` và representative ImageObject; thumbnail được model như media riêng.
- Bổ sung width/height cho semantic image element.
- Rebuild `image-sitemap.xml` với canonical artwork page URL và original image URL.
- Chuẩn hóa local image references thành absolute production URLs mà không rename Storage assets.

[Pull Request #67](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/67)

## PR #66 — Maximize artwork relevance for fanmade and Vietnamese skin search intent

- Tối ưu title tags cho intent `Skin Fanmade Liên Quân` hoặc `Skin Việt Nam Liên Quân`, giới hạn 60 ký tự.
- Tối ưu meta description theo intent fanmade/Vietnamese-skin, giới hạn 155 ký tự.
- Thêm artwork-specific H1, visible context, alt text và factual aliases.
- Nâng structured data thành `VisualArtwork` + `CreativeWork`, thêm `alternateName`, game entity, keywords, artform, genre, dateModified và ImageObject semantics.
- Đọc Vietnamese-skin flag từ Supabase ở build time mà không mutate database.
- Ngăn client-side title sync ghi đè server-optimized title khi vào canonical page trực tiếp.

[Pull Request #66](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/66)

## PR #65 — Improve on-page SEO for all canonical artwork URLs

- Bổ sung post-build artwork SEO layer cho tất cả canonical artwork pages.
- Tạo unique Vietnamese meta descriptions và artwork-specific metadata.
- Đồng bộ Open Graph/Twitter description, alt text và JSON-LD.
- Thêm visible semantic artwork context block với original image, character/rank/credit và internal links.
- Không thay đổi canonical URL, Supabase artwork rows hoặc runtime gallery behavior.

[Pull Request #65](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/65)

## PR #64 — Canonicalize artwork URLs from display names without changing gallery features

- Chuyển artwork slug sang derive từ display name thay vì technical/global ID.
- Chuẩn hóa tiếng Việt `đ/Đ` thành `d`, punctuation thành hyphen.
- Loại bỏ duplicate suffix không cần thiết trong character namespace; chỉ thêm `-2`, `-3` khi collision thật trong cùng character.
- Sửa character slug như `Điêu Thuyền` → `dieu-thuyen`.
- Migrate sitemap, image sitemap, canonical, JSON-LD và internal links sang clean URLs.
- Generate compatibility/noindex redirects cho legacy nested URLs khi khả thi.

[Pull Request #64](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/64)

## PR #63 — Preserve existing gallery UX on character and artwork URLs

- Giữ `/character/` là cùng Gallery app thay vì tách thành trải nghiệm mới.
- Category click cập nhật URL nhưng vẫn dùng existing filter behavior.
- Artwork click cập nhật nested URL nhưng vẫn expand/collapse in-place.
- Direct loading nested artwork URL tự restore category và expanded artwork.
- Browser back/forward restore gallery route state.
- Generate route-specific canonical/title/description/social metadata/JSON-LD.
- Legacy `/artwork/...` giữ `noindex,follow` và canonical sang nested URL.

[Pull Request #63](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/63)

## PR #62 — Keep Character nav after existing Supabase runtime loads

- Sửa runtime cũ ghi đè navigation item đầu tiên về `Gallery` sau initialization.
- Normalize wordmark và first nav item trở lại `/character/` sau khi Supabase runtime load.
- Không thay đổi Supabase/search/filter/mobile/gallery logic.

[Pull Request #62](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/62)

## PR #61 — Safe character URL architecture without changing gallery features

- `/` và `/characters/` redirect vĩnh viễn sang `/character/`.
- `/character/` chạy existing Gallery app; `/character/<character>/` chạy cùng app với category preselected.
- Artwork URLs chuyển sang `/character/<character>/<artwork>/`.
- Giữ legacy `/artwork/...` ở dạng noindex/follow với canonical migration.
- Migrate sitemap và internal artwork links sang hierarchy mới.
- Sử dụng `<base href="/">` để asset/runtime vẫn resolve đúng từ nested routes.

[Pull Request #61](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/61)

## PR #60 — Make character routes the primary site architecture

- Chuyển URL architecture chính sang `/character/`.
- Root và legacy plural character index redirect sang `/character/`.
- Category clicks dẫn tới `/character/<character>/`; artwork clicks dẫn tới nested artwork URL.
- Old `/artwork/<id>/` redirects sang canonical nested routes.
- Cập nhật metadata, structured data, breadcrumbs, internal navigation, sitemap và Vercel routing.

[Pull Request #60](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/60)

## PR #59 — Add static internal link architecture

- Tạo crawlable character/category landing pages liên kết tới artwork pages liên quan.
- Thêm persistent internal navigation giữa homepage, artwork index, detail pages và character pages.
- Bổ sung canonical metadata, structured data, breadcrumbs và image SEO cho internal architecture.
- Mở rộng sitemap và image sitemap với character landing/index routes.

[Pull Request #59](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/59)

## PR #58 — Fix expanded mobile categories overlapping search

- Sửa expanded Category mode trên mobile để không che Search.
- Khi expanded, filter deck chuyển thành ba hàng rõ ràng: Search → Categories → Vietnamese/Rank/Credit.
- Giữ compact two-row layout khi Category collapsed.
- Cache-bust mobile compact stylesheet.

[Pull Request #58](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/58)

## PR #57 — Compact mobile sticky filters and auto-fit expanded titles

- Giảm mobile sticky filter deck xuống hai hàng compact.
- Hàng 1: Search + Category; hàng 2: Vietnamese switch + Rank + Credit.
- Giảm heights, padding và gaps trong khi giữ đầy đủ filter behavior.
- Thêm mobile expanded-title fitter để expanded artwork title giữ một dòng và tự fit theo available width.
- Collapsed titles giữ ellipsis; desktop title fitting không đổi.

[Pull Request #57](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/57)

## PR #56 — Fix Admin batch actions not appearing

- Sửa trường hợp batch controls tồn tại trong repo nhưng Admin tải stale asset URLs nên không hiển thị.
- Cache-bust admin UI, enhancements, Vietnamese property, team layout, thumbnail và batch modules.
- Cho `admin-ui` load batch-actions trực tiếp thay vì phụ thuộc hoàn toàn vào module khác.
- Thêm load/error/timeout fallback để batch controls vẫn initialize khi module Vietnamese-property lỗi.

[Pull Request #56](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/56)

## PR #55 — Add batch artwork actions to Admin Dashboard

- Thêm checkbox trên artwork rows, `Select visible`, selected count và batch toolbar.
- Batch actions: Hide, Clone, Mark Việt Nam, Remove Việt Nam, Delete.
- Batch changes vẫn local/unpublished cho tới `Publish changes`.
- Clone giữ metadata, visibility, image và Vietnamese flag nhưng tạo unique ID/name.
- Shared Storage images không bị duplicate và được bảo vệ khi xóa artwork còn reference chung.
- `Select visible` chỉ tác động artwork đang hiện theo current Admin search.

[Pull Request #55](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/55)

## PR #54 — Add Vietnamese skin property, filter and combined search

- Thêm `artworks.is_vietnamese_skin boolean` vào Supabase và partial index cho visible Vietnamese skins.
- Admin có checkbox `Đây là skin Việt Nam`, badge Việt Nam và staged publish support.
- Public Gallery có switch `Chỉ xem skin Việt Nam?` kết hợp được với Category/Rank/Credit/Search.
- Search hỗ trợ aliases `Việt Nam`, `Vietnam`, `VN`, `skin Việt Nam` chỉ cho artwork được flag.
- Giữ token-AND behavior cho các query kết hợp nhiều thuộc tính.

[Pull Request #54](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/54)

## PR #53 — Add static artwork SEO and Google Images indexing

- Chuyển Vercel build sang tạo static SEO output từ visible Supabase artworks.
- Generate `/artworks/`, stable artwork pages, `sitemap.xml`, `image-sitemap.xml` và `robots.txt`.
- Thêm canonical URLs, robots max-image-preview, Open Graph/Twitter metadata và structured data.
- Image sitemap chứa original image URL và factual artwork metadata.
- Dynamic Gallery images có descriptive `alt`, `title` và ARIA metadata.
- Hidden artworks bị loại khỏi generated SEO pages.
- URLs dùng artwork ID để giữ stability khi artwork đổi tên ở giai đoạn kiến trúc này.

[Pull Request #53](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/53)

## PR #52 — Preserve View all state across filters and animate CTA

- Giữ View all expansion level khi Search/Category/Rank/Credit thay đổi.
- Nếu đã mở mức 50, filtered results giữ mức 50; nếu đã mở full gallery, filter vẫn full.
- Initial 6-artwork state chỉ áp dụng trước lần View all đầu tiên.
- Thêm cyan pulse, sheen và arrow animation cho View all CTA.
- Tôn trọng `prefers-reduced-motion`.

[Pull Request #52](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/52)

## PR #51 — Compact mobile hero and sticky filters

- Giảm mạnh chiều cao mobile hero và scale typography/decorative elements.
- Nén sticky filter deck xuống khoảng một nửa footprint cũ.
- Giảm height/gap/padding của Search, Category, Rank, Credit controls.
- Giữ category expanded mode khi người dùng chủ động mở toàn bộ category list.
- Desktop không thay đổi.

[Pull Request #51](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/51)

## PR #50 — Move team list beside editor and add drag reordering

- Chuyển Team Manager thành full-width two-column panel: editor bên trái, member list bên phải.
- Thêm drag handle và mouse/touch/pen drag-and-drop ordering.
- Persist thứ tự vào `team_members.sort_order` trong Supabase.
- Update order numbers ngay trên UI.
- Rollback DOM/database order nếu reorder save thất bại.
- Giữ Edit/Hide/Unhide và Team CRUD hiện hữu.

[Pull Request #50](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/50)

## PR #49 — Show six random artworks on initial gallery load

- Giảm initial random sample từ 12 xuống 6 artwork.
- First View all vẫn chuyển sang tối đa 50 artwork theo canonical order; second View all vẫn mở full gallery.

[Pull Request #49](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/49)

## PR #48 — Add optimized artwork thumbnail pipeline

- Thêm nullable `artworks.thumbnail` vào Supabase.
- Admin tự generate thumbnail tối đa 1600×900 WebP/JPEG cho upload mới hoặc image replacement.
- Thêm `Optimize missing thumbnails` để backfill sequentially cho existing artworks.
- Derivatives lưu tại `artworks/thumbnails/` với long cache lifetime.
- Collapsed Gallery dùng thumbnail; expanded view dùng full-resolution original.
- Mobile và desktop fallback về original khi thumbnail load fail.
- Thêm Image optimizer destination vào Admin quick navigation.

[Pull Request #48](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/48)

## PR #47 — Enhance gallery search across multiple artwork properties

- Search nhiều term có thể match trên các property khác nhau nhưng tất cả term đều phải match.
- Searchable: Name, Description, Category, Skin rank, Image credit và Tags.
- Case-insensitive, Vietnamese-diacritic-insensitive.
- Giữ fuzzy/subsequence matching cho unquoted term dài từ 4 ký tự.
- Thêm quoted exact phrase search, ví dụ `"bãi biển" Aya`.
- Kết hợp với Category/Rank/Credit filters và progressive gallery hiện hữu.

[Pull Request #47](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/47)

## PR #46 — Fix incomplete artwork rendering on mobile Safari

- Sửa artwork card đôi khi đen hoặc render không đầy đủ trên mobile Safari khi mở gallery lớn.
- Thêm mobile viewport-managed image loader.
- Chỉ gán real source cho ảnh gần viewport, giới hạn concurrent large-image load và ưu tiên card gần nhất.
- Unload decoded bitmaps khi card đi xa viewport để giảm memory/GPU pressure.
- Retry failed image loads và prune nodes bị destroy bởi rerender.
- Tắt image CSS filter/transform/transition compositing trên mobile để giảm WebKit GPU texture pressure.

[Pull Request #46](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/46)

## PR #45 — Freeze gallery filters on mobile

- Làm Gallery filter deck sticky trên mobile giống desktop.
- Giữ Search, Category, Rank và Credit luôn accessible khi scroll.
- Tăng stacking context để custom dropdown nằm trên artwork cards.

[Pull Request #45](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/45)

## PR #44 — Fix first View all to replace random sample with canonical 50

- Initial state vẫn là random sample.
- First View all thay thế random cards bằng first up-to-50 artworks theo canonical catalogue order thay vì append sau random sample.
- Second View all mở full gallery nếu còn artwork.
- Explicitly preserve viewport scroll position khi reveal.

[Pull Request #44](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/44)

## PR #43 — Unify main filter UX and progressively reveal gallery

- Rank chuyển sang cùng compact custom dropdown UX với Image Credit.
- Unified capped-height menu, slim scrollbar, active state và keyboard controls.
- Default Gallery load hiển thị 12 artwork được shuffle bằng `crypto.getRandomValues()`.
- First View all reveal tới 50; second View all mở full gallery.
- Filtered/search views dùng canonical order thay vì randomization.
- Filter context change reset progressive view; expand/collapse không reshuffle current sample.

[Pull Request #43](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/43)

## PR #42 — Compact the main gallery credit dropdown

- Thay browser-native Image Credit select bằng custom compact dropdown.
- Menu giới hạn height, có slim vertical scrollbar.
- Highlight active credit và auto-scroll active option vào view khi reopen.
- Hỗ trợ mouse, arrow keys, Enter/Space và Escape.

[Pull Request #42](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/42)

## PR #41 — Add image credit filter to main gallery

- Thêm Image Credit dropdown vào public Gallery filter deck.
- Credit choices lấy động từ Supabase catalogue options và visible artwork values.
- Thêm `All credits` để clear filter.
- Credit filter kết hợp với Search, Category và Rank.
- Preserve selected credit qua catalogue refresh nếu option vẫn tồn tại.

[Pull Request #41](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/41)

## PR #40 — Compact admin options and add quick navigation

- Category/Image Credit/Skin Rank option lists có thể collapse/expand độc lập.
- Groups mặc định collapsed và nhớ state trong `sessionStorage`.
- Collapse controls hiển thị current option count.
- Thêm desktop left-side Quick navigation cho Add artwork, Artwork choices, About Us/Team và Artwork list.
- Trên narrow screens, rail biến thành sticky horizontal navigation.

[Pull Request #40](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/40)

## PR #39 — Add Supabase-managed Our Team section

- Thêm Section 04 / Our Team vào About Us với responsive team portrait cards.
- Public cards hỗ trợ Facebook, TikTok, Instagram, X và LinkedIn theo URL + per-platform hidden flag.
- Admin có Team Manager để add/edit member, sort order, portrait, visibility và social links.
- Portrait upload vào dedicated Supabase `team` bucket.
- Thêm `team_members` model, RLS và admin-only management policies.
- Team persistence độc lập với artwork Publish workflow.

[Pull Request #39](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/39)

## PR #38 — Harden browser-side Supabase admin authentication

- Tắt persisted Supabase session và URL session restore; Admin token chỉ tồn tại trong JS memory.
- Public pages không restore/persist admin session.
- Dọn legacy Supabase auth entries khỏi local/session storage.
- Thêm no-referrer, best-effort no-cache, CSP và clickjacking defense.
- Clear credential fields, mask signed-in email và auto logout sau 15 phút inactivity.
- Strip unexpected Admin query/hash fragments khỏi browser history.
- Thêm `.gitignore` rules cho env/credential/private-key files và `SECURITY.md`.

[Pull Request #38](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/38)

## PR #37 — Fix admin metadata edits and add Keep Name + Clone

- Sửa metadata-only edit để giữ existing image khi không chọn replacement.
- Thêm `Keep Name` để Add/Clone tiếp theo có thể giữ tên hiện tại.
- Thêm Clone button để prefill Add Artwork từ existing artwork.
- Clone giữ tags/visibility.
- Bảo vệ shared Supabase Storage image để delete/replace một clone không xóa image còn được artwork khác reference.

[Pull Request #37](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/37)

## PR #36 — Hide inline rank beside artwork category

- Loại bỏ rank text khỏi metadata line phía trên artwork title.
- Giữ category ở metadata line, top-right rank badge và bottom rank label không đổi.

[Pull Request #36](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/36)

## PR #35 — Allow active category filter to toggle off

- Click lại category đang active sẽ clear category filter và quay về `All`.
- Không thay đổi search, rank filtering hoặc category scrolling/expand logic.

[Pull Request #35](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/35)

## PR #34 — Compact and expand category filter

- Làm category buttons compact hơn.
- Thêm visible horizontal scrollbar cho long category lists.
- Mouse wheel có thể horizontal-scroll collapsed category strip.
- Thêm Expand/Collapse để hiện categories thành wrapped multi-row view.
- Giữ active selection và Supabase filtering logic.

[Pull Request #34](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/34)

## PR #33 — Restore original Arial and Georgia typography

- Khôi phục Arial/Helvetica + Georgia typography của public site.
- Giữ các fix về Vietnamese diacritic rendering, line-height, Unicode NFC và stable one-line auto-fit.
- Gỡ dependency Be Vietnam Pro webfont.

[Pull Request #33](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/33)

## PR #32 — Fix Vietnamese diacritic clipping in artwork titles

- Tăng line-height và giảm aggressive negative tracking cho artwork titles.
- Không clip glyph bounds ở desktop.
- Normalize title strings về Unicode NFC trước khi fit.
- Round dynamic font size tới 0.1px để ổn định Chromium rasterization.
- Giữ one-line auto-fit behavior.

[Pull Request #32](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/32)

## PR #31 — Replace public typography with Vietnamese-safe font

- Áp dụng Be Vietnam Pro trên Gallery, About, News và Blog.
- Dùng real font weights 400–900 và family-matched italic.
- Artwork titles giữ weight 800.
- Re-run title fitting sau khi webfont load để tránh tính toán bằng fallback metrics.

[Pull Request #31](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/31)

## PR #30 — Auto-fit artwork titles to one line

- Giữ desktop artwork titles trên một dòng.
- Measure title width so với card width và giảm font size chỉ khi cần.
- Recalculate sau rerender, expand/collapse, filter và window resize.
- Mobile behavior không đổi.

[Pull Request #30](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/30)

## PR #29 — Fix Vercel routes for About, News and Blog

- Thêm directory-based pages cho `/about/`, `/news/` và `/blog/`.
- Thêm Vercel redirects từ legacy `.html` URLs sang clean routes.
- Thêm rewrites để clean routes resolve đúng tới directory index pages.
- Giữ original `.html` files để compatibility.

[Pull Request #29](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/29)

## PR #28 — Expand HYU PREMIUM into a multi-page site

- Chuyển public experience từ gallery-only thành multi-page website.
- Navigation mới: Gallery / About us / News / Blog.
- Thêm independent About, News và Blog pages.
- News/Blog sử dụng honest empty state khi chưa có content.
- Mobile navigation được hiển thị thay vì ẩn.
- Gallery/Supabase/filter/rank/mobile-card logic được giữ nguyên.

[Pull Request #28](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/28)

## PR #27 — Add SSS+ and Ultimate badge gradients

- Thêm gradient cho `SSS+` và `SSS+ Ultimate`.
- Legacy `SSS+ Tối thượng` map sang cùng Ultimate gradient.
- Giữ white badge text và text shadow để đảm bảo readability.

[Pull Request #27](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/27)

## PR #26 — Style skin rank badges with tier gradients

- Áp dụng gradient riêng cho rank A, S, S+, SS, SS+ và SSS.
- White text cho mọi rank.
- SSS+ và SSS+ Tối thượng tạm giữ cyan ở giai đoạn này.
- Styling hoạt động sau filtering, expansion và Supabase refresh.

[Pull Request #26](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/26)

## PR #25 — Use uploaded HYU Industries logo for brand icon and favicon

- Thay generated monogram bằng chính HYU Industries logo do owner cung cấp.
- Thêm optimized PNG asset.
- Dùng logo cho header icon, favicon, shortcut icon và Apple touch icon.

[Pull Request #25](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/25)

## PR #24 — Add HYU PREMIUM brand mark and favicon

- Thêm geometric HYU PREMIUM H monogram SVG.
- Hiển thị brand mark cạnh wordmark trong public header.
- Sử dụng cùng SVG làm favicon/shortcut icon.

[Pull Request #24](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/24)

## PR #23 — Switch owner dashboard and public catalogue to Supabase

- Chuyển Admin authentication từ GitHub PAT sang Supabase email/password Auth.
- Verify user trong `public.admins`.
- Admin load và quản lý artwork/category/credit/rank trực tiếp từ Supabase.
- Giữ Add/Edit/Delete/Hide/Unhide, searchable choices, remembered choices và option management.
- Upload local images vào Supabase Storage `artworks` bucket.
- Catalogue edits không còn cần GitHub commit hoặc Vercel redeploy.
- Public Gallery đọc Supabase trước, GitHub JSON/live data giữ làm fallback trong giai đoạn stabilization.

[Pull Request #23](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/23)

## PR #22 — Enable Supabase project configuration for migration

- Bật browser-safe Supabase Project URL và publishable key cho migration tool.
- Cho migration page authenticate owner và import GitHub catalogue.
- Chưa chuyển public Gallery hoặc Admin data source sang Supabase ở PR này.
- Nhấn mạnh không expose service-role/secret key trong browser config.

[Pull Request #22](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/22)

## PR #21 — Remember last artwork choices and make category/credit searchable

- Category và Image Credit trong Add Artwork trở thành searchable autocomplete.
- Validate typed values theo existing choices để tránh arbitrary unregistered metadata.
- Remember Category, Rank và Credit sau khi add thành công.
- Lưu remembered trio trong `sessionStorage` qua dashboard refresh.
- Edit existing artwork không overwrite remembered Add defaults.
- Rename choice sẽ update remembered value tương ứng.

[Pull Request #21](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/21)

## PR #20 — Improve mobile gallery with two-column thumbnails and credits

- Mobile portrait giữ 2-column Gallery thay vì collapse xuống 1 column.
- Tapped artwork expand full width của two-column row ở 16:9.
- Restore Image Credit text trên mobile và ẩn duplicate bottom rank label.
- Tinh chỉnh typography, badges và controls cho compact mobile cards.

[Pull Request #20](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/20)

## PR #19 — Allow renaming skin rank choices across gallery

- Thêm Edit/Rename cho Skin Rank choices.
- Rename giữ nguyên vị trí trong rank ordering.
- Rewrite tất cả artwork dùng old rank, kể cả hidden artworks, trước khi Publish.

[Pull Request #19](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/19)

## PR #18 — Add Supabase foundation and migration tooling

- Thêm normalized Supabase schema cho artworks, categories, credits và ranks.
- Thêm Supabase Auth authorization qua `public.admins` và RLS.
- Thêm public `artworks` Storage bucket với admin-only write/delete.
- Thêm disabled browser config và reusable public data source.
- Thêm authenticated one-time migration page để import existing GitHub JSON catalogue.
- Thêm migration runbook; Supabase vẫn disabled mặc định ở giai đoạn này.

[Pull Request #18](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/18)

## PR #17 — Allow renaming category and image credit choices

- Thêm rename/edit cho Category và Image Credit choices.
- Rename cập nhật mọi artwork đang dùng old value, kể cả hidden artworks.
- Publish đồng thời catalogue và options để public Gallery/filter/credits đồng bộ.

[Pull Request #17](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/17)

## PR #16 — Fix gallery disappearing when GitHub live sync fails

- Render deployed GitHub Pages catalogue trước để Gallery không blank khi GitHub API unavailable/rate-limited.
- Live `main` synchronization trở thành best-effort background enhancement.
- Dùng same-origin artwork assets cho deployed catalogue.
- Throttle live revision checks còn tối đa một lần mỗi 30 giây.

[Pull Request #16](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/16)

## PR #15 — Fix public gallery sync after owner edits

- Public Gallery lấy latest `main` commit SHA từ GitHub API.
- JSON/options/repo-hosted images được đọc từ immutable commit SHA thay vì cache-prone branch URL.
- Khi tab regain focus/visibility, Gallery kiểm tra revision và rerender nếu `main` thay đổi.
- Giữ filters, hidden behavior và 16:9 layout.

[Pull Request #15](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/15)

## PR #14 — Hide admin entry and simplify catalogue controls

- Xóa public Owner Dashboard button/link và legacy `/owner/` redirect.
- `/admin.html` chỉ còn accessible qua direct URL.
- Xóa visible Sort by control và order explanation.
- Internal deterministic ordering logic vẫn giữ nguyên.

[Pull Request #14](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/14)

## PR #13 — Brighten HYU blue accents for stronger contrast

- Brighten main accents sang electric cyan/blue với luminance cao hơn.
- Thêm restrained glow cho wordmark, hero accent, owner button, active category, badges, search và metadata.
- Tăng nhẹ hero grid/radial/circle treatment mà không làm sáng nền đen.

[Pull Request #13](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/13)

## PR #12 — Rebrand public gallery to HYU PREMIUM blue system

- Rebrand `VOIDFRAME` thành `HYU PREMIUM`.
- Giữ nền black nhưng thay lime/green accent bằng HYU blue palette.
- Cập nhật hero, wordmark, buttons, search focus, active category, rank badges, metadata và hover states.
- Không thay đổi artwork data hoặc publish logic.

[Pull Request #12](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/12)

## PR #11 — Fix new artwork publishing and live gallery refresh

- Admin startup đọc authoritative `data/artworks.json` và `data/options.json` trực tiếp từ GitHub branch thay vì Pages copy.
- Record loaded blob SHAs và từ chối Publish nếu repo đã thay đổi từ lúc load để tránh stale-tab overwrite.
- Sau Publish, re-read GitHub để confirm saved state.
- Không rewrite unchanged JSON files.
- Public Gallery thử current `main` raw data trước rồi fallback Pages copy.
- Repository-hosted images dùng raw GitHub path để hiển thị trước khi Pages rebuild xong.

[Pull Request #11](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/11)

## PR #10 — Enforce category A-Z and new skin rank ordering

- Thay rank system cũ S/A/B/C bằng A, S, S+, SS, SS+, SSS, SSS+, SSS+ Tối thượng.
- Legacy B/C artwork ranks migrate về A.
- Canonical sort: Category A→Z, sau đó configured rank sequence, sau đó artwork name A→Z.
- Search/filter results giữ cùng canonical order.
- Loại bỏ user-selectable sort modes cũ.

[Pull Request #10](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/10)

## PR #9 — Add editable artwork category choices to owner dashboard

- Category trở thành editable artwork property trong Add/Edit.
- Owner có thể add/remove Category choices cạnh Credit và Rank choices.
- Categories persist trong `data/options.json`.
- Existing artwork category values được giữ ngay cả khi option bị remove.
- Category được đưa vào Admin search/list display.

[Pull Request #9](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/9)

## PR #8 — Fix repeated owner dashboard publish conflicts

- Loại bỏ persistent SHA state gây stale publish conflicts.
- Thêm `cache: no-store` và cache-busting query cho GitHub API requests.
- Refetch current SHA ngay trước mỗi PUT.
- Retry một lần khi gặp SHA/concurrency conflict.
- Áp dụng cho artwork/options writes, image deletion và initial data loads.

[Pull Request #8](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/8)

## PR #7 — Fix repeated admin publishes after SHA changes

- Sửa Admin reuse cached blob SHA giữa các lần Publish.
- Write helper fetch current GitHub file SHA ngay trước mỗi PUT cho `data/artworks.json` và `data/options.json`.
- Repeated Hide/Unhide/Edit/Publish không còn phụ thuộc stale SHA.

[Pull Request #7](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/7)

## PR #6 — Add artwork visibility, credits and editable rank choices

- Thêm Hide/Unhide cho từng artwork; hidden artwork vẫn tồn tại trong Admin/GitHub nhưng không render public.
- Simplify artwork editing quanh Name, Description, Rank, Image Credit và Image.
- Owner có thể quản lý Image Credit và Skin Rank choices trong `data/options.json`.
- Public Gallery loại hidden records khỏi render/count/search/filter.
- Hiển thị image credit và build rank filter/sorting từ owner-managed choices.

[Pull Request #6](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/6)

## PR #5 — Fix direct access to owner admin dashboard

- Public Owner Dashboard links được đổi từ `/owner/` redirect layer sang trực tiếp `./admin.html`.
- Giữ `/owner/` làm optional fallback route ở giai đoạn này.
- Không thay đổi Gallery data hoặc Admin CRUD functionality.

[Pull Request #5](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/5)

## PR #4 — Expose owner dashboard from the live gallery

- Làm Owner Dashboard dễ discover hơn từ public site.
- Thêm Owner Dashboard button ở header và links trong About/footer.
- Thêm `/owner/` helper route redirect tới existing editor.
- Publishing vẫn được bảo vệ bởi GitHub owner verification.

[Pull Request #4](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/4)

## PR #3 — Redesign public gallery with editorial 16:9 UX

- Redesign Gallery theo editorial ArtStation-style dark archive.
- Thêm oversized hero, sticky filter deck, metadata overlays và acid-lime accent.
- Enforce strict 16:9 cho mọi thumbnail ở mọi breakpoint.
- Responsive grid 4/3/2/1 columns ở giai đoạn này.
- Giữ fuzzy search, category/rank filters, descriptions và in-place expansion.
- Cải thiện semantic controls, focus styles và reduced-motion support.

[Pull Request #3](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/3)

## PR #2 — Upgrade owner dashboard for artwork and image management

- Verify GitHub token thuộc repository owner trước khi Publish.
- Admin hỗ trợ edit name, description, category, rank, tags và image.
- Hỗ trợ upload JPG/PNG/WebP/GIF trực tiếp vào `assets/artworks/` và external image URLs.
- Tự dọn repository-hosted image khi artwork bị delete hoặc image được replace.
- Track unpublished changes và pending image operations; warn trước khi leave khi chưa Publish.
- Public Gallery hiển thị descriptions và đưa descriptions vào search.

[Pull Request #2](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/2)

## PR #1 — Build gaming splash-art gallery and owner dashboard

- Khởi tạo ArtStation-inspired responsive gaming splash-art catalogue.
- Thêm fuzzy/name/tag search, Category và S/A/B/C rank filters, sorting và lazy loading.
- Artwork click expand in-place thay vì modal.
- Thêm owner-only CRUD dashboard và GitHub publishing workflow dùng session-only fine-grained PAT.
- Chuẩn bị static structure cho GitHub Pages.
- Document security/privacy limitation của static hosting và public repository assets.

[Pull Request #1](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/1)

---

## Ghi chú duy trì changelog

Khi có Pull Request mới được merge, nên thêm mục mới ở đầu danh sách theo format:

```md
## PR #NN — Pull Request title

- Thay đổi quan trọng 1.
- Thay đổi quan trọng 2.
- Bug fix / migration / deployment impact nếu có.

[Pull Request #NN](https://github.com/hyu276/HyuPremiumSplashArtGallery/pull/NN)
```

Ưu tiên ghi lại **hành vi sản phẩm, kiến trúc, dữ liệu, bảo mật, SEO, deployment và bug fix có ảnh hưởng thực tế** thay vì chỉ liệt kê file đã thay đổi.