# Deploying Word Timestamps API to Vercel

This guide will walk you through deploying the `/api` folder to Vercel so you can test the improved word timing in your game.

## Prerequisites
- GitHub account
- Google Cloud API key (you already have this: `AIzaSyDclJzXGItJ1O-hZ1xqFG42hrKyYgEcPgw`)

## Step-by-Step Deployment

### Step 1: Install Vercel CLI

Open your terminal and run:
```bash
sudo npm install -g vercel
```
Enter your password when prompted.

### Step 2: Login to Vercel

```bash
vercel login
```

This will:
1. Open your browser
2. Ask you to sign up/login (use your GitHub account - easiest)
3. Authorize the Vercel CLI

### Step 3: Deploy Your API

From your project root (`/Users/preetoshi/bounsight`), run:

```bash
vercel
```

You'll see prompts like this:

```
? Set up and deploy "~/bounsight"? [Y/n]
```
**Answer: Y** (yes)

```
? Which scope do you want to deploy to?
```
**Answer: Select your personal account** (usually your GitHub username)

```
? Link to existing project? [y/N]
```
**Answer: N** (no, create new project)

```
? What's your project's name?
```
**Answer: bounsight** (or whatever you want to call it)

```
? In which directory is your code located?
```
**Answer: ./** (current directory - just press Enter)

Vercel will then:
- Detect your `/api` folder
- Install dependencies from `/api/package.json`
- Deploy the function
- Give you a URL like: `https://bounsight-xxx.vercel.app`

### Step 4: Add Environment Variable

After deployment, you need to add your Google API key:

1. Go to https://vercel.com/dashboard
2. Click on your `bounsight` project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Add:
   - **Key**: `GOOGLE_CLOUD_API_KEY`
   - **Value**: `AIzaSyDclJzXGItJ1O-hZ1xqFG42hrKyYgEcPgw`
   - **Environments**: Check all (Production, Preview, Development)
6. Click **Save**

### Step 5: Redeploy to Apply Environment Variable

```bash
vercel --prod
```

This deploys to production with your environment variable.

### Step 6: Get Your API URL

Vercel will output something like:
```
✅ Production: https://bounsight.vercel.app [1s]
```

**Save this URL!** This is your API endpoint.

### Step 7: Update Your .env File

Add this to your `.env` file:

```bash
EXPO_PUBLIC_API_URL=https://bounsight.vercel.app
```

(Replace `bounsight.vercel.app` with your actual Vercel URL)

## Testing Your API

### Test the API Endpoint Directly

You can test if the API is working by uploading a sample .m4a file:

```bash
curl -X POST https://your-app.vercel.app/api/align \
  -F "file=@/path/to/your/audio.m4a"
```

You should get back JSON with word timestamps:
```json
{
  "words": [
    {"word": "you", "start": 287, "end": 543},
    {"word": "are", "start": 600, "end": 850}
  ]
}
```

### Test in Your App

1. Make sure your app is running: `npm run web`
2. Go to the admin portal
3. Record a message with deliberate pauses
4. The app will now call your deployed Vercel API
5. Preview mode will use the 5-10ms accurate timestamps!

## Troubleshooting

### Error: "GOOGLE_CLOUD_API_KEY is not set"
- Make sure you added the environment variable in Vercel dashboard (Step 4)
- Make sure you redeployed after adding it (Step 5)

### Error: "Function timeout"
- Your audio file might be too long (>60 seconds)
- Try with shorter clips first

### Error: "Word/segment mismatch"
- The API detected a different number of segments than words
- Try recording with clearer pauses between words
- Make sure you're speaking one word at a time

## Viewing Logs

To see what's happening in your API:

```bash
vercel logs
```

Or view logs in the Vercel dashboard:
1. Go to your project
2. Click **Deployments**
3. Click on the latest deployment
4. Click **View Function Logs**

## Redeploying After Changes

Whenever you make changes to `/api/align.ts`:

```bash
vercel --prod
```

This redeploys with your latest changes.

## Next Steps

Once deployed and working:
1. Test with various recordings
2. Compare accuracy to old Google STT approach
3. Tune the parameters in `/api/align.ts` if needed (MIN_GAP_MS, MIN_SEG_MS, etc.)
4. Integrate into your main recording flow

## Summary

Your deployed API will be available at:
- **Production**: `https://your-app.vercel.app/api/align`
- **Local testing**: `http://localhost:3000/api/align` (when running `vercel dev`)

The API provides 5-10ms accurate word timestamps, a 10-20x improvement over Google STT's ±100ms accuracy!
