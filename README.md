# EPC Intelligence Platform

Three agents for data centre construction project delivery:

- **Knowledge Copilot** — ask questions about project docs, get cited answers
- **Compliance Check** — flag spec deviations in vendor submittals
- **Schedule Risk** — predict which tasks are going to delay the project

Split into two services: a Python ML service that does the actual scoring
(trained scikit-learn models, not just prompts), and a Node backend that
calls it, then asks an LLM to explain the results in plain language and
suggest what to do about them.

## Why split it like this

A classifier trained on structured data is more consistent and cheaper per
call than asking an LLM to eyeball a number. So the ML service handles delay
probability and deviation severity, and the LLM's job is explanation +
mitigation drafting on top of those scores — not guessing the score itself.
Compliance findings show both the LLM's severity call and the classifier's
independent one side by side, so you can see when they disagree.

## Structure

```
epc-fullstack/
├── docker-compose.yml
├── .env.example
├── ml-service/              Python / FastAPI
│   ├── data_gen.py            synthetic training data
│   ├── train_schedule_model.py
│   ├── train_compliance_model.py
│   ├── app.py                 serves /ml/schedule-risk, /ml/compliance-severity
│   ├── eval/                  held-out test harness (see below)
│   └── models/                 trained .joblib files
├── backend/                 Node / Express
│   ├── llmClient.js            provider switch — gemini / openai / anthropic / huggingface / ollama
│   ├── server.js
│   ├── data/                   sample doc + schedule corpus
│   └── public/                  frontend, plain html/css/js
└── README.md
```

## Running it

### Docker (one command)

```bash
cp .env.example .env    # fill in an API key
docker compose up --build
```
→ http://localhost:3000

### Manually / in VS Code

```bash
# terminal 1
cd ml-service
pip install -r requirements.txt
python train_schedule_model.py
python train_compliance_model.py
uvicorn app:app --port 8000

# terminal 2
cd backend
npm install
cp .env.example .env    # fill in an API key
npm start
```
→ http://localhost:3000

VS Code users: `.vscode/tasks.json` has a "Run Full Stack" task that does all
of the above for you (Cmd/Ctrl+Shift+P → Tasks: Run Task), and `launch.json`
lets you debug `server.js` with breakpoints.

## Switching LLM providers

Set `LLM_PROVIDER` in `backend/.env` to `gemini`, `openai`, `anthropic`,
`huggingface`, or `ollama`, and set the matching config. That's it —
`llmClient.js` picks the right client, nothing else in the app changes.

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
```
or
```
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o
```
or
```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-5
```
or
```
LLM_PROVIDER=huggingface
HF_TOKEN=...
HF_MODEL=meta-llama/Llama-3.1-8B-Instruct
```
or, to run fully local with no API key and no external network call at all:
```
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1
```

### Free options, ranked

| Provider | Cost | JSON reliability | Setup |
|---|---|---|---|
| **Gemini** | Genuinely free tier, no card | Strong — has a native JSON mode, comparable to GPT-4o | Google account only |
| **Hugging Face** | Free token, no card | Weaker — small open models occasionally break strict JSON | Free HF account |
| **Ollama** | Free forever, runs on your machine | Weakest of the four on strict JSON, especially on small models | Needs Ollama installed + a capable machine |
| OpenAI / Anthropic | Paid, pennies per call | Strongest | Needs a card on file |

**Recommendation for a hackathon submission with no budget: use Gemini.** It's
the only fully-free option here with a real structured-output mode, so the
Compliance Check and Schedule Risk agents (which both need strict JSON back)
are the least likely of the free options to throw a parse error mid-demo.

### Getting a free Gemini key

1. Go to https://aistudio.google.com/apikey
2. Sign in with any Google account
3. Click "Create API key" — no payment method required for the free tier
4. Paste it into `backend/.env` as `GEMINI_API_KEY=...`

The free tier has a requests-per-minute rate limit (check current limits on
the same page) — comfortably enough for a demo or a judged walkthrough, but
don't hammer it with a load test.

### Using Ollama

1. Install Ollama: https://ollama.com
2. Pull a model: `ollama pull llama3.1` (or any other model Ollama supports)
3. Ollama runs its own server on `localhost:11434` automatically once installed
4. Set `LLM_PROVIDER=ollama` in `backend/.env`, restart the backend

No API key, no signup, no per-token cost, nothing ever leaves your machine.
Trade-off: response quality and JSON-following reliability (the compliance and
schedule-risk agents both expect strict JSON back) will be noticeably weaker
than Gemini/Claude/GPT-4o, especially on an 8B model. If the compliance/
schedule endpoints start throwing JSON-parse errors, try a larger Ollama model
(`ollama pull llama3.1:70b` if your machine can run it) or switch to Gemini.


## Model evaluation

Training prints train/test split metrics. There's also a separate held-out
harness that's more honest:

```bash
cd ml-service
python -m eval.eval_compliance     # precision/recall/F1 on hand-written test cases
python -m eval.eval_schedule_risk  # checks risk moves the right direction as inputs worsen
```

The compliance classifier calls all 16 hand-written test cases correctly
(different wording than training data) — but n is tiny, so treat that as a
direction, not a guarantee. The schedule model uses monotonic constraints
specifically so it can't predict "less risk" from a worse input.

| Model | Type | Test performance |
|---|---|---|
| Schedule delay risk | HistGradientBoostingClassifier, monotonic constraints | ~80% acc / 0.84 AUC on split; passes monotonicity check |
| Deviation severity | TF-IDF + Logistic Regression | 16/16 on held-out phrasing (was 12/16 before the data-gen fix — see `data_gen.py` template coverage) |

Both are trained on synthetic data — real EPC delay/deviation datasets aren't
public. See "Retraining on real data" below before trusting this beyond a demo.

## API

Node backend:

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/documents` | — | doc list |
| POST | `/api/ask` | `{question}` | `{answer}` with `[DOC-ID]` citations |
| POST | `/api/compliance/check` | `{submittalId}` | `{overall_score, findings[]}` |
| POST | `/api/schedule/analyze` | `{}` | `{risks[], ml_scores[]}` |
| POST | `/api/schedule/score` | feature values | `{delay_probability, risk_level}` — ML only, used by the what-if slider |

ML service:

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | model load status |
| POST | `/ml/schedule-risk` | 6 features | `{delay_probability, risk_level, feature_importances}` |
| POST | `/ml/compliance-severity` | `{text}` | `{predicted_severity, confidence, class_probabilities}` |

## Retraining on real data

Replace the two generator functions in `data_gen.py` with loaders for your
own historical task/procurement outcomes and labeled deviation text, re-run
the `train_*.py` scripts, restart the ML service. Backend/frontend don't
need any changes — they only talk to the `/ml/*` HTTP contract.

## Before deploying for real

- Don't expose the LLM API key to the frontend (already server-side only)
- Add auth — there's none right now
- Add rate limiting on the Node API
- ML service CORS is wide open (`*`) — restrict it
