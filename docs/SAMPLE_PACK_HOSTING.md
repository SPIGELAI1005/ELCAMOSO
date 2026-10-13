# Sample Pack Hosting Guide

This guide explains how to host the ELCAMOSO sample pack WAV files for production use.

## Overview

The sample pack system provides 1,112 audio files (627 MB) across 60 profile folders. These premium WAV files are stored separately from the public repository.

**Key Points:**
- WAV files are 48 kHz, 24-bit mono
- Files must NOT be committed to the public repo
- Production delivery uses signed URLs with checksum verification
- Development can use a local folder

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
| `VITE_SAMPLE_PACKS_ALLOW_UNAPPROVED` | Allow unapproved entries | `0` |

## Production Hosting

### Option 1: CDN with Signed URLs (Recommended)

1. **Upload files to cloud storage:**
   - S3, Cloudflare R2, Google Cloud Storage, or similar
   - Maintain the exact folder structure
   - Set appropriate CORS headers

2. **Configure the app:**
   ```bash
   # .env.production
   VITE_SAMPLE_PACK_BASE_URL=https://your-cdn.example.com/sample-packs
   SOUND_ASSET_SIGNING_SECRET=your-secret-key
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

### Option 2: Self-Hosted with Nginx

1. **Configure Nginx:**
   ```nginx
   server {
     location /sample-packs/ {
       alias /var/www/elcamoso-samples/;
       add_header Access-Control-Allow-Origin "https://www.elcamoso.com";
       add_header Cache-Control "public, max-age=31536000";
       expires 1y;
     }
   }
   ```

2. **Set the base URL:**
   ```bash
   VITE_SAMPLE_PACK_BASE_URL=https://assets.elcamoso.com/sample-packs
   ```

## Compressed Delivery (Optional)

For reduced bandwidth, transcode WAV files to AAC or Opus:

### Using the Transcode Script

```bash
# Install ffmpeg
# macOS: brew install ffmpeg
# Ubuntu: apt-get install ffmpeg

# Run the transcode script
npm run samples:transcode -- --format aac --quality 192
```

The script creates a parallel folder structure with compressed files:

```
sample-packs-aac/
├── american-muscle-v8/
│   ├── idle_loop.m4a
│   └── ...
└── ...
```

### Transcode Formats

| Format | Extension | Typical Size | Quality |
|--------|-----------|--------------|---------|
| AAC | `.m4a` | 10-15% of WAV | Excellent |
| Opus | `.opus` | 8-12% of WAV | Excellent |
| MP3 | `.mp3` | 10-15% of WAV | Good |

### Browser Compatibility

| Format | Chrome | Firefox | Safari | Tesla Browser |
|--------|--------|---------|--------|---------------|
| WAV | ✓ | ✓ | ✓ | ✓ |
| AAC | ✓ | ✓ | ✓ | ✓ |
| Opus | ✓ | ✓ | ✓* | ? |
| MP3 | ✓ | ✓ | ✓ | ✓ |

*Safari 15+

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
