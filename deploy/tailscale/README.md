# Tailscale networking for GitHub Actions → self-hosted ALO server

> **Why this exists.** The ALO Learning Journey production server is a
> **physical Ubuntu machine behind a NAT router** (hosting.alolabs.net · LAN
> 192.168.0.24 · tailnet **100.85.239.114**). It has **no directly reachable
> public IP**, which is why GitHub Actions failed with
> `ssh: connect to host *** port 22: Connection timed out` (exit 255) before
> any deploy script ran. GitHub-hosted runners reach the server **only over
> the tailnet** — SSH stays closed to the public internet (UFW enabled, no
> router port forwarding).

Target topology:

```
GitHub Actions runner (ephemeral, tag:github-runner)
        │  OAuth client auth → tailnet join
        ▼
   Tailscale coordination (WireGuard, authenticated)
        │  grants: tag:github-runner → tag:alo-hosting :22 ONLY
        ▼
   hosting.alolabs.net · 100.85.239.114 · sshd :22 · UFW (tailscale0 only)
        │  SSH key + pinned host key (strict)
        ▼
   /home/aloedu/projects/learn-aloeducation  (PM2 learn-aloeducation :3017)
```

Everything below is **one-time setup**. It never touches the running
application, databases, UFW, or router.

---

## 1. Server-side prerequisites (already verified 2026-10-13, re-check only)

```bash
# On the server, as aloedu:
tailscale status                 # node 100.85.239.114 must be listed/connected
ss -lntp | grep ':22 '           # sshd listening
sudo ufw status verbose          # must be ACTIVE, with an allow like:
                                 #   Anywhere on tailscale0  ALLOW  22
```

Rules (do not violate these):

* **Do not** open SSH on the public interface, **do not** port-forward 22 on
  the router, **do not** disable UFW.
* Keep **plain OpenSSH (sshd)** answering port 22 for tailnet peers — do
  **not** enable Tailscale SSH (`tailscale up --ssh`) on this host, because CI
  pins the OpenSSH host key (`VPS_SSH_HOST_KEY`) with strict verification.
  If UFW lacks the tailscale0 rule, add exactly:
  `sudo ufw allow in on tailscale0 to any port 22 proto tcp`.
* The app keeps running untouched throughout this setup.

## 2. Tailnet policy — ACL/grants + SSH scope

1. Tailscale admin console → **Settings → Access controls**.
2. **Merge** [`acl.hujson`](./acl.hujson) into your policy (do not blindly
   replace an existing policy). Result must include:
   * `tagOwners` entries for `tag:github-runner` and `tag:alo-hosting`;
   * a grant: `tag:github-runner → tag:alo-hosting`, **port 22 only**.
3. Tag the server node with `tag:alo-hosting` (Machines → the
   100.85.239.114 node → **Edit ACL tags**).
4. Save. This is the minimum-privilege boundary: CI can reach **only** the ALO
   server's SSH port; no other ports, hosts, or subnets.

## 3. OAuth client for CI (scoped, no reusable keys)

Tailscale admin console → **Settings → OAuth clients** → **Generate OAuth
client**:

| Field | Value |
|---|---|
| Description | `alo-learning-gha-deploy` |
| Scopes | **`auth_keys` → Write** — nothing else |
| Tags | **`tag:github-runner`** only (must match the workflow's `tags:` input) |
| Expiry | none / as per your policy (rotate on staff change) |

* The client **secret is shown once** — store it directly into the GitHub
  secret; never paste it in chat or commit it.
* Nodes created with this client are **ephemeral**: the action logs the runner
  out at the end of each job and Tailscale removes the node automatically.
* Rejected alternatives (documented for the record): a long-lived reusable
  **auth key** is broader than needed (key can be replayed); a **self-hosted
  runner** would run inside your network with standing access — evaluated as
  the fallback only (see §7), and must never be installed in the production
  application's security context.

## 4. GitHub secrets and variables

Repository → **Settings → Secrets and variables → Actions**.

**Secrets** (values never printed or logged by the workflow):

| Secret | Value | Notes |
|---|---|---|
| `TAILSCALE_OAUTH_CLIENT_ID` | OAuth client ID from §3 | **required** (new) |
| `TAILSCALE_OAUTH_SECRET` | OAuth client secret from §3 | **required** (new), shown once |
| `SERVER_HOST` | `100.85.239.114` | **preferred name**; tailnet IP or `*.ts.net` name only |
| `VPS_HOST` | *(legacy name for the same value)* | kept for compatibility; workflow uses `SERVER_HOST` **or** `VPS_HOST` |
| `VPS_USER` | `aloedu` | SSH user |
| `VPS_SSH_KEY` | private key of the **dedicated deploy keypair** | public half in `~/.ssh/authorized_keys` of `aloedu` |
| `VPS_SSH_HOST_KEY` | server host-key **line** | see §5 — pinned, strict verification |
| `VPS_PORT` | *(optional)* `22` | default is 22 |

**Variables:**

| Variable | Example | Purpose |
|---|---|---|
| `VPS_APP_DIR` | `/home/aloedu/projects/learn-aloeducation` | release layout base |
| `VPS_PM2_APP` | `learn-aloeducation` | PM2 process name |
| `VPS_APP_PORT` | `3017` | local health port |
| `VPS_DOMAIN` | `https://learn.aloeducation.com` | public health gate (hard gate once DNS resolves) |
| `VPS_DEPLOY_ENABLED` | *(leave **unset**)* | **readiness switch**: deploy job is skipped unless this is exactly `true`. Set it only after every blocker in DEPLOYMENT.md §Deployment blockers is cleared |

## 5. Host-key pinning (`VPS_SSH_HOST_KEY`)

Strict host-key checking **stays ON**. The secret must contain one or more
OpenSSH `known_hosts`-style lines for the server (`host keytype key...`).
On the server:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub   # fingerprint for out-of-band check
cat /etc/ssh/ssh_host_ed25519_key.pub              # e.g. "ssh-ed25519 AAAAC3... hosting.alolabs.net"
# From a machine already on the tailnet (then compare fingerprints):
ssh-keyscan -t ed25519 100.85.239.114
```

Store either the `ssh-keyscan` line or the `.pub` file line as `VPS_SSH_HOST_KEY`.
The workflow pins the **key material** and binds it to the configured deploy
host, so the same secret works for `100.85.239.114` and any tailnet alias.
Hashed (`|1|...`) known_hosts lines are not supported.

## 6. Verifying connectivity (no deploy, nothing changes)

After the secrets exist, produce network evidence **before** enabling deploys:

```bash
# GitHub → Actions → "Deploy to VPS" → Run workflow → branch: your feature
# branch → mode: preflight-only.  This runs ONLY:
#   Tailscale join (ephemeral tag:github-runner) → tailscale ping 100.85.239.114
#   → TCP 22 probe → SSH public-key auth probe (remote command: `true`)
```

Or run the same script from any tailnet machine:

```bash
SERVER_HOST=100.85.239.114 scripts/network-preflight.sh --tcp
SERVER_HOST=100.85.239.114 SERVER_USER=aloedu \
  SSH_KEY_FILE=$HOME/.ssh/deploy_key scripts/network-preflight.sh --tcp --ssh
```

Expected evidence in the job log: `PASS destination … 100.64.0.0/10`,
`PASS TCP 100.85.239.114:22 is open`, `PASS SSH public-key authentication`.
A `FAIL` names the exact layer (tailnet / ACL / UFW / sshd / key).

## 7. Fallback — self-hosted runner (only if the tailnet path cannot work)

If OAuth + tailnet access is impossible in your org, run a **dedicated GitHub
Actions runner on a separate trusted machine** (a spare PC/VM — **never** the
production server, never inside the app's user context):

* dedicated OS user `gha` with **no** access to `aloedu`'s `.env`, storage, or
  MySQL; runner labels e.g. `self-hosted, alo-deploy`;
* keep the same deploy script over SSH to `100.85.239.114` (or LAN
  192.168.0.24) so the runner still has no standing power over production;
* restrict the runner to this repository only.

**Status: evaluated, NOT adopted** — the Tailscale path is strictly preferred
and is what `.github/workflows/deploy.yml` implements.

## 8. Troubleshooting

| Symptom | Likely layer | Fix |
|---|---|---|
| `Missing required GitHub secret(s): TAILSCALE_OAUTH_CLIENT_ID…` | GitHub config | add the §4 secrets |
| action fails at `tailscale up` | OAuth client | client must have `auth_keys:Write` + tag `tag:github-runner`; secret not expired |
| `tailscale ping` times out | ACL/grants or node visibility | grant `tag:github-runner → tag:alo-hosting :22` exists? server tagged `tag:alo-hosting`? wait ~1 min for propagation |
| `FAIL: SERVER_HOST=… is not inside 100.64.0.0/10` | wrong target | set `SERVER_HOST=100.85.239.114` (never a public IP) |
| TCP 22 timeout | UFW / ACL | `sudo ufw status` — need `allow in on tailscale0 to any port 22`; ACL port 22 |
| SSH auth fails, `Host key verification failed` | pinning | `VPS_SSH_HOST_KEY` must match the server's ed25519 host key |
| SSH auth fails, `Permission denied (publickey)` | key | public half of `VPS_SSH_KEY` must be in `aloedu`'s `~/.ssh/authorized_keys` |
| deploy job skipped | readiness gate | `vars.VPS_DEPLOY_ENABLED` unset — intentional until blockers clear |
| deploy job waits forever | approval gate | approve in the `production` environment (Settings → Environments) |
