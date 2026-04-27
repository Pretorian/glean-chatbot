# Indexing Error - Quick Solution

## The Problem

You're getting this error when running `npm run index`:

```
Glean API error 400: View URL ... does not match the URL Regex pattern https://* for the datasource.
```

## Why This Happens

Your datasource `interviewds4` has **strict URL validation** configured. It requires `viewURL` to match a specific pattern, but that pattern hasn't been configured yet.

## Solution Options

### Option 1: Configure Your Datasource (Best Solution)

**You need to ask your Glean administrator to configure the URL pattern for `interviewds4`.**

Tell them to:
1. Open Glean admin console
2. Go to Datasources → `interviewds4`
3. Configure "Allowed URL Pattern" to: `https://example.com/*`

OR ask them which URL pattern is already configured, and update the code to use that pattern.

### Option 2: Use a Different Datasource

If you have access to other datasources (`interviewds`, `interviewds2`, `interviewds3`, etc.), try switching:

```bash
# Edit .env file
nano .env

# Change this line:
GLEAN_DATASOURCE=interviewds  # instead of interviewds4
```

Then try indexing again:
```bash
npm run index
```

### Option 3: Test Without Indexing (Temporary)

If you just want to see the app work, you can skip indexing and test with any existing documents in the datasource:

```bash
# Skip indexing, just run the app
npm run dev

# Open http://localhost:5173
# Try asking general questions
```

## What to Tell Your Glean Admin

Copy/paste this to your Glean administrator:

---

**Subject: Configure URL Pattern for Datasource `interviewds4`**

Hi,

I'm setting up a RAG chatbot prototype using the Glean APIs. I need the URL pattern configured for datasource `interviewds4` on instance `support-lab-be.glean.com`.

**Request:**
- Datasource: `interviewds4`
- Allowed URL Pattern: `https://example.com/*`
- Purpose: Prototype/testing with local markdown files

Alternatively, please let me know which datasource is already configured for URL pattern testing, or what URL pattern `interviewds4` is configured to accept.

Thank you!

---

## More Details

See **[INDEXING_ISSUE.md](INDEXING_ISSUE.md)** for:
- Complete technical explanation
- All URLs we tried
- Why each was rejected
- Verification steps once configured

## Once It's Fixed

After the datasource is configured, run:

```bash
npm run index
# Wait 90 seconds
npm run dev
# Open http://localhost:5173
```

## Questions?

Check these docs:
- [INDEXING_ISSUE.md](INDEXING_ISSUE.md) - Technical details
- [WALKTHROUGH.md](WALKTHROUGH.md) - General setup
- [START_HERE.md](START_HERE.md) - Navigation

---

**Status:** Waiting for datasource `interviewds4` URL pattern configuration.
