# Sample Pack Hosting Guide

This guide explains how to host the ELCAMOSO sample pack audio files for production use.

## Overview

The sample pack system provides 1,112+ audio files across 60 profile folders. These premium audio files are stored separately from the public repository.

**Key Points:**
- Original WAV files: 48 kHz, 24-bit mono (627 MB total)
- AAC delivery files: 128 kbps M4A with gapless loop metadata (~60 MB)
- Files must NOT be committed to the public repo
- Production delivery uses checksum verification
- Development can use a local folder or same-origin path

## Delivery Formats

| Format | Extension | Size | Use Case |
|--------|-----------|------|----------|
| WAV | `.wav` | 627 MB | Development, max quality |
| AAC | `.m4a` | ~60 MB | **Production (default)** |

The AAC format is the default for production. It provides excellent quality at ~10% of WAV size, with gapless loop handling built into the manifests.

## File Structure

```
sample-packs/
├── index.json                    # Package index
├── american-muscle-v8/
│   ├── manifest.json            # Profile manifest
│   ├── idle_loop.wav
│   ├── onload_high_1500rpm.wav
│   └── ...
├── horse-gallop/
│   ├── manifest.json
│   ├── idle_standstill.wav
│   └── ...
└── [57 more profile folders]
```

## Development Setup

### Local Testing

1. **Create a local sample packs folder:**
   ```bash
   mkdir -p public/sample-packs
   ```

2. **Copy WAV files to the local folder:**
   ```bash
   cp -r /path/to/sample-packs/* public/sample-packs/
   ```

3. **Enable unapproved packs for testing:**
   - Open browser dev tools
   - Run: `localStorage.setItem("elcamoso.samplePacks.allowUnapproved", "true")`
   - Or set `VITE_SAMPLE_PACKS_ALLOW_UNAPPROVED=1` in `.env.local`

4. **Verify loading:**
   - Open `/debug` route (dev only)
   - Use the Sample Pack Diagnostics overlay

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SAMPLE_PACK_BASE_URL` | Base URL for sample assets | `/sample-packs` |
| `VITE_SAMPLE_PACK_FORMAT` | Delivery format: `m4a` or `wav` | `m4a` |
| `VITE_SAMPLE_PACKS_ALLOW_UNAPPROVED` | Allow unapproved entries | `0` |

## Production Hosting

### Option 1: Vercel Blob (Recommended)

ELCAMOSO sample packs are hosted on Vercel Blob storage. This provides:
- Global edge caching
- Automatic CORS for Vercel-deployed apps
- Immutable URLs for long-term caching

**Configuration:**
```bash
# .env.production
VITE_SAMPLE_PACK_BASE_URL=https://<your-blob-store>.public.blob.vercel-storage.com/sample-packs
VITE_SAMPLE_PACK_FORMAT=m4a
```

**Vercel Blob CORS Notes:**
- Blob stores created via the Vercel dashboard automatically allow CORS from your Vercel deployments
- For custom domains, add them to the Vercel project's domains list
- Files are served with `Cache-Control: public, max-age=31536000, immutable`

**Upload structure:**
```
sample-packs/
├── american-muscle-v8/
│   ├── idle_loop.m4a
│   └── ...
├── horse-gallop/
│   ├── idle_standstill.m4a
│   └── ...
└── [60 profile folders]
```

### Option 2: Same-Origin Path (Simple)

Serve sample packs from the same domain as the app, avoiding CORS entirely.

**Setup with Vercel:**
1. Configure a rewrite in `vercel.json`:
   ```json
   {
     "rewrites": [
       {
         "source": "/sample-packs/:path*",
         "destination": "https://<your-blob-store>.public.blob.vercel-storage.com/sample-packs/:path*"
       }
     ]
   }
   ```

2. Use the relative path:
   ```bash
   VITE_SAMPLE_PACK_BASE_URL=/sample-packs
   ```

**Benefits:**
- No CORS headers needed
- Simpler debugging
- Works with any storage backend

**Setup with static hosting:**
1. Place files in `public/sample-packs/` (for dev) or configure your server to serve from a storage bucket
2. Use the relative path: `VITE_SAMPLE_PACK_BASE_URL=/sample-packs`

### Option 3: External CDN

1. **Upload files to cloud storage:**
   - S3, Cloudflare R2, Google Cloud Storage, or similar
   - Maintain the exact folder structure
   - Set appropriate CORS headers

2. **Configure the app:**
   ```bash
   # .env.production
   VITE_SAMPLE_PACK_BASE_URL=https://your-cdn.example.com/sample-packs
   ```

3. **CORS Configuration:**
   ```json
   {
     "AllowedOrigins": ["https://www.elcamoso.com"],
     "AllowedMethods": ["GET", "HEAD"],
     "AllowedHeaders": ["Range"],
     "MaxAgeSeconds": 3600
   }
   ```

4. **Cache Headers:**
   ```
   Cache-Control: public, max-age=31536000, immutable
   ```

### Option 4: Self-Hosted with Nginx

1. **Configure Nginx:**
   ```nginx
   server {
     location /sample-packs/ {
       alias /var/www/elcamoso-samples/;
       add_header Access-Control-Allow-Origin "https://www.elcamoso.com";
       add_header Cache-Control "public, max-age=31536000, immutable";
     }
   }
   ```

2. **Set the base URL:**
   ```bash
   VITE_SAMPLE_PACK_BASE_URL=https://assets.elcamoso.com/sample-packs
   ```

## AAC Delivery Format

The M4A (AAC-LC) format is the default for production. It provides ~90% size reduction with excellent quality.

### Gapless Loop Handling

AAC encoding adds encoder priming (1024 samples) that can cause clicks at loop points. The delivery manifests handle this automatically:

1. **Loops are pre-padded:** 2048 samples of audio from the end of the loop are prepended, and 2048 samples from the start are appended
2. **Manifest loop points are pre-adjusted:** `loopStartSeconds` and `loopEndSeconds` already account for the padding
3. **Encoder priming detection:** If the browser's decoder doesn't strip encoder priming (buffer is ~1024 samples longer than expected), the loader adds 1024/48000 seconds to loop points
4. **Loop duration is explicit:** `loopEnd = loopStart + sourceSamples/sampleRate`, never derived from `buffer.duration`

### Format Selection

Set the format via environment variable:
```bash
# Use AAC (default)
VITE_SAMPLE_PACK_FORMAT=m4a

# Use WAV (development/max quality)
VITE_SAMPLE_PACK_FORMAT=wav
```

When `m4a` is selected, the loader uses delivery manifests (in `manifests-m4a/`) that have:
- M4A file paths and checksums
- `delivery` block with gapless loop metadata
- Original WAV path/checksum for reference

### Transcode Formats

| Format | Extension | Typical Size | Quality | Gapless Support |
|--------|-----------|--------------|---------|-----------------|
| AAC | `.m4a` | 10-15% of WAV | Excellent | ✓ Built-in |
| Opus | `.opus` | 8-12% of WAV | Excellent | Manual |
| MP3 | `.mp3` | 10-15% of WAV | Good | No |

### Browser Compatibility

| Format | Chrome | Firefox | Safari | Tesla Browser |
|--------|--------|---------|--------|---------------|
| WAV | ✓ | ✓ | ✓ | ✓ |
| AAC | ✓ | ✓ | ✓ | ✓ |
| Opus | ✓ | ✓ | ✓* | ✓ |
| MP3 | ✓ | ✓ | ✓ | ✓ |

*Safari 17+ for WebM/CAF containers

## Approval Gating

The app only loads entries with approval status `approved`. By default, all entries have `unknown` approval.

### Approving Profiles

**Option 1: Profile-level approval (localStorage)**
```javascript
// In browser console
approveProfile("american-muscle-v8");
```

**Option 2: Edit manifest entries**
Change `license.approval` from `"unknown"` to `"approved"` in the manifest JSON.

### Testing Unapproved Packs

For development, enable unapproved packs:
```javascript
setUnapprovedPacksAllowed(true);
```

Or set the environment variable:
```bash
VITE_SAMPLE_PACKS_ALLOW_UNAPPROVED=1
```

## Checksum Verification

Each entry has a `checksumSha256` field. The loader verifies checksums before decoding:

- If checksum matches: Asset is used
- If checksum fails: Asset is rejected, procedural fallback is used
- If checksum is empty: Verification is skipped

## Diagnostics

### Sample Pack Diagnostics Overlay

Available in dev mode, shows:
- Catalog statistics
- Active profile entries
- Approval status
- Buffer cache state

### Debug Commands

```javascript
// Get catalog stats
getCatalogStats()

// Get profile approval status
getProfileApprovalStatus("american-muscle-v8")

// Check cache
getCacheStats()

// Clear cache
clearBufferCache()
```

## Troubleshooting

### Assets Not Loading

1. Check the base URL is correct
2. Verify CORS headers are set
3. Check browser network tab for 404s
4. Verify checksums match

### Checksum Errors

If checksums don't match after transcoding:
1. Re-transcode from original WAVs
2. Update checksums in manifest
3. Or disable checksum verification (not recommended for production)

### Cache Issues

Clear the decoded buffer cache:
```javascript
clearBufferCache();
```

## Tesla Browser Testing Checklist

Before deploying sample packs:

- [ ] Verify WAV decoding works in Tesla browser
- [ ] Test with slow network (3G simulation)
- [ ] Verify crossfades are smooth
- [ ] Check memory usage doesn't exceed limits
- [ ] Test approval gating blocks unapproved entries
- [ ] Verify procedural fallback when samples fail
