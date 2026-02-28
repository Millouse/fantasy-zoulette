# ⚡ ZouletteGG — LoL Betting Site

A Vue 3 + Firebase betting platform for League of Legends. Users bet **ZouletteCoins** on whether tracked players will win their live games.

## Stack
- **Vue 3** (Composition API) + **Vite 6**
- **Firebase** (Auth + Firestore)
- **Pinia** (state management)
- **Vue Router 4**
- **Riot Games API** (EUW — live game detection)

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Firebase (`src/firebase.js`)
Replace the placeholder config with your Firebase project credentials.
Enable in Firebase Console:
- **Authentication → Email/Password**
- **Firestore Database** (start in test mode)

### 3. Configure the app (`src/config.js`)
```js
export const ADMIN_EMAIL = 'your-admin@email.com'  // your admin account email
export const RIOT_API_KEY = 'RGAPI-xxxx...'         // your Riot API key
```

Get a Riot API key at: https://developer.riotgames.com

### 4. Firestore Security Rules (production)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /bets/{betId} {
      allow read, write: if request.auth != null;
    }
    match /players/{playerId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email == 'YOUR_ADMIN_EMAIL';
    }
  }
}
```

### 5. Run
```bash
npm run dev
```

## How it works

1. **Admin** adds EUW summoner names in `/admin` — their Riot data is fetched automatically
2. **Admin** grants ZouletteCoins to users via the Admin panel
3. **Users** go to `/betting` — cards show which tracked players are **in a live game**
4. Users pick **YES** (will win) or **NO** (will lose), enter a coin amount, and place the bet
5. One bet per player per game is enforced
6. When the game ends, **Admin** goes to `/admin` → Resolve Game, enters the Riot Game ID, and clicks whether the player won or lost
7. Bets are automatically settled: winners get **1.9× their wager** back in ZouletteCoins

## File Structure
```
src/
├── config.js                    # ← Set ADMIN_EMAIL & RIOT_API_KEY here
├── firebase.js                  # Firebase init
├── main.js
├── App.vue                      # Global styles (cyberpunk theme)
├── router/index.js              # Routes + auth guards
├── stores/auth.js               # Pinia auth + coins (real-time)
├── services/
│   ├── riot.js                  # Riot API calls
│   ├── players.js               # Firestore players CRUD
│   └── bets.js                  # Bet placement + resolution
├── components/
│   ├── Navbar.vue
│   └── PlayerBetCard.vue        # Live bet card UI
└── views/
    ├── Login.vue
    ├── Register.vue
    ├── ForgotPassword.vue
    ├── Betting.vue              # Main betting page
    ├── MyBets.vue               # User bet history
    ├── Profile.vue
    └── Admin.vue                # Admin panel
```

## Notes
- Riot development API keys expire every 24h — use a production key for permanent deployment
- The payout multiplier is 1.9× (configurable in `src/services/bets.js`)
- Coins update in real-time via Firestore `onSnapshot`

