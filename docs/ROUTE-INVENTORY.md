# Route Inventory (generated 2026-10-13)

## Pages
/
/login

## API routes
/api
/api/activity
/api/agents
/api/ai/local-status
/api/analytics
/api/approvals
/api/audit
/api/auth/[...nextauth]
/api/auth/otp/config
/api/auth/otp/send
/api/backups
/api/calendar
/api/command
/api/comments
/api/companies
/api/content/brief
/api/content/generate
/api/content/package
/api/costs
/api/crm/leads
/api/crm/leads/[id]
/api/crm/leads/[id]/activities
/api/crm/quotes
/api/crm/quotes/[id]
/api/dashboard
/api/diagrams
/api/export
/api/family
/api/family-projects
/api/family-studio
/api/growth
/api/health
/api/ideas
/api/images/generate
/api/inkbox
/api/learning
/api/marketing/email-draft
/api/marketing/humanize
/api/media/audio/[id]
/api/media/scene/[id]
/api/media/subtitle/[id]
/api/media/video/[id]
/api/music/generate
/api/notifications
/api/openapi.json
/api/protective-review
/api/publish
/api/publishing
/api/rag/ingest
/api/rag/search
/api/seed
/api/settings
/api/social
/api/telegram
/api/video/cinematic
/api/video/generate
/api/video/storyboard
/api/voice/generate
/api/voice/script
/api/workforce

## Verification status (2026-10-13, sandbox — not the VPS)
- Tested locally: production compile (`next build` compiled successfully incl. /api/command), 4 node tests, lint, deploy rollback simulation.
- NOT tested here (require VPS/MySQL/secrets, reported UNVERIFIED in PR): auth flows, admin/student pages at runtime, DB queries, uploads, public HTTPS. Do not treat this inventory as runtime verification of those routes.
