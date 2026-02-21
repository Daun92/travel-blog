#!/bin/bash
# Add meaningful English slugs to all posts
# Usage: bash scripts/add-slugs.sh

BLOG="C:/Users/blue5/claude/openclaw/blog"

add_slug() {
  local file="$1"
  local slug="$2"

  # Skip if slug already exists
  if grep -q '^slug:' "$file"; then
    echo "SKIP (already has slug): $file"
    return
  fi

  # Add slug after the title line
  sed -i "/^title:/a slug: \"$slug\"" "$file"
  echo "ADDED slug=$slug -> $(basename "$file")"
}

# === TRAVEL POSTS ===
add_slug "$BLOG/content/posts/travel/2026-02-04-1.md" "gyeongju-travel-guide"
add_slug "$BLOG/content/posts/travel/2026-02-04-2-5.md" "winter-travel-best-5"
add_slug "$BLOG/content/posts/travel/2026-02-04-4.md" "busan-haeundae-restaurants"
add_slug "$BLOG/content/posts/travel/2026-02-04-seoul-hanok-village.md" "seoul-bukchon-hanok"
add_slug "$BLOG/content/posts/travel/2026-02-05-7.md" "jeju-cafes-best-7"
add_slug "$BLOG/content/posts/travel/2026-02-05-daegu-alley.md" "daegu-modern-alley"
add_slug "$BLOG/content/posts/travel/2026-02-05-gangneung-cafe.md" "gangneung-coffee-street"
add_slug "$BLOG/content/posts/travel/2026-02-05-jeonju-hanok.md" "jeonju-hanok-village"
add_slug "$BLOG/content/posts/travel/2026-02-05-yeosu-night.md" "yeosu-night-sea"
add_slug "$BLOG/content/posts/travel/2026-02-06-5.md" "seoul-suburb-daytrip-5"
add_slug "$BLOG/content/posts/travel/2026-02-06-bukhansan.md" "bukhansan-hiking"
add_slug "$BLOG/content/posts/travel/2026-02-06-seoul-travel.md" "seoul-travel-guide"
add_slug "$BLOG/content/posts/travel/2026-02-07-1.md" "temple-stay-weekend"
add_slug "$BLOG/content/posts/travel/2026-02-07-2-3.md" "jeonju-hanok-2n3d"
add_slug "$BLOG/content/posts/travel/2026-02-07-2-7.md" "suwon-hwaseong-night"
add_slug "$BLOG/content/posts/travel/2026-02-07-2-top-5.md" "february-weekend-top5"
add_slug "$BLOG/content/posts/travel/2026-02-07-tongyeong.md" "tongyeong-art-village"
add_slug "$BLOG/content/posts/travel/2026-02-07-top-5.md" "korea-hidden-places-top5"
add_slug "$BLOG/content/posts/travel/2026-02-08-12.md" "gunsan-time-travel"
add_slug "$BLOG/content/posts/travel/2026-02-08-90.md" "incheon-chinatown-tour"
add_slug "$BLOG/content/posts/travel/2026-02-08-andong-hahoe.md" "andong-hahoe-village"
add_slug "$BLOG/content/posts/travel/2026-02-08-top-5.md" "sokcho-yangyang-winter-top5"
add_slug "$BLOG/content/posts/travel/2026-02-09-top-5.md" "valentine-travel-top5"
add_slug "$BLOG/content/posts/travel/2026-02-10-busan.md" "busan-gamcheon-f1963"
add_slug "$BLOG/content/posts/travel/2026-02-10-gangneung.md" "gangneung-winter-literary"
add_slug "$BLOG/content/posts/travel/2026-02-10-post-1.md" "gangneung-donghae-humanities"
add_slug "$BLOG/content/posts/travel/2026-02-10-post-2.md" "busan-sanbok-dongnae"
add_slug "$BLOG/content/posts/travel/2026-02-11-12.md" "euljiro-hardware-alley"
add_slug "$BLOG/content/posts/travel/2026-02-11-368.md" "jeju-oreum-geology"
add_slug "$BLOG/content/posts/travel/2026-02-12-post.md" "jecheon-cheongpungho-winter"
add_slug "$BLOG/content/posts/travel/2026-02-13-kt.md" "suncheonman-winter-daytrip"
add_slug "$BLOG/content/posts/travel/2026-02-13-post.md" "namhae-daraengi-german-village"
add_slug "$BLOG/content/posts/travel/2026-02-14-2026.md" "2026-cherry-blossom-forecast"
add_slug "$BLOG/content/posts/travel/2026-02-14-top-7.md" "seoul-night-views-top7"
add_slug "$BLOG/content/posts/travel/2026-02-18-taehwagang.md" "ulsan-taehwagang"
add_slug "$BLOG/content/posts/travel/2026-02-18-to.md" "geoje-tongyeong-drive-top5"
add_slug "$BLOG/content/posts/travel/2026-02-18-vs.md" "yangpyeong-vs-gapyeong"

# === CULTURE POSTS ===
add_slug "$BLOG/content/posts/culture/2026-02-04-mmca-exhibition.md" "mmca-seoul-2026"
add_slug "$BLOG/content/posts/culture/2026-02-05-2026-best-5.md" "seoul-musical-guide-5"
add_slug "$BLOG/content/posts/culture/2026-02-05-post.md" "leeum-museum-guide"
add_slug "$BLOG/content/posts/culture/2026-02-05-seoul-museum.md" "seoul-unique-museums-5"
add_slug "$BLOG/content/posts/culture/2026-02-06-post.md" "paju-art-trip"
add_slug "$BLOG/content/posts/culture/2026-02-07-2-3.md" "modern-dance-review-3"
add_slug "$BLOG/content/posts/culture/2026-02-07-7.md" "seoul-indie-bookstores"
add_slug "$BLOG/content/posts/culture/2026-02-07-post.md" "ikseon-dong-guide"
add_slug "$BLOG/content/posts/culture/2026-02-07-vs.md" "seongsu-popup-store"
add_slug "$BLOG/content/posts/culture/2026-02-08-2.md" "february-seoul-exhibitions"
add_slug "$BLOG/content/posts/culture/2026-02-08-craft-experience.md" "traditional-craft-experience"
add_slug "$BLOG/content/posts/culture/2026-02-08-indie-venue.md" "seoul-indie-venues-top6"
add_slug "$BLOG/content/posts/culture/2026-02-08-traditional-liquor.md" "korean-traditional-liquor"
add_slug "$BLOG/content/posts/culture/2026-02-09-post.md" "seongsu-urban-regeneration"
add_slug "$BLOG/content/posts/culture/2026-02-09-top-5.md" "next-culture-neighborhoods-top5"
add_slug "$BLOG/content/posts/culture/2026-02-11-post.md" "mokpo-modern-history"
add_slug "$BLOG/content/posts/culture/2026-02-12-12.md" "muryeong-tomb-digging"
add_slug "$BLOG/content/posts/culture/2026-02-13-12-1.md" "daejeon-daeheung-indie"
add_slug "$BLOG/content/posts/culture/2026-02-14-post.md" "seollal-traditions"
add_slug "$BLOG/content/posts/culture/2026-02-18-post.md" "seoul-time-layers-digging"
add_slug "$BLOG/content/posts/culture/2026-02-february-performances-top5.md" "february-performances-top5"

echo ""
echo "=== Done! All slugs added. ==="
