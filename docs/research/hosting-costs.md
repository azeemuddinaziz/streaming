# Hosting options and costs for StreamSouk (staging, then public RC)

Research date: 2026-10-11. Every figure below was read from the provider's own page on that date unless marked **UNCONFIRMED**. Estimates (marked **EST**) are mine, not the providers'.

## 1. Summary and recommendation

**What has to run**: API (Express, :3000), worker (pg-boss + ffmpeg/ffprobe, CPU and RAM heavy), tusd (Go binary, hooks to the API at localhost), web (Next.js SSR, :3001), Postgres, S3 for bytes. API and tusd must share a host (localhost hooks), and ffmpeg wants real RAM, so the natural fit is **one small VM running all four processes plus Postgres**, not a PaaS with one service per process.

**Recommendation**

| Role | Pick | Monthly cost |
|---|---|---|
| Near-zero-cost pick (private staging) | **Oracle Cloud Always Free, one Ampere A1 VM (2 OCPU / 12 GB)** running API, worker, tusd, web and Postgres under Docker Compose or systemd with Caddy for TLS on `app`/`api`/`upload` | $0 compute, plus about $1 for S3 |
| Fallback, and the pick for the public RC | **Hetzner Cloud CX23** (2 vCPU / 4 GB / 40 GB, Germany or Finland) or CX33 (4 vCPU / 8 GB) for transcode headroom | about EUR 6 (about $7) for CX23, about EUR 9 (about $10) for CX33, both including IPv4 |
| Bytes and playback | **AWS S3** (as now), optionally CloudFront in front for the RC | about $1 to $3 at 50 videos and 1000 views |

Why Oracle first: it is the only option here with a genuinely free machine big enough for ffmpeg. Why not rely on it: Oracle may reclaim idle Always Free instances (see section 3.1), capacity and signup can fail, and nothing in the primary docs promises you will get an A1 shape. Hetzner costs about $7 a month with no sleep, no reclaim and 20 TB of traffic, so it is the safe fallback and the better home for something you show to the public.

**What to avoid**

- **Render free tier**: no free background workers (the worker cannot run), web services sleep after 15 minutes, and free Postgres is deleted after 30 days plus 14 days grace.
- **Neon free for this workload**: compute suspends after 5 minutes idle and the free allowance is 100 CU-hours per project; a pg-boss worker that polls keeps compute awake (a 0.25 CU compute running all month is about 182 CU-hours, **EST**). Use Supabase free or a Postgres on the VM instead.
- **Vercel Hobby for the public RC** if anyone involved could earn money from it: Hobby is non-commercial only. It also covers only the web app, so it does not solve the other three processes.
- **Putting free-plan Cloudflare CDN in front of S3 for video**: Cloudflare's terms let it restrict video served through the CDN without a paid service.
- **Fly.io or Railway if the budget is truly near zero**: neither has a free allowance for this, and four always-on processes plus an ffmpeg worker comes to roughly $15 to $30 a month on either.
- **Hetzner US locations**: CPX11 is EUR 17.49 there versus EUR 5.49 for CX23 in Germany or Finland.

## 2. Comparison table

| Provider | Free allowance | Fits worker + ffmpeg? | Fits tusd (co-located with API)? | Idle / sleep | Cost: staging | Cost: small RC |
|---|---|---|---|---|---|---|
| Oracle Always Free | 1,500 OCPU-h and 9,000 GB-h/month of A1 (2 OCPU, 12 GB), 200 GB block storage, 10 TB egress | Yes, if you get the A1 | Yes, same VM | May be reclaimed if idle 7 days (see 3.1) | $0 | $0 |
| Hetzner Cloud | None (paid from about EUR 6/month) | Yes (CX23 4 GB is the floor, CX33 8 GB comfortable) | Yes, same VM | None | about EUR 6 | about EUR 6 to 9 |
| Fly.io | None for new orgs (trial of 2 machine-hours or 7 days) | Only on a larger machine (shared-cpu-2x 2 GB is $13.39) | Separate machines; needs hook URL changed or both in one container | Always-on needs paid machines | about $25 (**EST**) | about $25 to 35 |
| Render | Free web service only (sleeps, 750 h) | Worker needs paid instance, $25 for 2 GB | Separate services, hook URL changed | Free web sleeps after 15 min | about $52 (**EST**) | about $52 |
| Railway | Trial $5 one-time for 30 days, max 2 vCPU / 1 GB per service | Hobby plan yes; trial no | Separate services (or one container) | Usage billed per second | about $5 to 15 (**EST**) | about $15 to 25 (**EST**) |
| Vercel Hobby | 100 GB transfer, 1M invocations | No (web only) | No | none | $0 for web only | $0 only if non-commercial |
| Neon free | 1 GB/project, 100 CU-h, suspends at 5 min | n/a (database) | n/a | Suspends | $0 but conflicts with pg-boss polling | Launch plan usage-based |
| Supabase free | 500 MB, 5 GB egress, 2 projects | n/a (database) | n/a | Pauses after 1 week inactivity | $0 | Pro from $25 |
| Cloudflare | R2 10 GB free, free egress; Workers 100k req/day, 10 ms CPU | No | No | none | R2 about $0 | R2 under $1 |
| AWS S3 + CloudFront | S3: up to $200 credits for 6 months; 100 GB/month transfer free; CloudFront 1 TB/month free | n/a (storage/CDN) | n/a | n/a | under $1 | about $1 to 3 |

## 3. Per-provider notes

### 3.1 Oracle Cloud Always Free

- Allowance: first 1,500 OCPU-hours and 9,000 GB-hours per month of `VM.Standard.A1.Flex`, equal to 2 OCPUs and 12 GB, as one instance or two 1-OCPU instances; home region only. 200 GB combined boot and block storage, 5 backups, 10 TB outbound per month. Source: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm (read 2026-10-11). Note: older material quotes 4 OCPU / 24 GB; the current page says 2 / 12, so do not plan around the bigger figure.
- Idle reclaim: an instance is idle if over 7 days the 95th-percentile CPU is below 20%, network below 20%, and (A1 only) memory below 20%. Same page. A staging box that sits mostly unused will meet that definition; transcodes are bursts and may not lift the 95th percentile. Mitigations: keep Postgres and a few services resident so memory exceeds 20% of 12 GB (about 2.4 GB), and run a light periodic load. Whether upgrading to Pay As You Go removes reclaim is **UNCONFIRMED**: the free-tier overview (https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm, read 2026-10-11) says only that you keep all resources after upgrading and that the Pay As You Go account is available with no commitment; it does not discuss idle reclaim.
- Signup: most users need a mobile number and a credit card; the card is not charged unless you upgrade; choose the home region carefully because Always Free compute can be created only in it. Same overview page. Signup rejections and "out of host capacity" errors for A1 are widely reported by users but are **UNCONFIRMED** from a primary source (the FAQ page returned 403 to the fetch tool).
- Arm: tusd, Node, Postgres and ffmpeg all have arm64 builds, but the repo's `pnpm tusd` script needs an arm64 tusd binary and the sharp native module needs arm64 (not verified here).
- Block storage default boot volume 50 GB counts against the 200 GB. Egress of 10 TB is irrelevant if bytes live in S3.

### 3.2 Hetzner Cloud

- Current prices (effective 2026-06-15, excl. VAT and IPv4): CX23 2 vCPU / 4 GB / 40 GB EUR 5.49 ($6.49); CAX11 (Arm) 2 vCPU / 4 GB EUR 5.99 ($6.99); CX33 4 vCPU / 8 GB EUR 8.49 ($9.99); CAX21 4 vCPU / 8 GB EUR 10.49 ($12.49); CPX22 EUR 19.49 (Germany/Finland); CPX11 EUR 17.49 (USA). Source: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/ (read 2026-10-11). The June 2026 increase was large (CPX22 from EUR 7.99 to 19.49), so older blog numbers are wrong.
- IPv4 is EUR 0.50 per month extra; IPv6 is free. Source: https://docs.hetzner.com/cloud/servers/overview/ (read 2026-10-11).
- Traffic: 20 TB included on CX/CAX and on CPX in EU locations; overage EUR 1 per TB ($1.20), only outgoing counted. Source: https://docs.hetzner.com/robot/general/traffic/ (read 2026-10-11).
- Specs page https://www.hetzner.com/cloud/cost-optimized/ (read 2026-10-11) listed CX23/CX33/CX43/CX53 and CAX11 to CAX41 all as "Unavailable" on that day, and the Regular Performance page showed Create buttons as unavailable. Whether that is a real stock-out or a rendering artifact is **UNCONFIRMED**; check the console before committing. This is the main risk to the fallback.
- Terms: no crypto mining, no spam, no illegal content; a video platform needs an abuse and takedown process (https://www.hetzner.com/legal/terms-and-conditions/, read 2026-10-11).
- Backups option price not confirmed; plan pg_dump to S3 instead (free-ish).

### 3.3 Fly.io

- No free tier: "New organizations don't have a free tier or a monthly free usage allowance." Trial is 2 hours of machine runtime or 7 days. Source: https://docs.fly.io/about/pricing (read 2026-10-11).
- Machines (iad/ewr, 30 days): shared-cpu-1x 256 MB $2.19, 512 MB $3.69, 1 GB $6.70; shared-cpu-2x 2 GB $13.39; performance-1x 2 GB $33.00. Volumes $0.15/GB-month; egress $0.02/GB in NA/EU; inbound free. Same page.
- Fit: each process becomes its own machine. tusd to API hooks would need a private-network address instead of localhost (the hook URL is set in `server/scripts/tusd.sh`), or tusd and API in one container. Managed Postgres pricing was not fetched (**UNCONFIRMED**); use Supabase or a self-run Postgres machine plus a volume.
- Estimate (**EST**): API 512 MB $3.69 + web 1 GB $6.70 + tusd 256 MB $2.19 + worker 2 GB $13.39 = about $26 plus Postgres.

### 3.4 Render

- Free web service: spins down after 15 minutes without inbound traffic, about a minute to wake, 750 instance hours per workspace per month; free Postgres expires 30 days after creation with a 14-day grace period; free Key Value is in-memory only; other service types, including background workers, have no free instance. Source: https://render.com/docs/free (read 2026-10-11).
- Paid: Starter $7/month (0.5 CPU, 512 MB), 1 CPU / 2 GB $25, 2 CPU / 4 GB $85; Postgres $6 (256 MB, 100 connections, 1 GB storage included), $19 (1 GB); Hobby workspace $0 plus compute, 5 GB bandwidth then $0.15/GB; disks $0.25/GB. Source: https://render.com/pricing (read 2026-10-11). Background workers are listed on the same instance table (exact worker prices per type not shown separately; assuming same table is **EST**).
- Estimate (**EST**): API $7 + tusd $7 + web $7 + worker $25 (512 MB is too small for 1080p ffmpeg) + Postgres $6 = about $52.

### 3.5 Railway

- Trial $0 with $5 one-time credit that expires in 30 days, max 2 vCPU / 1 GB per service; Hobby $5/month with $5 credit; Pro $20. Usage per second: $20 per vCPU-month, $10 per GB-month, volumes $0.15 per GB-month, egress $0.05/GB, object storage $0.015/GB-month with free egress. Source: https://railway.com/pricing (read 2026-10-11).
- Billing is by actual use, so an idle API costs little; an ffmpeg worker holding 2 GB for an hour is cheap. Estimate (**EST**): $5 to 15 staging, $15 to 25 RC including Postgres as a service with a volume.
- Not a free option: the Trial plan cannot give the worker 2 GB. Hobby $5 minimum applies.

### 3.6 Vercel Hobby

- Included on Hobby: 100 GB Fast Data Transfer, 1,000,000 function invocations, 10 GB Fast Origin Transfer, 4 active CPU hours, 360 GB-hours provisioned memory. Hobby teams are "restricted to non-commercial personal use only"; commercial use is any deployment used for financial gain of anyone involved, including payment, ads, affiliate links; donations are not commercial. Source: https://vercel.com/docs/limits/fair-use-guidelines (read 2026-10-11, page updated 2026-09-14).
- General limits: 100 deployments/day, 120 s proxied request timeout, 45 min build. Source: https://vercel.com/docs/limits (read 2026-10-11).
- Fit: web app only. Cookie-sharing across `app`/`api`/`upload` still works with a custom domain, but the API, tusd and worker still need a host, so it adds a second platform without removing the VM. Not worth it for a private staging; acceptable for a hobby RC only if no one earns money from it. Pro price not fetched (**UNCONFIRMED**).

### 3.7 Neon and Supabase free Postgres

- Neon Free: 1 GB per project (20 GB across projects), 100 CU-hours per project, autoscale up to 2 CU, compute suspends after 5 minutes idle and this cannot be turned off, pooling included. Source: https://neon.com/pricing (read 2026-10-11). Launch plan: no base fee, $0.106 per CU-hour, $0.35/GB-month.
- Neon connections: max_connections is 104 at 0.25 CU (97 usable), 209 at 0.5 CU; the pooler is PgBouncer in transaction mode, which does not support session-level advisory locks, LISTEN/NOTIFY or session settings; migrations must use the direct (non-pooled) host. Source: https://neon.com/docs/connect/connection-pooling (read 2026-10-11).
- Implication for pg-boss and Prisma: give pg-boss the direct connection string (it relies on its own locking and polling; I did not verify its lock type in this session, **UNCONFIRMED**) and use the pooled string only for Prisma. The 5-minute suspend plus pg-boss's polling means either compute never sleeps (burning the 100 CU-hours) or cold starts delay jobs.
- Supabase Free: 500 MB database, 5 GB egress plus 5 GB cached egress, 2 active projects, paused after 1 week of inactivity; Pro from $25/month. Source: https://supabase.com/pricing (read 2026-10-11).
- Supabase connections: direct (`db.<ref>.supabase.co:5432`) supports prepared statements and session state but is IPv6-only on Free; session pooler (port 5432) is IPv4 and keeps session state; transaction pooler (6543) loses session state and needs `pgbouncer=true` for Prisma. Source: https://supabase.com/docs/guides/database/connecting-to-postgres (read 2026-10-11). Per-plan connection counts were on a separate page not fetched (**UNCONFIRMED**).
- Better than both for this setup: Postgres on the same VM (zero cost, no network hop, no pooler). Back it up with `pg_dump` to S3.

### 3.8 Cloudflare

- R2: 10 GB-month free (Standard), 1M Class A and 10M Class B operations free, storage $0.015/GB-month, **no egress fee**. Source: https://developers.cloudflare.com/r2/pricing/ (read 2026-10-11).
- R2 presigned URLs work only against the S3 API endpoint (`<ACCOUNT_ID>.r2.cloudflarestorage.com`), not custom domains; GET/HEAD/PUT/DELETE supported, POST form uploads not. Source: https://developers.cloudflare.com/r2/api/s3/presigned-urls/ (read 2026-10-11). That fits the repo's `Storage.signedUrl` model, and tusd's S3 backend can target any S3-compatible endpoint (not verified here), so R2 is a real way to remove egress cost.
- CDN terms: on Free, Pro and Business plans, serving video or a disproportionate share of large files through the CDN requires a paid service such as the Developer Platform, Images or Stream, and Cloudflare may restrict use if it suspects otherwise. Source: https://www.cloudflare.com/service-specific-terms-application-services/ (read 2026-10-11). So orange-cloud proxying S3 video segments on a free zone is not safe; R2 accessed through the S3 API (or a Worker) is the supported path.
- Cloudflare in front of S3 does not remove S3's own transfer-out charge: the S3 pricing page names only transfers to CloudFront as free (https://aws.amazon.com/s3/pricing/, read 2026-10-11). Any Bandwidth Alliance style waiver for AWS is **UNCONFIRMED** and I would not rely on it.
- Pages/Workers for the web app: Workers Free is 100,000 requests/day and 10 ms CPU per invocation, 128 MB memory. Source: https://developers.cloudflare.com/workers/platform/limits/ (read 2026-10-11). A Next.js SSR app calling an external API may exceed 10 ms CPU on heavier routes (**EST**, not tested); Pages itself has 25 MiB per asset and 500 builds/month (https://developers.cloudflare.com/pages/platform/limits/, read 2026-10-11). Next.js on Pages/Workers support was not covered by the pages I fetched (**UNCONFIRMED**). Not worth the migration risk when the VM already runs Next.

## 4. AWS S3 and CDN egress

- New-account Free Tier (accounts created on or after 2025-07-15): up to $200 in credits ($100 at sign-up, $20 for each of five activities), free account plan expires after 6 months or when credits run out; unused credits usable up to 12 months if you upgrade; after expiry there is a 90-day window to reopen by upgrading; "30+ always free services". Sources: https://aws.amazon.com/free/ and https://aws.amazon.com/blogs/aws/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/ (read 2026-10-11). The old always-free "5 GB S3 for 12 months" model applies only to accounts older than 2025-07-15; I did not find a separate S3 allowance on the new pages.
- S3 Standard storage, us-east-1: $0.023/GB-month (first 50 TB); PUT/POST/LIST $0.005 per 1,000; GET $0.0004 per 1,000. Source: AWS price list file https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/us-east-1/index.json (publication date 2026-09-28, read 2026-10-11).
- Data transfer out to the internet: first 100 GB per month free, aggregated across all services and regions (https://aws.amazon.com/s3/pricing/, read 2026-10-11); then $0.09/GB for the next up to 10 TB, $0.085 to 50 TB, $0.07 to 150 TB, $0.05 beyond (AWS price list https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/us-east-1/index.json, publication 2026-09-16, read 2026-10-11). Data in is free.
- CloudFront: always free each month 1 TB data transfer out, 10 million HTTP/HTTPS requests; beyond that $0.085/GB (US/EU, next 9 TB) and $0.01 per 10,000 HTTPS requests (US) / $0.012 (Europe); origin fetches from S3 and other AWS origins are free. Source: https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/ (read 2026-10-11). The newer flat-rate plans (Free $0 with 1M requests and 100 GB, Pro $15) are listed at https://aws.amazon.com/cloudfront/pricing/ (read 2026-10-11); the pay-as-you-go always-free tier is the larger one and is what matters here.
- Presigned URLs through CloudFront: S3 presigned URLs are signed for the S3 host, and CloudFront's documented private-content mechanisms are its own signed URLs/cookies (RSA 2048 or ECDSA 256 key group) with an Origin Access Control on the bucket (https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html and https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html, read 2026-10-11). I found no documentation saying an S3 presigned URL can be passed through CloudFront unchanged, so treat that as **UNCONFIRMED** and expect a small code change: `Storage.signedUrl` in `server/src/lib/storage.ts` would issue CloudFront signed URLs (or one signed cookie for the whole `videos/<id>/` prefix, which suits HLS because it fetches many files) instead of S3 presigned URLs. Also note CloudFront does not require a signature on `OPTIONS` requests, so CORS preflight works.
- Cost shape: S3 alone is free for the first 100 GB of egress per month, which already covers the RC estimate below. CloudFront matters only if egress grows past that or you want caching at the edge; its 1 TB free is a larger cushion than S3's 100 GB.

## 5. Monthly cost estimates

Assumptions (**EST**, mine): 50 videos x 5 minutes, 1080p source about 300 MB each, ladder 1080/720/480/360 about 10 Mbit/s total, so about 375 MB renditions + 300 MB original, about 0.7 GB per video, about 35 GB stored. 1,000 views/month, each watched fully at 720p (about 2.8 Mbit/s, about 105 MB), about 105 GB egress. 6-second segments mean about 50 segment GETs per rendition per view, about 60,000 GETs total.

| Item | Staging (few videos, handful of views) | Small RC |
|---|---|---|
| S3 storage ($0.023/GB) | under $0.10 | about $0.80 |
| S3 egress (100 GB free, then $0.09/GB) | $0 | about $0.45 (5 GB over) |
| S3 requests | negligible | under $0.10 |
| **AWS subtotal** | under $0.25 (covered by credits for 6 months) | about $1.35 (covered by credits for 6 months) |

| Hosting option | Staging | Small RC | Notes |
|---|---|---|---|
| Oracle A1 (all-in-one VM) | $0 + AWS | $0 + AWS = about $1.35 | Reclaim and capacity risk |
| Hetzner CX23 (all-in-one VM) | about EUR 6 (about $7) + AWS | about EUR 6 to 9 + about $1.35 | CX33 if transcodes are slow; availability flag in 3.2 |
| Fly.io (4 machines + external Postgres) | about $26 + AWS | about $26 to 35 | No free allowance |
| Render (4 paid services + Postgres) | about $52 | about $52 | Free tier unusable here |
| Railway Hobby | about $5 to 15 | about $15 to 25 | Usage-based |
| Vercel Hobby (web) + VM for the rest | $0 extra | $0 extra if non-commercial | Does not remove the VM |
| R2 instead of S3 | about $0 | about $0.5 | 35 GB at $0.015 = about $0.53, egress free |

CPU sanity check (**EST**, not measured): transcoding a 5-minute 1080p source to four renditions with x264 on 2 vCPU takes several times real time, so the 10-minute per-command timeout in `src/lib/ffmpeg.ts` is the thing to test first on a 2-core machine. A 4-core machine (CX33) halves that.

## 6. Risks and open questions

1. **Hetzner availability**: product pages showed CX/CAX/CPX plans as unavailable on 2026-10-11. Verify in the console before planning around it.
2. **Oracle reclaim and capacity**: reclaim is documented; whether Pay As You Go upgrade protects Always Free resources is unconfirmed; A1 "out of capacity" and signup rejections are unconfirmed from primary sources. Have the Hetzner path ready.
3. **Single VM = single point of failure**: no HA, and a runaway ffmpeg can starve the API and Postgres. Mitigate with a cgroup/Docker CPU and memory limit on the worker and `nice` for ffmpeg, plus nightly `pg_dump` to S3.
4. **Reachability of tusd and API**: both need public HTTPS on `upload.` and `api.` subdomains; tusd must allow `WEB_ORIGIN` only (already scripted). CORS, `COOKIE_DOMAIN` and `NEXT_PUBLIC_API_URL` must be set per environment.
5. **S3 CORS** for HLS segments from `WEB_ORIGIN` (already a repo requirement).
6. **Credits expire**: the AWS free plan ends after 6 months or when credits run out; upgrade to a paid plan to keep the account. Set an AWS Budgets alert (it is also one of the $20 credit activities).
7. **Video egress is unbounded by the API**: no rate limiting is in place (noted in CLAUDE.md), so a scraper pulling segments could exceed the 100 GB free S3 egress; CloudFront's 1 TB free or R2's free egress limits the downside.
8. **Content and abuse**: Hetzner, Oracle and Cloudflare all prohibit illegal or infringing content; a public upload site needs a takedown path before the RC.
9. **pg-boss on a pooled or suspending database** (Neon): unverified lock behaviour and polling vs suspend; avoid by using Postgres on the VM or Supabase session mode/direct.
10. **Not fetched**: Fly Managed Postgres pricing, Vercel Pro price, Supabase per-plan connection limits, Hetzner Backups price, Railway/Render worker idle behaviour. Do not quote numbers for these.
11. **Arm builds** (Oracle A1, Hetzner CAX): confirm arm64 binaries for tusd, ffmpeg and sharp; the CX line is x86 and avoids this.
