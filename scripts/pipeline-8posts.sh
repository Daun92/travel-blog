#!/bin/bash
# OpenClaw 8-Post Full Pipeline
# Generate → Enhance → Factcheck → Fix Paths → AEO → Publish → Moltbook
set -e
cd "C:/Users/blue5/claude/openclaw"

LOG="reports/pipeline-$(date +%Y%m%d-%H%M%S).log"
mkdir -p reports

log() { echo "[$(date +%H:%M:%S)] $1" | tee -a "$LOG"; }

log "=== OpenClaw 8-Post Pipeline Start ==="

#───────────────────────────────────────────
# Phase 1: Generate (4 batches x 2 posts)
#───────────────────────────────────────────
for batch in 1 2 3 4; do
  log "--- Batch $batch/4: Generating 2 posts ---"
  npm run daily:run -- --count 2 2>&1 | tee -a "$LOG" || true

  if [ $batch -lt 4 ]; then
    log "Rate limit cooldown (90s)..."
    sleep 90
  fi
done

log "=== Phase 1 Complete: Generation done ==="
sleep 30

#───────────────────────────────────────────
# Phase 2: Process each draft
#───────────────────────────────────────────
DRAFTS=$(ls drafts/*.md 2>/dev/null || true)
DRAFT_COUNT=$(echo "$DRAFTS" | grep -c '.md' || echo 0)
log "Found $DRAFT_COUNT drafts to process"

PROCESSED=0
FAILED=""

for draft in $DRAFTS; do
  [ -z "$draft" ] && continue
  filename=$(basename "$draft")
  PROCESSED=$((PROCESSED + 1))
  log ""
  log "=== [$PROCESSED/$DRAFT_COUNT] Processing: $filename ==="

  # Step 2: Enhance
  log "[Enhance] $filename"
  npm run enhance -- -f "$draft" 2>&1 | tee -a "$LOG" || true
  sleep 45

  # Step 3: Factcheck
  log "[Factcheck] $filename"
  FCHECK=$(npm run factcheck -- -f "$draft" 2>&1 | tee -a "$LOG")
  FC_RESULT=$(echo "$FCHECK" | grep -oP '\d+%' | head -1 || echo "0%")
  log "Factcheck result: $FC_RESULT"
  sleep 45

  # Step 4: Fix cover image path (missing /travel-blog/ prefix)
  log "[Fix paths] $filename"
  sed -i "s|image: /images/|image: /travel-blog/images/|g" "$draft" 2>/dev/null || true
  sed -i "s|image: '/images/|image: '/travel-blog/images/|g" "$draft" 2>/dev/null || true
  sed -i 's|image: "/images/|image: "/travel-blog/images/|g' "$draft" 2>/dev/null || true

  # Step 5: AEO
  log "[AEO] $filename"
  npm run aeo -- -f "$draft" --apply 2>&1 | tee -a "$LOG" || true
  sleep 45

  # Step 6: Set draft: false
  log "[Publish prep] $filename - setting draft: false"
  sed -i 's/^draft: true/draft: false/' "$draft" 2>/dev/null || true
  sed -i "s/^draft: 'true'/draft: false/" "$draft" 2>/dev/null || true

  # Step 7: Determine target directory and copy
  CATEGORY=$(grep -oP "categories:\s*\n\s*-\s*\K\w+" "$draft" 2>/dev/null || echo "")
  if [ -z "$CATEGORY" ]; then
    CATEGORY=$(grep -oP '^\s*-\s*(travel|culture)' "$draft" | head -1 | tr -d ' -' || echo "travel")
  fi
  [ -z "$CATEGORY" ] && CATEGORY="travel"

  TARGET_DIR="blog/content/posts/$CATEGORY"
  log "[Copy] $filename -> $TARGET_DIR/"
  cp "$draft" "$TARGET_DIR/$filename"

  log "[Done] $filename processed (factcheck: $FC_RESULT)"
done

#───────────────────────────────────────────
# Phase 3: Git commit & push
#───────────────────────────────────────────
log ""
log "=== Phase 3: Publishing to GitHub Pages ==="

cd blog
git add content/posts/ static/images/ 2>/dev/null || true
CHANGES=$(git diff --cached --stat)

if [ -n "$CHANGES" ]; then
  log "Committing changes..."
  git commit -m "feat: 8-post batch publish (pipeline auto)

- Queue에서 8개 주제 자동 생성 및 발행
- Premium Workflow 적용 (Enhance + Factcheck + AEO)
- 3인 에이전트 편성 (조회영/김주말/한교양)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" 2>&1 | tee -a "../$LOG"

  git push origin main 2>&1 | tee -a "../$LOG"
  log "GitHub Pages push complete"
else
  log "No changes to commit"
fi
cd ..

#───────────────────────────────────────────
# Phase 4: Moltbook share (staggered)
#───────────────────────────────────────────
log ""
log "=== Phase 4: Moltbook Sharing (staggered) ==="
npm run moltbook:share 2>&1 | tee -a "$LOG" || true

#───────────────────────────────────────────
# Phase 5: Cleanup drafts
#───────────────────────────────────────────
log ""
log "=== Phase 5: Cleanup ==="
PUBLISHED=$(ls drafts/*.md 2>/dev/null | wc -l || echo 0)
if [ "$PUBLISHED" -gt 0 ]; then
  rm -f drafts/*.md
  log "Cleaned $PUBLISHED draft files"
fi

log ""
log "=== Pipeline Complete ==="
log "Processed: $PROCESSED posts"
log "Report: $LOG"
