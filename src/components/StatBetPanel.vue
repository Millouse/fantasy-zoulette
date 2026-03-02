<template>
  <div class="panel" :class="{ locked: betLocked, placed: !!existingBet }">

    <!-- Header -->
    <div class="panel-header">
      <span class="stat-icon">{{ stat.icon }}</span>
      <span class="stat-label">{{ stat.label }}</span>
      <span class="stat-hint">{{ stat.hint }}</span>
    </div>

    <!-- Already bet -->
    <div v-if="existingBet" class="placed-info">
      <span class="placed-label">Paris placé</span>
      <span class="placed-val">
        Au dessus de <strong>{{ stat.format(existingBet.targetValue) }}</strong>
        — {{ existingBet.amount.toLocaleString() }} ZC @ <span class="odds-highlight">{{ existingBet.odds }}x</span>
      </span>
      <span class="placed-payout">
        Gain potentiel : <strong class="text-green">+{{ Math.floor(existingBet.amount * existingBet.odds).toLocaleString() }} ZC</strong>
      </span>
    </div>

    <!-- Locked -->
    <div v-else-if="betLocked" class="lock-msg">
      <span>🔒 Paris fermés</span>
      <span class="lock-sub">Betting is locked after 10 minutes of play</span>
    </div>

    <!-- Bet form -->
    <template v-else>
      <div class="countdown" v-if="timeUntilLock">
        ⏳ Fermeture dans <strong>{{ timeUntilLock }}</strong>
      </div>

      <!-- Target value slider + input -->
      <div class="target-row">
        <span class="target-prefix">Au dessus de</span>
        <div class="target-input-wrap">
          <button class="step-btn" @click="decrement">−</button>
          <input
            v-model.number="targetValue"
            type="number"
            :min="stat.min"
            :max="stat.max === Infinity ? 9999 : stat.max"
            :step="stat.step"
            class="target-input"
            @change="clamp"
          />
          <span class="target-unit">{{ stat.unit }}</span>
          <button class="step-btn" @click="increment">+</button>
        </div>
        <div class="odds-pill" :class="oddsClass">{{ currentOdds }}x</div>
      </div>

      <!-- Quick value presets -->
      <div class="presets">
        <button
          v-for="preset in presets"
          :key="preset"
          class="preset-btn"
          :class="{ active: targetValue === preset }"
          @click="targetValue = preset"
        >
          {{ stat.format(preset) }}
        </button>
      </div>

      <!-- Amount + payout -->
      <div class="amount-row">
        <div class="amount-wrap">
          <span class="coin-sym">🪙</span>
          <input
            v-model.number="betAmount"
            type="number"
            min="1"
            :max="userCoins"
            placeholder="Mise"
            class="amount-input"
          />
        </div>
        <div class="quick-amounts">
          <button v-for="q in [50,100,250,500]" :key="q" class="quick-btn" @click="betAmount = Math.min(q, userCoins)">
            {{ q >= 1000 ? q/1000+'k' : q }}
          </button>
          <button class="quick-btn" @click="betAmount = userCoins">MAX</button>
        </div>
      </div>

      <div class="payout-preview" v-if="betAmount > 0">
        Gain potentiel : <span class="text-green">+{{ potentialPayout.toLocaleString() }} ZC</span>
        <span class="odds-tag">@ {{ currentOdds }}x</span>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>

      <button class="btn-place" @click="place" :disabled="placing || !betAmount || betAmount < 1 || betAmount > userCoins || !isTargetValid">
        {{ placing ? 'En cours…' : `⚡ Parier sur ${stat.label}` }}
      </button>

      <div v-if="!isTargetValid" class="validation-hint">
        <span v-if="stat.max !== Infinity">Valeur entre {{ stat.format(stat.min) }} et {{ stat.format(stat.max) }}</span>
        <span v-else>Valeur minimum : {{ stat.format(stat.min) }}</span>
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  stat: Object,
  userCoins: Number,
  existingBet: Object,
  betLocked: Boolean,
  timeUntilLock: String,
})
const emit = defineEmits(['place'])

const targetValue = ref(props.stat.defaultValue)
const betAmount = ref(null)
const placing = ref(false)
const error = ref('')

// Clamp value to allowed range
function clamp() {
  const min = props.stat.min
  const max = props.stat.max === Infinity ? 9999 : props.stat.max
  targetValue.value = Math.max(min, Math.min(max, targetValue.value))
  // Round to step precision
  const steps = Math.round((targetValue.value - min) / props.stat.step)
  targetValue.value = +(min + steps * props.stat.step).toFixed(2)
}

function increment() {
  targetValue.value = +(targetValue.value + props.stat.step).toFixed(2)
  clamp()
}
function decrement() {
  targetValue.value = +(targetValue.value - props.stat.step).toFixed(2)
  clamp()
}

const isTargetValid = computed(() => {
  const v = targetValue.value
  const max = props.stat.max === Infinity ? Infinity : props.stat.max
  return v >= props.stat.min && v <= max
})

// Dynamic odds formula:
// Base odds = 1.3
// The further above the minimum the target is, the higher the odds
// Normalized distance from min to a "reference ceiling" gives the multiplier
// kda: min=2, ref=10 → at 2.0 = 1.3x, at 10+ = 4.0x
// duration: min=25, max=90 → at 25 = 1.3x, at 90 = 3.5x
// cspm: min=7, max=20 → at 7 = 1.3x, at 20 = 3.5x
const ODDS_CEILING = { kda: 10, duration: 90, cspm: 20 }
const ODDS_MAX = { kda: 4.0, duration: 3.5, cspm: 3.5 }

const currentOdds = computed(() => {
  const v = targetValue.value
  const min = props.stat.min
  const ceiling = ODDS_CEILING[props.stat.type]
  const maxOdds = ODDS_MAX[props.stat.type]

  const t = Math.min(1, Math.max(0, (v - min) / (ceiling - min)))
  const odds = 1.3 + t * (maxOdds - 1.3)
  return +odds.toFixed(2)
})

const potentialPayout = computed(() => {
  return betAmount.value ? Math.floor(betAmount.value * currentOdds.value) : 0
})

const oddsClass = computed(() => {
  const o = currentOdds.value
  if (o >= 3.0) return 'odds-hot'
  if (o >= 2.0) return 'odds-mid'
  return 'odds-low'
})

// Preset quick values — 5 evenly spaced between min and a reasonable ceiling
const presets = computed(() => {
  const min = props.stat.min
  const ceiling = props.stat.max === Infinity ? ODDS_CEILING[props.stat.type] : props.stat.max
  const step = props.stat.step
  const count = 5
  return Array.from({ length: count }, (_, i) => {
    const raw = min + (i / (count - 1)) * (ceiling - min)
    return +(Math.round(raw / step) * step).toFixed(2)
  })
})

async function place() {
  error.value = ''
  if (!isTargetValid.value) { error.value = 'Valeur hors limites.'; return }
  if (!betAmount.value || betAmount.value < 1) { error.value = 'Entrez une mise valide.'; return }
  if (betAmount.value > props.userCoins) { error.value = 'Pas assez de ZouletteCoins.'; return }

  placing.value = true
  try {
    emit('place', {
      statType: props.stat.type,
      targetValue: targetValue.value,
      amount: betAmount.value,
      odds: currentOdds.value,
    })
  } finally {
    placing.value = false
  }
}
</script>

<style scoped>
.panel {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  transition: border-color 0.2s;
}
.panel:not(.locked):not(.placed):hover { border-color: var(--border-bright); }
.panel.locked { opacity: 0.7; }
.panel.placed { border-color: rgba(0,212,255,0.25); }

.panel-header { align-items: center; display: flex; gap: 8px; }
.stat-icon { font-size: 18px; }
.stat-label { font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.stat-hint { color: var(--text-dim); font-size: 11px; margin-left: auto; }

/* Placed state */
.placed-info { display: flex; flex-direction: column; gap: 4px; }
.placed-label { color: var(--cyan); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.placed-val { color: var(--text-muted); font-size: 13px; }
.placed-payout { font-size: 12px; }
.odds-highlight { color: var(--gold); font-weight: 700; }

/* Lock */
.lock-msg { align-items: center; color: var(--red); display: flex; flex-direction: column; font-size: 13px; font-weight: 700; gap: 4px; padding: 8px 0; text-align: center; }
.lock-sub { color: var(--text-dim); font-size: 11px; font-weight: 400; }

/* Countdown */
.countdown { background: rgba(255,200,0,0.08); border: 1px solid rgba(255,200,0,0.25); border-radius: 6px; color: var(--gold); font-size: 11px; padding: 5px 10px; text-align: center; }
.countdown strong { font-weight: 700; }

/* Target row */
.target-row { align-items: center; display: flex; gap: 10px; flex-wrap: wrap; }
.target-prefix { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
.target-input-wrap { align-items: center; display: flex; gap: 4px; }
.step-btn {
  align-items: center; background: var(--surface); border: 1px solid var(--border-bright);
  border-radius: 6px; color: var(--text-muted); display: flex; font-size: 16px;
  height: 32px; justify-content: center; transition: all 0.15s; width: 32px;
}
.step-btn:hover { border-color: var(--cyan); color: var(--cyan); }
.target-input {
  background: var(--surface); border: 1px solid var(--border-bright); border-radius: 6px;
  color: var(--text); font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700;
  padding: 4px 10px; text-align: center; width: 90px;
}
.target-unit { color: var(--text-dim); font-size: 11px; margin-left: 2px; white-space: nowrap; }

.odds-pill { border-radius: 20px; font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; margin-left: auto; padding: 3px 14px; }
.odds-low { background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); color: var(--cyan); }
.odds-mid { background: rgba(255,200,0,0.1); border: 1px solid rgba(255,200,0,0.3); color: var(--gold); }
.odds-hot { background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3); color: var(--red); }

/* Presets */
.presets { display: flex; gap: 6px; flex-wrap: wrap; }
.preset-btn {
  background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-muted); font-size: 11px; font-weight: 600; padding: 4px 10px;
  transition: all 0.15s;
}
.preset-btn:hover { border-color: var(--cyan); color: var(--cyan); }
.preset-btn.active { background: rgba(0,212,255,0.1); border-color: var(--cyan); color: var(--cyan); }

/* Amount */
.amount-row { display: flex; flex-direction: column; gap: 6px; }
.amount-wrap { align-items: center; display: flex; position: relative; }
.coin-sym { font-size: 16px; left: 12px; pointer-events: none; position: absolute; }
.amount-input { padding-left: 34px !important; }
.quick-amounts { display: flex; gap: 5px; }
.quick-btn {
  background: var(--surface); border: 1px solid var(--border); border-radius: 5px;
  color: var(--text-muted); flex: 1; font-size: 11px; font-weight: 600; padding: 4px;
  transition: all 0.15s;
}
.quick-btn:hover { border-color: var(--cyan); color: var(--cyan); }

.payout-preview { color: var(--text-muted); font-size: 12px; text-align: center; }
.odds-tag { color: var(--text-dim); font-size: 11px; margin-left: 4px; }
.text-green { color: var(--green); font-weight: 700; }

.validation-hint { color: var(--text-dim); font-size: 11px; text-align: center; }

.btn-place {
  background: linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,255,136,0.08));
  border: 1px solid var(--cyan); border-radius: 8px; color: var(--cyan);
  font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700;
  letter-spacing: 0.08em; padding: 10px; text-transform: uppercase;
  transition: background 0.2s, box-shadow 0.2s; width: 100%;
}
.btn-place:hover:not(:disabled) { background: linear-gradient(135deg, rgba(0,212,255,0.22), rgba(0,255,136,0.15)); box-shadow: 0 0 16px rgba(0,212,255,0.15); }
.btn-place:disabled { opacity: 0.35; cursor: not-allowed; }
</style>