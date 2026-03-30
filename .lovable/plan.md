

## Plan: Replace CricketData.org with Roanuz CricketAPI v5

### What changes

Replace the current `cricket-api-sync` edge function (which uses CricketData.org's scorecard-level data and derives ball outcomes) with Roanuz CricketAPI v5, which provides true ball-by-ball data, lineup details, and near-TV-speed updates via WebSocket/push.

### Cost and setup

Roanuz CricketAPI v5 requires a paid plan starting at **₹14,135/month** (Essential). You will need to:
1. Sign up at [console.roanuz.com](https://console.roanuz.com)
2. Create a project and get your **Project Key** and **API Key**
3. Note the IPL 2025 tournament key (typically `ipl_2025`)

Two new secrets will be stored: `ROANUZ_API_KEY` and `ROANUZ_PROJECT_KEY`.

### Architecture