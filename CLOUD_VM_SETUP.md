# Running PDF Ingestion on Google Cloud VM

This guide covers setting up a Google Cloud VM to run the PDF ingestion pipeline in the background.

---

## 1. Create the VM

### In Google Cloud Console:

1. Go to **Compute Engine** → **VM Instances**
2. Click **Create Instance**

### Configuration:

| Setting      | Value                              |
| ------------ | ---------------------------------- |
| Name         | `pdf-ingester`                     |
| Region       | `us-central1` (or closest to you)  |
| Zone         | `us-central1-a`                    |
| Machine type | `e2-standard-4` (4 vCPU, 16GB RAM) |
| Boot disk    | Ubuntu 22.04 LTS, 50GB SSD         |

### Remove External IP (for security):

1. Click **Advanced options** → **Networking**
2. Under **Network interfaces**, click the default interface
3. Set **External IPv4 address** to **None**
4. Click **Done**
5. Click **Create**

---

## 2. Allow SSH via IAP

Since there's no external IP, we use Identity-Aware Proxy (IAP) for SSH.

1. Go to **VPC Network** → **Firewall**
2. Click **Create Firewall Rule**:
   - **Name**: `allow-iap-ssh`
   - **Direction**: Ingress
   - **Targets**: All instances in the network
   - **Source IP ranges**: `35.235.240.0/20`
   - **Protocols/ports**: TCP `22`
3. Click **Create**

---

## 3. SSH into the VM

From your local terminal:

```bash
gcloud compute ssh pdf-ingester --zone=us-central1-a --tunnel-through-iap
```

---

## 4. Set Up the VM Environment

Run these commands after SSHing in:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install git and tmux
sudo apt install -y git tmux

# Verify installation
node --version
npm --version
```

---

## 5. Clone and Configure Project

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/flashcard-app.git
cd flashcard-app

# Install dependencies
npm install

# Create .env file
nano .env
```

Add these to `.env`:

```
DATABASE_URL=your-neon-database-url
GEMINI_API_KEY=your-gemini-api-key
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## 6. Upload PDF Files

From your **local machine** (not the VM):

```bash
# Upload a single PDF
gcloud compute scp ./books/SK_19_Vol_1.pdf \
  pdf-ingester:~/flashcard-app/books/ \
  --zone=us-central1-a \
  --tunnel-through-iap

# Upload entire books folder
gcloud compute scp --recurse ./books/ \
  pdf-ingester:~/flashcard-app/books/ \
  --zone=us-central1-a \
  --tunnel-through-iap
```

---

## 7. Run Ingestion with tmux

```bash
# Start tmux session
tmux new -s ingestion

# Run the ingestion (adjust parameters as needed)
cd ~/flashcard-app
npm run ingest -- \
  --file books/SK_19_Vol_1.pdf \
  --name "Anatomy Paper 1" \
  --source "SK 19 Vol 1" \
  --start 5 \
  --end 30 \
  --dry-run

# Detach from tmux (process keeps running)
# Press: Ctrl+B, then D
```

---

## 8. tmux Commands

| Command                     | Action                          |
| --------------------------- | ------------------------------- |
| `tmux new -s name`          | Create new session              |
| `Ctrl+B, D`                 | Detach (process keeps running)  |
| `tmux attach -t name`       | Reconnect to session            |
| `tmux ls`                   | List all sessions               |
| `Ctrl+B, [`                 | Scroll mode (press `q` to exit) |
| `tmux kill-session -t name` | Kill a session                  |

---

## 9. Download Results

From your **local machine**:

```bash
# Download all output files
gcloud compute scp --recurse \
  pdf-ingester:~/flashcard-app/output/ \
  ./output/ \
  --zone=us-central1-a \
  --tunnel-through-iap
```

---

## 10. Import to Database

After downloading the JSON files:

```bash
# Import a single file
npm run import -- --file output/Anatomy_Paper_1-1234567890.json

# Import multiple files
for f in output/*.json; do
  npm run import -- --file "$f" --skip-existing
done
```

---

## 11. Stop/Start VM (Save Money!)

```bash
# Stop VM when not in use
gcloud compute instances stop pdf-ingester --zone=us-central1-a

# Start VM when needed
gcloud compute instances start pdf-ingester --zone=us-central1-a
```

---

## Cost Reference

| Resource                      | Cost        |
| ----------------------------- | ----------- |
| e2-standard-4 (4 vCPU, 16GB)  | ~$0.13/hour |
| e2-standard-2 (2 vCPU, 8GB)   | ~$0.07/hour |
| 50GB SSD disk                 | ~$0.04/day  |
| **24 hours on e2-standard-4** | ~$3.20      |

💡 The VM only costs money when running. Stop it when not in use!

---

## CLI Reference

### Ingest Command

```bash
npm run ingest -- \
  --file <path>      # Path to PDF file
  --name <name>      # Paper name
  --source <source>  # Source (e.g., "SK Book Series")
  --start <page>     # Start page (PDF page number)
  --end <page>       # End page (PDF page number)
  --dry-run          # Optional: preview only, save to JSON
  --output <dir>     # Optional: output directory (default: ./output)
```

### Import Command

```bash
npm run import -- \
  --file <path>      # Path to JSON file
  --skip-existing    # Optional: skip if paper exists
```

---

## Troubleshooting

### Can't SSH into VM

```bash
# Make sure you're authenticated
gcloud auth login

# Check if IAP firewall rule exists
gcloud compute firewall-rules list | grep iap
```

### Node.js not found after reconnecting

```bash
# Re-source the profile
source ~/.bashrc
```

### Process killed due to memory

- Use a larger machine type (e.g., `e2-standard-8`)
- Or process fewer pages at a time

---

## Quick Start Checklist

- [ ] Create VM with no external IP
- [ ] Create IAP firewall rule
- [ ] SSH into VM via IAP
- [ ] Install Node.js, git, tmux
- [ ] Clone repo and npm install
- [ ] Create .env with DATABASE_URL and GEMINI_API_KEY
- [ ] Upload PDF files
- [ ] Start tmux session
- [ ] Run ingestion command
- [ ] Detach with Ctrl+B, D
- [ ] Check back later, download results
- [ ] Stop VM when done
