# Indexing Issue - viewURL Pattern Validation

> Note: `npm run test:datasources` now reports accurate per-datasource verdicts. A prior bug caused it to send the env-configured datasource in the request payload while setting a different `document.datasource` on each loop iteration, producing false-negative `400` errors that masked which datasources actually accept which URL patterns.

## Problem

When running `npm run index`, you may encounter this error:

```
Glean API error 400: View URL ... does not match the URL Regex pattern https://* for the datasource.
```

## Root Cause

The datasource (`interviewds4` in your case) has **strict URL pattern validation** configured. The Glean Indexing API requires:

1. **viewURL is mandatory** - cannot be omitted
2. **viewURL must match the datasource's configured URL pattern** - not just any https:// URL

This is a datasource configuration issue that needs to be resolved by a Glean administrator.

## Solutions

### Option 1: Configure the Datasource URL Pattern (Recommended)

Contact your Glean administrator or support to configure the URL pattern for datasource `interviewds4` to accept URLs like:

```
https://example.com/*
```

Or any specific pattern that matches your use case.

**For Glean Admins:**
1. Log into Glean admin console
2. Navigate to Datasources → interviewds4
3. Configure "Allowed URL Pattern" to accept your desired URLs
4. Common patterns:
   - `https://example.com/*` - Allow any URL from example.com
   - `https://*.example.com/*` - Allow any subdomain
   - `https://*` - Allow any HTTPS URL (not recommended for production)

### Option 2: Use a Different Datasource

If you have access to multiple datasources (interviewds, interviewds2, etc.), try using one that's already configured:

```bash
# Edit .env
GLEAN_DATASOURCE=interviewds  # Try interviewds instead of interviewds4
```

Then run:
```bash
npm run index
```

### Option 3: Temporary Workaround (For Testing Only)

If you just need to test the RAG functionality without indexing, you can:

1. Skip indexing and use pre-indexed documents (if any exist in the datasource)
2. Run `npm run test` to verify API connectivity
3. Test the chatbot with questions about existing documents

```bash
# Skip indexing, just start the app
npm run dev

# Open http://localhost:5173
# Try asking general questions to test the flow
```

## Current Configuration

Based on your `.env`:
- **Datasource**: `interviewds4`
- **Instance**: `support-lab-be.glean.com`

## Technical Details

### What We Tried

We attempted various URL formats, all rejected:

```
❌ file:///path/to/file.md                                    → Rejected (not HTTPS)
❌ https://support-lab-be.glean.com/search?...                → Rejected (doesn't match pattern)
❌ https://support-lab-be.glean.com/app/document/...          → Rejected (doesn't match pattern)
❌ https://example.com/docs/...                               → Rejected (doesn't match pattern)
❌ (omitted)                                                   → Rejected (viewURL required)
```

### Why This Happens

Glean datasources can be configured with strict URL patterns for security and validation purposes. This ensures that indexed documents only link to approved domains/patterns. This is a security feature, not a bug.

### Error Messages Explained

```
"View URL ... does not match the URL Regex pattern https://* for the datasource."
```

This error message is misleading - `https://*` doesn't mean "any HTTPS URL". It means the datasource has a specific regex pattern configured (which might be `https://specific-domain.com/*` or similar).

```
"viewUrl cannot be empty."
```

This confirms that viewURL is a required field and cannot be omitted.

## Next Steps

1. **Contact Glean Support** or your administrator to configure the URL pattern for `interviewds4`

2. **Provide them with this information:**
   - Datasource: `interviewds4`
   - Instance: `support-lab-be.glean.com`
   - Requested pattern: `https://example.com/*` (or your preferred pattern)
   - Use case: Prototype/testing RAG chatbot with local markdown files

3. **Alternative:** Ask which datasource is already configured and available for use

4. **Temporary:** Use the app without indexing new documents if the datasource already has content

## Verification

Once the datasource URL pattern is configured, verify with:

```bash
# Should succeed
npm run index

# Expected output:
# {"message":"indexing_start","count":1,"datasource":"interviewds4"}
# [INFO] {"message":"glean_api_call","client":"indexing","op":"index_documents","status":200,...}
# {"message":"indexing_complete","count":1,...}
# Indexed 1 documents into interviewds4.
```

## Questions?

- Check WALKTHROUGH.md for general setup issues
- Check TESTING.md for verification steps
- Contact Glean support for datasource configuration

---

**Status:** Awaiting datasource URL pattern configuration for `interviewds4`
