# Campaign Preflight — Free Pilot

A browser-local, deterministic comparison of an approved promotional brief with pasted email and landing-page content. Not a production send approval.

## Try it
The static site's `index.html` runs in your browser. Use "Load synthetic example" to see the tool flag explicit offer mismatches.

## What it does
- Compare explicitly supplied discount percentages, promo codes, dates and destination URLs.
- Show blockers, review warnings and unknown checks.
- Download a JSON report locally; no server-side campaign processing.
- Explain five reconstructed public incident scenarios and what the checker missed.

## Limitations
This pilot does not visit links, test codes, execute payments, check sent mail, validate an audience segment, verify legal claims or make AI model calls. It can miss consequential errors. Please redact personal or confidential information before testing.

The five public incident scenarios were reconstructed, not sampled from original campaign assets: one yielded a material blocker, two warnings only, and two were missed. These counts are **not** an accuracy or performance benchmark.

The site has no analytics, accounts or billing and has no established commercial product-market fit.

## Deployment
Deploy the repository root as a static site (no build required). Main site: `/index.html`. The deployment contains only static HTML, CSS and JavaScript.

## Commercial decision (2026-10-22)
Keep this free. Seek real, consented pilot feedback and evidence of a material advantage before pursuing billing. Do not treat a successful static deployment as proof of product demand.

## Privacy
See `privacy.html` before pasting any campaign material.